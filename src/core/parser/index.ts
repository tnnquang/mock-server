export { Tokenizer } from './tokenizer.js';
export { TypeParser } from './parser.js';
export { TypeResolver } from './resolver.js';
export { TypeRegistry } from './type-registry.js';

import { TypeParser } from './parser.js';
import { TypeResolver } from './resolver.js';
import type { TypeNode, ParseResult } from '../types.js';

/**
 * Parse TypeScript type definitions from a string and resolve all references.
 *
 * @param input - TypeScript source containing interface/type/enum declarations
 * @param typeName - Optional: specific type name to resolve. If omitted, uses the first declared type.
 * @returns The fully resolved TypeNode
 */
export function parseAndResolve(input: string, typeName?: string): TypeNode {
  const parser = new TypeParser();
  const result = parser.parse(input);
  const resolver = new TypeResolver(parser.getRegistry());

  const name = typeName || result.defaultType;
  if (!name) {
    throw new Error('No type declarations found in input');
  }

  const typeNode = result.types.get(name);
  if (!typeNode) {
    throw new Error(`Type "${name}" not found. Available types: ${Array.from(result.types.keys()).join(', ')}`);
  }

  return resolver.resolve(typeNode);
}

/**
 * Parse TypeScript type definitions without resolving references.
 */
export function parseTypes(input: string): ParseResult {
  const parser = new TypeParser();
  return parser.parse(input);
}
