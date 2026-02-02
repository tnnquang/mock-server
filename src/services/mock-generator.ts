import { Project } from 'ts-morph';
import * as TJS from 'typescript-json-schema';
import { JSONSchemaFaker } from 'json-schema-faker';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';
import { faker } from '@faker-js/faker/locale/vi';

// Configure faker to be used by json-schema-faker
JSONSchemaFaker.extend('faker', () => faker);
JSONSchemaFaker.option({
    alwaysFakeOptionals: true,
    optionalsProbability: 0.5
});

export interface MockRouteConfig {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    type: 'json' | 'typescript' | 'json-schema' | 'ts-type'; // Keep ts-type for compatibility

    // JSON source options
    data?: any;
    jsonFilePath?: string;

    // Enhanced Config Support
    configFile?: string; // Path to a full JSON config for this route

    // TS/Main source options
    mainConfig?: {
        filePath?: string;
        typeDefinition?: string;
        typeName?: string;
        lineRange?: [number, number];
        types?: Record<string, any>; // Virtual type definitions
    };
    tsOptions?: MockRouteConfig['mainConfig']; // Compatibility alias

    // Response control
    responseDataType?: 'detail' | 'list';
    responseMode?: 'object' | 'list'; // Compatibility alias
    responseTemplate?: any;
    delay?: number;
}

export interface GenerationOptions {
    page?: number;
    limit?: number;
    tsconfigPath?: string;
}

export async function generateMockData(config: MockRouteConfig, options: GenerationOptions = {}): Promise<any> {
    let baseSource: any;

    // 1. Resolve Source Data/Schema
    if (config.type === 'json' || config.type === 'json-schema') {
        if (config.jsonFilePath) {
            const absolutePath = path.isAbsolute(config.jsonFilePath)
                ? config.jsonFilePath
                : path.resolve(process.cwd(), config.jsonFilePath);

            if (fs.existsSync(absolutePath)) {
                baseSource = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
            } else {
                throw new Error(`JSON file not found: ${absolutePath}`);
            }
        } else {
            baseSource = config.data;
        }
    } else if ((config.type === 'typescript' || config.type === 'ts-type')) {
        const mainConfig = config.mainConfig || config.tsOptions;
        if (mainConfig) {
            if (mainConfig.types && !mainConfig.filePath && !mainConfig.typeDefinition) {
                // Handle Virtual Types (inline definition)
                baseSource = convertVirtualTypesToSchema(mainConfig.types, mainConfig.typeName);
            } else {
                baseSource = await resolveTsSchema(mainConfig, options);
            }
        }
    }

    if (!baseSource) {
        throw new Error('Could not resolve data source or schema');
    }

    // 2. Format Response
    return await formatResponse(baseSource, config, options);
}

async function resolveTsSchema(tsOptions: NonNullable<MockRouteConfig['tsOptions']>, options: GenerationOptions = {}): Promise<any> {
    let targetFilePath = tsOptions.filePath;
    let targetTypeName = tsOptions.typeName;

    // Handle Direct Type Definition
    if (tsOptions.typeDefinition) {
        const tmpDir = os.tmpdir();
        const hash = crypto.createHash('md5').update(tsOptions.typeDefinition).digest('hex');
        const tempFile = path.join(tmpDir, `mock-server-temp-${hash}.ts`);
        fs.writeFileSync(tempFile, tsOptions.typeDefinition);
        targetFilePath = tempFile;

        if (!targetTypeName) {
            const project = new Project();
            const sourceFile = project.addSourceFileAtPath(tempFile);
            const exported = sourceFile.getExportedDeclarations();
            if (exported.size > 0) {
                targetTypeName = exported.keys().next().value;
            }
            if (!targetTypeName) {
                const interfaces = sourceFile.getInterfaces();
                if (interfaces.length > 0) targetTypeName = interfaces[0].getName();
            }
            if (!targetTypeName) {
                const types = sourceFile.getTypeAliases();
                if (types.length > 0) targetTypeName = types[0].getName();
            }
        }
    }

    if (targetFilePath) {
        const absoluteFilePath = path.isAbsolute(targetFilePath)
            ? targetFilePath
            : path.resolve(process.cwd(), targetFilePath);

        if (!targetTypeName && tsOptions.lineRange) {
            const project = new Project();
            const sourceFile = project.addSourceFileAtPath(absoluteFilePath);
            const interfaces = sourceFile.getInterfaces();
            const typeAliases = sourceFile.getTypeAliases();

            const foundNode = [...interfaces, ...typeAliases].find(node => {
                const startLine = node.getStartLineNumber();
                const endLine = node.getEndLineNumber();
                return startLine >= tsOptions.lineRange![0] && endLine <= tsOptions.lineRange![1];
            });

            if (foundNode) {
                targetTypeName = foundNode.getName();
            }
        }

        if (!targetTypeName) {
            throw new Error(`Type name could not be determined for file: ${absoluteFilePath}`);
        }

        let program: TJS.Program;

        try {
            // Priority: Explicit options.tsconfigPath > Detected near file > Default fallback
            let effectiveTsconfig = options.tsconfigPath;
            if (!effectiveTsconfig) {
                effectiveTsconfig = findNearestTsConfig(absoluteFilePath);
                if (effectiveTsconfig) {
                    console.log(`Auto-detected tsconfig: ${effectiveTsconfig}`);
                }
            }

            if (effectiveTsconfig) {
                const tsconfigPath = path.isAbsolute(effectiveTsconfig)
                    ? effectiveTsconfig
                    : path.resolve(process.cwd(), effectiveTsconfig);

                if (!fs.existsSync(tsconfigPath)) {
                    throw new Error(`tsconfig file not found: ${tsconfigPath}`);
                }

                // Important: For external files, we need the program to be aware of the external project context
                program = TJS.programFromConfig(tsconfigPath, [absoluteFilePath]);
            } else {
                const compilerOptions: TJS.CompilerOptions = {
                    strictNullChecks: true,
                    esModuleInterop: true,
                    skipLibCheck: true,
                    allowJs: true
                };
                program = TJS.getProgramFromFiles([absoluteFilePath], compilerOptions);
            }

            const schema = TJS.generateSchema(program, targetTypeName, {
                required: true,
                noExtraProps: true,
                ignoreErrors: true,
                aliasRef: true,
                ref: true,
                topRef: true,
                strictNullChecks: true
            });

            if (!schema) {
                throw new Error(`Failed to generate schema for type "${targetTypeName}". Ensure the type is exported or accessible.`);
            }
            return schema;
        } catch (e: any) {
            throw new Error(`TypeScript Resolution Error: ${e.message}`);
        }
    }

    throw new Error('Missing file path or type name for TS generation');
}

/**
 * Finds the nearest tsconfig.json by walking up the directory tree from the target file.
 */
function findNearestTsConfig(filePath: string): string | undefined {
    let currentDir = path.dirname(filePath);
    while (currentDir !== path.parse(currentDir).root) {
        const tsconfigPath = path.join(currentDir, 'tsconfig.json');
        if (fs.existsSync(tsconfigPath)) {
            return tsconfigPath;
        }
        currentDir = path.dirname(currentDir);
    }
    return undefined;
}

async function formatResponse(source: any, config: MockRouteConfig, options: GenerationOptions): Promise<any> {
    const isSchema = config.type === 'typescript' || config.type === 'ts-type' || config.type === 'json-schema';

    // Support new responseDataType naming
    let mode: string = config.responseDataType === 'detail' ? 'object' : (config.responseDataType || config.responseMode || 'object');
    if (mode === 'object') mode = 'object'; // Normalize

    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 10;

    let generatedData: any;

    if (mode === 'object') {
        generatedData = isSchema ? await JSONSchemaFaker.resolve(source) : source;
    } else {
        const promises: Promise<any>[] = [];
        for (let i = 0; i < limit; i++) {
            promises.push(isSchema ? JSONSchemaFaker.resolve(source) : Promise.resolve(source));
        }
        generatedData = await Promise.all(promises);
    }

    // Apply template if provided
    if (config.responseTemplate) {
        const total = limit * 5; // Fake total
        const totalPages = 5;

        const replaceTokens = (obj: any): any => {
            if (typeof obj === 'string') {
                if (obj === '{{data}}') return generatedData;
                return obj
                    .replace('{{page}}', String(page))
                    .replace('{{limit}}', String(limit))
                    .replace('{{total}}', String(total))
                    .replace('{{totalPages}}', String(totalPages));
            }
            if (Array.isArray(obj)) {
                return obj.map(replaceTokens);
            }
            if (typeof obj === 'object' && obj !== null) {
                const newObj: any = {};
                for (const key in obj) {
                    newObj[key] = replaceTokens(obj[key]);
                }
                return newObj;
            }
            return obj;
        };

        return replaceTokens(config.responseTemplate);
    }

    // Default formatting if no template
    if (mode === 'list' && options.page) {
        // Automatically provide pagination if 'list' mode and query params exist, but no template
        return {
            data: generatedData,
            pagination: {
                page,
                limit,
                total: limit * 5,
                totalPages: 5
            }
        };
    }

    return generatedData;
}

/**
 * Converts nested virtual type definitions into JSON Schema
 */
function convertVirtualTypesToSchema(types: Record<string, any>, targetTypeName?: string): any {
    const mainType = targetTypeName || Object.keys(types)[0];
    const definition = types[mainType];

    if (!definition) throw new Error(`Type "${mainType}" not found in virtual types`);

    const parseType = (item: any): any => {
        if (typeof item === 'string') {
            if (item.startsWith('faker:')) {
                return { type: 'string', faker: item.replace('faker:', '') };
            }
            if (['string', 'number', 'integer', 'boolean', 'object', 'array'].includes(item)) {
                return { type: item };
            }
            return { type: 'string' }; // Default
        }

        if (typeof item === 'object' && item !== null) {
            if (item.return === 'array') {
                return {
                    type: 'array',
                    items: parseType(item.itemType)
                };
            }

            // Nested object
            const properties: Record<string, any> = {};
            const required: string[] = [];
            for (const key in item) {
                properties[key] = parseType(item[key]);
                required.push(key);
            }
            return {
                type: 'object',
                properties,
                required
            };
        }
        return { type: 'string' };
    }

    if (definition.return === 'array') {
        return {
            type: 'array',
            items: parseType(definition.itemType)
        };
    }

    return parseType(definition.itemType || definition);
}
