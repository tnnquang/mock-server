#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import type { MockSchema, GeneratorOptions } from '../core/types.js';
import { generateMockData } from '../core/generator/index.js';
import { validateSchema } from '../core/schema/index.js';
import { loadTypeFromFile } from './file-parser.js';
import { saveResponse } from './file-saver.js';
import { startServer } from './server.js';

const program = new Command();

program
  .name('mock-server')
  .description('Generate realistic mock data from TypeScript type definitions')
  .version('2.0.0');

// ─── generate command ────────────────────────────────────────

program
  .command('generate')
  .description('Generate mock data from a schema (without starting a server)')
  .option('-s, --schema <schema>', 'Schema as JSON string or path to JSON schema file')
  .option('-f, --file <path>', 'Path to TypeScript file containing types')
  .option('-t, --type <name>', 'Name of the type to generate data for')
  .option('-c, --count <number>', 'Number of items to generate (sets responseType to "list")', '1')
  .option('-o, --output <path>', 'Save output to file')
  .option('--locale <locale>', 'Faker locale (default: auto-detect)')
  .option('--seed <number>', 'Seed for reproducible output')
  .option('--pretty', 'Pretty-print JSON output', true)
  .action(async (opts) => {
    try {
      let schema: MockSchema;

      if (opts.schema) {
        schema = parseSchemaOption(opts.schema);
      } else if (opts.file) {
        const typeDefinition = loadTypeFromFile({ pathType: opts.file });
        schema = {
          typeDefinition,
          typeName: opts.type,
          dataConfig: {
            request: {
              responseType: parseInt(opts.count) > 1 ? 'list' : 'single',
              limit: parseInt(opts.count),
            },
          },
        };
      } else {
        console.error('Error: Provide --schema or --file option');
        process.exit(1);
      }

      // Resolve pathType to typeDefinition
      if (schema.pathType && !schema.typeDefinition) {
        schema.typeDefinition = loadTypeFromFile({
          pathType: schema.pathType,
          startLine: schema.startLine,
          endLine: schema.endLine,
        });
      }

      const validation = validateSchema(schema);
      if (!validation.valid) {
        console.error('Schema validation errors:');
        validation.errors.forEach(e => console.error(`  - ${e}`));
        process.exit(1);
      }

      const generatorOptions: GeneratorOptions = {
        locale: opts.locale,
        seed: opts.seed ? parseInt(opts.seed) : undefined,
      };

      const data = generateMockData(schema, undefined, generatorOptions);

      // Output
      const json = opts.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

      if (opts.output) {
        const savedPath = saveResponse(data, opts.output);
        console.log(`Data saved to: ${savedPath}`);
      } else if (schema.responseSave && schema.responseSave !== false) {
        const savedPath = saveResponse(data, schema.responseSave.path);
        console.log(`Data saved to: ${savedPath}`);
      }

      // Always print to stdout
      console.log(json);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ─── serve command ───────────────────────────────────────────

program
  .command('serve')
  .description('Start a mock server that accepts dynamic requests')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('--locale <locale>', 'Default faker locale')
  .option('--logging', 'Enable request logging', false)
  .action((opts) => {
    startServer({
      port: parseInt(opts.port),
      locale: opts.locale,
      logging: opts.logging,
    });
  });

program.parse();

// ─── Helpers ─────────────────────────────────────────────────

function parseSchemaOption(schemaStr: string): MockSchema {
  // Try as file path first
  const resolved = path.resolve(schemaStr);
  if (fs.existsSync(resolved)) {
    const content = fs.readFileSync(resolved, 'utf-8');
    return JSON.parse(content);
  }

  // Try as JSON string
  try {
    return JSON.parse(schemaStr);
  } catch {
    throw new Error(
      `Could not parse schema. "${schemaStr}" is not a valid file path or JSON string.`
    );
  }
}
