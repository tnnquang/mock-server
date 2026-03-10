import { describe, it, expect } from 'vitest';
import { generateMockData } from '../../core/generator/index.js';
import { generateFromType } from '../../core/generator/type-mapper.js';
import { parseAndResolve } from '../../core/parser/index.js';

describe('generateFromType', () => {
  it('should generate primitive types', () => {
    expect(typeof generateFromType({ kind: 'primitive', type: 'string' })).toBe('string');
    expect(typeof generateFromType({ kind: 'primitive', type: 'number' })).toBe('number');
    expect(typeof generateFromType({ kind: 'primitive', type: 'boolean' })).toBe('boolean');
    expect(generateFromType({ kind: 'primitive', type: 'null' })).toBe(null);
  });

  it('should generate literal types', () => {
    expect(generateFromType({ kind: 'literal', value: 'hello' })).toBe('hello');
    expect(generateFromType({ kind: 'literal', value: 42 })).toBe(42);
    expect(generateFromType({ kind: 'literal', value: true })).toBe(true);
  });

  it('should generate arrays', () => {
    const result = generateFromType({ kind: 'array', elementType: { kind: 'primitive', type: 'string' } });
    expect(Array.isArray(result)).toBe(true);
    expect((result as string[]).every(item => typeof item === 'string')).toBe(true);
  });

  it('should generate objects with field name heuristics', () => {
    const type = parseAndResolve(`interface User { id: string; email: string; name: string; age: number; }`);
    const result = generateFromType(type) as Record<string, unknown>;

    expect(result).toBeDefined();
    expect(typeof result.id).toBe('string');
    expect(typeof result.email).toBe('string');
    expect(typeof result.name).toBe('string');
    expect(typeof result.age).toBe('number');
  });

  it('should generate enum values', () => {
    const result = generateFromType({
      kind: 'enum',
      members: [
        { name: 'Red', value: 'red' },
        { name: 'Green', value: 'green' },
        { name: 'Blue', value: 'blue' },
      ],
    });

    expect(['red', 'green', 'blue']).toContain(result);
  });

  it('should generate record types', () => {
    const result = generateFromType({
      kind: 'record',
      keyType: { kind: 'primitive', type: 'string' },
      valueType: { kind: 'primitive', type: 'number' },
    }) as Record<string, number>;

    expect(typeof result).toBe('object');
    expect(Object.keys(result).length).toBeGreaterThan(0);
    expect(Object.values(result).every(v => typeof v === 'number')).toBe(true);
  });

  it('should generate union types', () => {
    const result = generateFromType({
      kind: 'union',
      members: [
        { kind: 'literal', value: 'a' },
        { kind: 'literal', value: 'b' },
        { kind: 'literal', value: 'c' },
      ],
    });

    expect(['a', 'b', 'c']).toContain(result);
  });

  it('should generate tuples', () => {
    const result = generateFromType({
      kind: 'tuple',
      elements: [
        { kind: 'primitive', type: 'string' },
        { kind: 'primitive', type: 'number' },
      ],
    }) as [string, number];

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe('string');
    expect(typeof result[1]).toBe('number');
  });
});

describe('generateMockData', () => {
  it('should generate single item by default', () => {
    const result = generateMockData({
      typeDefinition: 'interface User { id: string; name: string; }',
    });

    expect(result).toBeDefined();
    expect(typeof (result as any).id).toBe('string');
    expect(typeof (result as any).name).toBe('string');
  });

  it('should generate list with pagination', () => {
    const result = generateMockData({
      typeDefinition: 'interface User { id: string; name: string; }',
      dataConfig: {
        request: {
          responseType: 'list',
          limit: 5,
          page: 1,
        },
      },
    }) as any;

    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeLessThanOrEqual(5);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(5);
  });

  it('should apply response template', () => {
    const result = generateMockData({
      typeDefinition: 'interface Item { id: string; value: number; }',
      dataConfig: {
        request: { responseType: 'list', limit: 3 },
        response: {
          status: 'success',
          payload: {
            items: '{{data}}',
            pagination: {
              currentPage: '{{page}}',
              totalRecords: '{{total}}',
            },
          },
        },
      },
    }) as any;

    expect(result.status).toBe('success');
    expect(result.payload.items).toBeDefined();
    expect(Array.isArray(result.payload.items)).toBe(true);
    expect(typeof result.payload.pagination.currentPage).toBe('number');
  });

  it('should generate with Partial<T>', () => {
    const result = generateMockData({
      typeDefinition: `
        interface User { id: string; name: string; email: string; }
        type PartialUser = Partial<User>;
      `,
      typeName: 'PartialUser',
    }) as any;

    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('should generate with Pick<T, K>', () => {
    const result = generateMockData({
      typeDefinition: `
        interface User { id: string; name: string; email: string; age: number; }
        type UserPreview = Pick<User, 'name' | 'email'>;
      `,
      typeName: 'UserPreview',
    }) as any;

    expect(result).toBeDefined();
    expect(Object.keys(result)).toEqual(expect.arrayContaining(['name', 'email']));
    expect(result.id).toBeUndefined();
    expect(result.age).toBeUndefined();
  });

  it('should generate with Omit<T, K>', () => {
    const result = generateMockData({
      typeDefinition: `
        interface User { id: string; name: string; password: string; }
        type SafeUser = Omit<User, 'password'>;
      `,
      typeName: 'SafeUser',
    }) as any;

    expect(result).toBeDefined();
    expect(result.password).toBeUndefined();
    expect(typeof result.id).toBe('string');
    expect(typeof result.name).toBe('string');
  });

  it('should generate with Record<K, V>', () => {
    const result = generateMockData({
      typeDefinition: `type Scores = Record<string, number>;`,
    }) as Record<string, number>;

    expect(typeof result).toBe('object');
    expect(Object.values(result).every(v => typeof v === 'number')).toBe(true);
  });

  it('should generate complex nested types', () => {
    const result = generateMockData({
      typeDefinition: `
        interface Product {
          id: string;
          name: string;
          price: number;
          tags: string[];
          variants: Array<{
            color: string;
            size: 'S' | 'M' | 'L';
            stock: number;
          }>;
        }
      `,
    }) as any;

    expect(typeof result.id).toBe('string');
    expect(typeof result.price).toBe('number');
    expect(Array.isArray(result.tags)).toBe(true);
    expect(Array.isArray(result.variants)).toBe(true);
    if (result.variants.length > 0) {
      expect(['S', 'M', 'L']).toContain(result.variants[0].size);
    }
  });

  it('should handle extra registered types', () => {
    const extraTypes = new Map<string, string>();
    extraTypes.set('Address', 'interface Address { city: string; country: string; }');

    const result = generateMockData({
      typeDefinition: 'interface User { name: string; address: Address; }',
    }, extraTypes) as any;

    expect(typeof result.name).toBe('string');
    expect(typeof result.address).toBe('object');
    expect(typeof result.address.city).toBe('string');
  });

  it('should throw if no typeDefinition', () => {
    expect(() => generateMockData({} as any)).toThrow('typeDefinition is required');
  });
});
