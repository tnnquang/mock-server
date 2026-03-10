import { faker } from '@faker-js/faker';
import type { TypeNode, GeneratorOptions } from '../types.js';
import { generateByFieldName } from './field-mapper.js';

const DEFAULT_OPTIONS: Required<GeneratorOptions> = {
  locale: 'en',
  seed: 0,
  maxDepth: 5,
  arrayLength: { min: 1, max: 5 },
};

/**
 * Generate mock data from a fully resolved TypeNode.
 */
export function generateFromType(
  node: TypeNode,
  fieldName?: string,
  options?: GeneratorOptions,
  depth = 0,
): unknown {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (depth > opts.maxDepth) {
    return getDefaultForType(node);
  }

  // Try field name heuristic first (only for primitives and at property level)
  if (fieldName && isPrimitiveCompatible(node)) {
    const heuristicValue = generateByFieldName(fieldName);
    if (heuristicValue !== undefined && isTypeCompatible(heuristicValue, node)) {
      return heuristicValue;
    }
  }

  switch (node.kind) {
    case 'primitive':
      return generatePrimitive(node.type, fieldName);

    case 'literal':
      return node.value;

    case 'object':
      return generateObject(node.properties, opts, depth);

    case 'array':
      return generateArray(node.elementType, opts, depth);

    case 'tuple':
      return node.elements.map((el, i) =>
        generateFromType(el, undefined, opts, depth + 1)
      );

    case 'union':
      return generateUnion(node.members, fieldName, opts, depth);

    case 'intersection':
      return generateIntersection(node.members, opts, depth);

    case 'enum':
      if (node.members.length === 0) return null;
      const member = faker.helpers.arrayElement(node.members);
      return member.value ?? member.name;

    case 'record':
      return generateRecord(node.keyType, node.valueType, opts, depth);

    case 'function':
      return '() => {}';

    case 'indexed-access':
      return generatePrimitive('any', fieldName);

    case 'reference':
      // Unresolved reference - fallback
      return generatePrimitive('any', fieldName);

    default:
      return null;
  }
}

function generatePrimitive(type: string, fieldName?: string): unknown {
  switch (type) {
    case 'string':
      return fieldName ? faker.lorem.word() : faker.lorem.word();
    case 'number':
      return faker.number.int({ min: 0, max: 10000 });
    case 'boolean':
      return faker.datatype.boolean();
    case 'Date':
      return faker.date.recent().toISOString();
    case 'bigint':
      return faker.number.int({ min: 0, max: 999999 });
    case 'null':
      return null;
    case 'undefined':
      return undefined;
    case 'void':
      return undefined;
    case 'never':
      return undefined;
    case 'symbol':
      return `Symbol(${faker.lorem.word()})`;
    case 'object':
      return {};
    case 'any':
    case 'unknown':
      return faker.lorem.word();
    default:
      return faker.lorem.word();
  }
}

function generateObject(
  properties: Array<{ name: string; type: TypeNode; optional: boolean; readonly: boolean }>,
  opts: Required<GeneratorOptions>,
  depth: number,
): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  for (const prop of properties) {
    // Skip optional properties ~30% of the time
    if (prop.optional && faker.datatype.boolean({ probability: 0.3 })) {
      continue;
    }

    obj[prop.name] = generateFromType(prop.type, prop.name, opts, depth + 1);
  }

  return obj;
}

function generateArray(
  elementType: TypeNode,
  opts: Required<GeneratorOptions>,
  depth: number,
): unknown[] {
  const length = faker.number.int(opts.arrayLength);
  const items: unknown[] = [];

  for (let i = 0; i < length; i++) {
    items.push(generateFromType(elementType, undefined, opts, depth + 1));
  }

  return items;
}

function generateUnion(
  members: TypeNode[],
  fieldName: string | undefined,
  opts: Required<GeneratorOptions>,
  depth: number,
): unknown {
  // Filter out null/undefined for more useful data
  const useful = members.filter(
    m => !(m.kind === 'primitive' && (m.type === 'null' || m.type === 'undefined' || m.type === 'never'))
  );
  const candidates = useful.length > 0 ? useful : members;
  const chosen = faker.helpers.arrayElement(candidates);
  return generateFromType(chosen, fieldName, opts, depth + 1);
}

function generateIntersection(
  members: TypeNode[],
  opts: Required<GeneratorOptions>,
  depth: number,
): unknown {
  // Merge all generated objects
  const result: Record<string, unknown> = {};
  for (const member of members) {
    const generated = generateFromType(member, undefined, opts, depth + 1);
    if (generated && typeof generated === 'object' && !Array.isArray(generated)) {
      Object.assign(result, generated);
    }
  }
  return Object.keys(result).length > 0 ? result : generateFromType(members[0], undefined, opts, depth + 1);
}

function generateRecord(
  keyType: TypeNode,
  valueType: TypeNode,
  opts: Required<GeneratorOptions>,
  depth: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const count = faker.number.int({ min: 2, max: 5 });

  // If key is a union of literals, use those as keys
  if (keyType.kind === 'union') {
    for (const member of keyType.members) {
      if (member.kind === 'literal' && typeof member.value === 'string') {
        result[member.value] = generateFromType(valueType, member.value, opts, depth + 1);
      }
    }
    if (Object.keys(result).length > 0) return result;
  }

  if (keyType.kind === 'literal' && typeof keyType.value === 'string') {
    result[keyType.value] = generateFromType(valueType, keyType.value, opts, depth + 1);
    return result;
  }

  // Generate synthetic keys
  for (let i = 0; i < count; i++) {
    const key = keyType.kind === 'primitive' && keyType.type === 'number'
      ? String(i)
      : faker.lorem.word();
    result[key] = generateFromType(valueType, undefined, opts, depth + 1);
  }

  return result;
}

/**
 * Check if a generated value is compatible with the expected TypeNode.
 * Prevents field heuristic from returning wrong type (e.g., UUID string for a number field).
 */
function isTypeCompatible(value: unknown, node: TypeNode): boolean {
  if (node.kind === 'primitive') {
    switch (node.type) {
      case 'string': return typeof value === 'string';
      case 'number': return typeof value === 'number';
      case 'boolean': return typeof value === 'boolean';
      case 'Date': return typeof value === 'string' || value instanceof Date;
      default: return true; // any, unknown, etc.
    }
  }
  if (node.kind === 'literal') {
    return value === node.value;
  }
  if (node.kind === 'union') {
    return node.members.some(m => isTypeCompatible(value, m));
  }
  return true;
}

function isPrimitiveCompatible(node: TypeNode): boolean {
  return (
    node.kind === 'primitive' ||
    node.kind === 'union' ||
    node.kind === 'literal'
  );
}

function getDefaultForType(node: TypeNode): unknown {
  switch (node.kind) {
    case 'primitive':
      if (node.type === 'string') return '';
      if (node.type === 'number') return 0;
      if (node.type === 'boolean') return false;
      return null;
    case 'array':
      return [];
    case 'object':
      return {};
    default:
      return null;
  }
}
