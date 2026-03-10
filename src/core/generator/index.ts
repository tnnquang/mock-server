import { faker } from '@faker-js/faker';
import type { MockSchema, TypeNode, GeneratorOptions } from '../types.js';
import { parseAndResolve, parseTypes } from '../parser/index.js';
import { generateFromType } from './type-mapper.js';
import { applyPagination } from './pagination.js';
import { applyTemplate } from './template-engine.js';

export { generateFromType } from './type-mapper.js';
export { applyPagination, type PaginatedResult } from './pagination.js';
export { applyTemplate } from './template-engine.js';
export { generateByFieldName } from './field-mapper.js';

/**
 * Detect locale from environment.
 * Browser: navigator.language
 * Node.js: process.env.LANG or 'en'
 */
function detectLocale(): string {
  try {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language.split('-')[0];
    }
  } catch {}

  try {
    if (typeof process !== 'undefined' && process.env?.LANG) {
      return process.env.LANG.split('_')[0].split('.')[0];
    }
  } catch {}

  return 'en';
}

/**
 * Set faker locale. Supports common locales.
 */
function setLocale(locale: string): void {
  // faker v9+ uses allLocales or specific locale imports
  // For now, the faker instance auto-detects or we can set it
  try {
    if (locale === 'vi') {
      faker.locale = 'vi' as any;
    }
  } catch {
    // Ignore locale errors - faker will use default
  }
}

export interface GenerateResult {
  data: unknown;
  typeName?: string;
}

/**
 * Main entry point: generate mock data from a MockSchema.
 *
 * Pipeline: typeDefinition -> parse -> resolve -> generate -> paginate -> template
 */
export function generateMockData(
  schema: MockSchema,
  extraTypes?: Map<string, string>,
  options?: GeneratorOptions,
): unknown {
  const locale = options?.locale || detectLocale();
  setLocale(locale);

  if (options?.seed) {
    faker.seed(options.seed);
  }

  // 1. Get the type definition string
  const typeDefinition = schema.typeDefinition;
  if (!typeDefinition) {
    throw new Error('typeDefinition is required. Provide TypeScript type definitions as a string.');
  }

  // Determine the target type name
  let targetTypeName = schema.typeName;
  if (!targetTypeName) {
    // Parse just the schema's definition to find the default type name
    // This prevents extra types from becoming the default
    const preResult = parseTypes(typeDefinition);
    targetTypeName = preResult.defaultType;
  }

  // Build full input: merge extra registered types + the schema's type definition
  let fullInput = typeDefinition;
  if (extraTypes) {
    for (const [, def] of extraTypes) {
      fullInput = def + '\n' + fullInput;
    }
  }

  // 2. Parse and resolve
  const resolvedType = parseAndResolve(fullInput, targetTypeName);

  // 3. Generate data
  const requestConfig = schema.dataConfig?.request;
  const isList = requestConfig?.responseType === 'list';
  const count = isList ? (requestConfig?.perPage ?? requestConfig?.limit ?? 10) : 1;

  const items: unknown[] = [];
  for (let i = 0; i < count; i++) {
    items.push(generateFromType(resolvedType, undefined, options));
  }

  // 4. Apply pagination
  const paginated = applyPagination(items, requestConfig);

  // 5. Apply response template
  const responseTemplate = schema.dataConfig?.response;
  if (responseTemplate && typeof responseTemplate === 'object' && Object.keys(responseTemplate).length > 0) {
    return applyTemplate(responseTemplate, paginated);
  }

  return paginated;
}
