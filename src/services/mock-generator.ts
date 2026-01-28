import { Project } from 'ts-morph';
import * as TJS from 'typescript-json-schema';
import jsf from 'json-schema-faker';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';

// Configure faker to be used by json-schema-faker
// jsf.option({ alwaysFakeOptionals: true });

export interface MockRouteConfig {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    type: 'json' | 'ts-type';

    // JSON source options
    data?: any;
    jsonFilePath?: string;

    // TS source options
    tsOptions?: {
        filePath?: string;
        typeDefinition?: string; // Direct type/interface string
        typeName?: string;
        lineRange?: [number, number];
    };

    // Response control
    responseMode?: 'object' | 'list'; // Default 'object'
    responseTemplate?: any; // Custom wrapper e.g. { success: true, data: "{{data}}" }
    delay?: number;
}

export interface GenerationOptions {
    page?: number;
    limit?: number;
}

export async function generateMockData(config: MockRouteConfig, options: GenerationOptions = {}): Promise<any> {
    let baseSource: any;

    // 1. Resolve Source Data/Schema
    if (config.type === 'json') {
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
    } else if (config.type === 'ts-type' && config.tsOptions) {
        baseSource = await resolveTsSchema(config.tsOptions);
    }

    if (!baseSource) {
        throw new Error('Could not resolve data source or schema');
    }

    // 2. Format Response
    return await formatResponse(baseSource, config, options);
}

async function resolveTsSchema(tsOptions: NonNullable<MockRouteConfig['tsOptions']>): Promise<any> {
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
            throw new Error('Type name could not be determined.');
        }

        const compilerOptions: TJS.CompilerOptions = {
            strictNullChecks: true,
            esModuleInterop: true,
            skipLibCheck: true
        };

        const program = TJS.getProgramFromFiles([absoluteFilePath], compilerOptions);
        const schema = TJS.generateSchema(program, targetTypeName, { required: true });
        if (!schema) throw new Error(`Failed to generate schema for ${targetTypeName}`);
        return schema;
    }

    throw new Error('Missing file path or type name for TS generation');
}

async function formatResponse(source: any, config: MockRouteConfig, options: GenerationOptions): Promise<any> {
    const isSchema = config.type === 'ts-type';
    const mode = config.responseMode || 'object';
    const page = Number(options.page) || 1;
    const limit = Number(options.limit) || 10;

    let generatedData: any;

    if (mode === 'object') {
        generatedData = isSchema ? await jsf.resolve(source) : source;
    } else {
        const promises: Promise<any>[] = [];
        for (let i = 0; i < limit; i++) {
            promises.push(isSchema ? jsf.resolve(source) : Promise.resolve(source));
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
