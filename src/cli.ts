#!/usr/bin/env node
import { Command } from 'commander';
import { startServer } from './server';
import { generateMockData, MockRouteConfig } from './services/mock-generator';
import { validateMockConfig } from './utils/validator';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
    .version('1.0.0')
    .description('Mock Server CLI');

program
    .command('serve')
    .alias('s')
    .description('Start the mock server')
    .option('-p, --port <number>', 'Port to run server on', '3000')
    .option('-c, --config <path>', 'Path to a JSON config file containing initial routes')
    .option('--tsconfig <path>', 'Path to tsconfig.json for TypeScript type resolution')
    .action((options) => {
        const port = parseInt(options.port, 10);
        let initialRoutes = [];

        if (options.config) {
            const configPath = path.resolve(process.cwd(), options.config);
            if (fs.existsSync(configPath)) {
                try {
                    const content = fs.readFileSync(configPath, 'utf-8');
                    initialRoutes = JSON.parse(content);
                    console.log(`Loaded ${initialRoutes.length} initial routes from ${options.config}`);
                } catch (e) {
                    console.error(`Error parsing config file: ${e}`);
                }
            } else {
                console.error(`Config file not found: ${options.config}`);
            }
        }

        startServer(port, initialRoutes, options.tsconfig);
    });

program
    .command('mock')
    .description('Generate mock data without starting server')
    .option('-f, --file <path>', 'TypeScript file path')
    .option('-t, --type <name>', 'Type/Interface name')
    .option('-j, --json <data>', 'JSON data or file path')
    .option('-s, --schema <data>', 'JSON Schema data or file path')
    .option('-c, --count <number>', 'Number of items to generate (for list mode)', '1')
    .option('-o, --output <path>', 'Output file path (default: stdout)')
    .option('--template <json>', 'Response template as JSON string')
    .option('--list', 'Generate as list instead of single object')
    .option('--tsconfig <path>', 'Path to tsconfig.json for TypeScript type resolution')
    .action(async (options) => {
        try {
            let type: MockRouteConfig['type'] = 'json';
            if (options.file) type = 'ts-type';
            if (options.schema) type = 'json-schema';

            const config: MockRouteConfig = {
                path: '/mock',
                method: 'GET',
                type,
                responseMode: options.list ? 'list' : 'object'
            };

            const jsonData = options.json || options.schema;
            if (jsonData) {
                if (fs.existsSync(jsonData)) {
                    config.jsonFilePath = jsonData;
                } else {
                    try {
                        config.data = JSON.parse(jsonData);
                    } catch (e) {
                        console.error('Invalid JSON/Schema data');
                        process.exit(1);
                    }
                }
            } else if (options.file) {
                config.tsOptions = {
                    filePath: options.file,
                    typeName: options.type
                };
            } else {
                console.error('Either --file, --json, or --schema must be provided');
                process.exit(1);
            }

            if (options.template) {
                try {
                    config.responseTemplate = JSON.parse(options.template);
                } catch (e) {
                    console.error('Invalid template JSON');
                    process.exit(1);
                }
            }

            const validation = validateMockConfig(config);
            if (!validation.valid) {
                console.error('Validation errors:');
                validation.errors.forEach(err => console.error(`  - ${err}`));
                process.exit(1);
            }

            const count = parseInt(options.count, 10);
            const result = await generateMockData(config, {
                limit: count,
                tsconfigPath: options.tsconfig
            });

            const output = JSON.stringify(result, null, 2);
            if (options.output) {
                fs.writeFileSync(options.output, output);
                console.log(`Mock data written to ${options.output}`);
            } else {
                console.log(output);
            }
        } catch (error: any) {
            console.error('Error generating mock:', error.message);
            process.exit(1);
        }
    });

program.parse(process.argv);
