import * as fs from 'fs';
import * as path from 'path';
import { Project } from 'ts-morph';
import { MockRouteConfig } from '../services/mock-generator';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateMockConfig(config: MockRouteConfig): ValidationResult {
    const errors: string[] = [];

    // Basic required fields
    if (!config.path) errors.push('Missing required field: path');
    if (!config.method) errors.push('Missing required field: method');
    if (!config.type) errors.push('Missing required field: type');

    // Validate type-specific options
    if (config.type === 'json') {
        if (!config.data && !config.jsonFilePath) {
            errors.push('JSON type requires either "data" or "jsonFilePath"');
        }
        if (config.jsonFilePath) {
            const absolutePath = path.isAbsolute(config.jsonFilePath)
                ? config.jsonFilePath
                : path.resolve(process.cwd(), config.jsonFilePath);
            if (!fs.existsSync(absolutePath)) {
                errors.push(`JSON file not found: ${absolutePath}`);
            }
        }
    }

    if (config.type === 'ts-type') {
        if (!config.tsOptions) {
            errors.push('TS type requires "tsOptions"');
        } else {
            const { filePath, typeDefinition, typeName, lineRange } = config.tsOptions;

            if (!filePath && !typeDefinition) {
                errors.push('TS type requires either "filePath" or "typeDefinition"');
            }

            if (filePath) {
                const absolutePath = path.isAbsolute(filePath)
                    ? filePath
                    : path.resolve(process.cwd(), filePath);
                if (!fs.existsSync(absolutePath)) {
                    errors.push(`TypeScript file not found: ${absolutePath}`);
                } else {
                    // Validate type exists in file
                    if (typeName && !typeDefinition) {
                        try {
                            const project = new Project();
                            const sourceFile = project.addSourceFileAtPath(absolutePath);
                            const hasType = sourceFile.getInterface(typeName) || sourceFile.getTypeAlias(typeName);
                            if (!hasType) {
                                errors.push(`Type "${typeName}" not found in ${absolutePath}`);
                            }
                        } catch (e: any) {
                            errors.push(`Error parsing TypeScript file: ${e.message}`);
                        }
                    }
                }
            }

            if (lineRange) {
                if (!Array.isArray(lineRange) || lineRange.length !== 2) {
                    errors.push('lineRange must be an array of [startLine, endLine]');
                } else if (lineRange[0] > lineRange[1]) {
                    errors.push('lineRange startLine must be <= endLine');
                }
            }
        }
    }

    // Validate response mode
    if (config.responseMode && !['object', 'list'].includes(config.responseMode)) {
        errors.push('responseMode must be "object" or "list"');
    }

    // Validate response template tokens
    if (config.responseTemplate) {
        const validTokens = ['{{data}}', '{{page}}', '{{limit}}', '{{total}}', '{{totalPages}}'];
        const templateStr = JSON.stringify(config.responseTemplate);
        const usedTokens = templateStr.match(/\{\{[^}]+\}\}/g) || [];
        const invalidTokens = usedTokens.filter(token => !validTokens.includes(token));
        if (invalidTokens.length > 0) {
            errors.push(`Invalid template tokens: ${invalidTokens.join(', ')}. Valid tokens: ${validTokens.join(', ')}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
