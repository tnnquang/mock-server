import { describe, it, expect } from 'vitest';
import { TypeParser } from '../../core/parser/parser.js';

describe('TypeParser', () => {
  it('should parse a simple interface', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      interface User {
        id: string;
        name: string;
        age: number;
        active: boolean;
      }
    `);

    expect(result.defaultType).toBe('User');
    const user = result.types.get('User');
    expect(user).toBeDefined();
    expect(user!.kind).toBe('object');
    if (user!.kind === 'object') {
      expect(user!.properties).toHaveLength(4);
      expect(user!.properties[0]).toEqual({ name: 'id', type: { kind: 'primitive', type: 'string' }, optional: false, readonly: false });
      expect(user!.properties[1]).toEqual({ name: 'name', type: { kind: 'primitive', type: 'string' }, optional: false, readonly: false });
      expect(user!.properties[2]).toEqual({ name: 'age', type: { kind: 'primitive', type: 'number' }, optional: false, readonly: false });
      expect(user!.properties[3]).toEqual({ name: 'active', type: { kind: 'primitive', type: 'boolean' }, optional: false, readonly: false });
    }
  });

  it('should parse optional and readonly properties', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      interface Config {
        readonly id: string;
        name?: string;
        readonly label?: string;
      }
    `);

    const config = result.types.get('Config');
    expect(config!.kind).toBe('object');
    if (config!.kind === 'object') {
      expect(config!.properties[0]).toEqual({ name: 'id', type: { kind: 'primitive', type: 'string' }, optional: false, readonly: true });
      expect(config!.properties[1]).toEqual({ name: 'name', type: { kind: 'primitive', type: 'string' }, optional: true, readonly: false });
      expect(config!.properties[2]).toEqual({ name: 'label', type: { kind: 'primitive', type: 'string' }, optional: true, readonly: true });
    }
  });

  it('should parse type alias with union', () => {
    const parser = new TypeParser();
    const result = parser.parse(`type Status = 'active' | 'inactive' | 'pending';`);

    const status = result.types.get('Status');
    expect(status!.kind).toBe('union');
    if (status!.kind === 'union') {
      expect(status!.members).toHaveLength(3);
      expect(status!.members[0]).toEqual({ kind: 'literal', value: 'active' });
      expect(status!.members[1]).toEqual({ kind: 'literal', value: 'inactive' });
      expect(status!.members[2]).toEqual({ kind: 'literal', value: 'pending' });
    }
  });

  it('should parse enum', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      enum Color {
        Red = 'red',
        Green = 'green',
        Blue = 'blue',
      }
    `);

    const color = result.types.get('Color');
    expect(color!.kind).toBe('enum');
    if (color!.kind === 'enum') {
      expect(color!.members).toEqual([
        { name: 'Red', value: 'red' },
        { name: 'Green', value: 'green' },
        { name: 'Blue', value: 'blue' },
      ]);
    }
  });

  it('should parse numeric enum', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      enum Priority { Low, Medium, High }
    `);

    const priority = result.types.get('Priority');
    expect(priority!.kind).toBe('enum');
    if (priority!.kind === 'enum') {
      expect(priority!.members).toEqual([
        { name: 'Low', value: 0 },
        { name: 'Medium', value: 1 },
        { name: 'High', value: 2 },
      ]);
    }
  });

  it('should parse array types', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      interface Data {
        tags: string[];
        items: Array<number>;
        nested: boolean[][];
      }
    `);

    const data = result.types.get('Data');
    if (data!.kind === 'object') {
      expect(data!.properties[0].type).toEqual({ kind: 'array', elementType: { kind: 'primitive', type: 'string' } });
      expect(data!.properties[1].type).toEqual({ kind: 'array', elementType: { kind: 'primitive', type: 'number' } });
      expect(data!.properties[2].type).toEqual({
        kind: 'array', elementType: { kind: 'array', elementType: { kind: 'primitive', type: 'boolean' } }
      });
    }
  });

  it('should parse nested object types', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      interface User {
        profile: {
          bio: string;
          avatar: string;
        };
      }
    `);

    const user = result.types.get('User');
    if (user!.kind === 'object') {
      const profile = user!.properties[0].type;
      expect(profile.kind).toBe('object');
      if (profile.kind === 'object') {
        expect(profile.properties).toHaveLength(2);
        expect(profile.properties[0].name).toBe('bio');
        expect(profile.properties[1].name).toBe('avatar');
      }
    }
  });

  it('should parse Record type', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      type Dict = Record<string, number>;
    `);

    const dict = result.types.get('Dict');
    expect(dict!.kind).toBe('record');
    if (dict!.kind === 'record') {
      expect(dict!.keyType).toEqual({ kind: 'primitive', type: 'string' });
      expect(dict!.valueType).toEqual({ kind: 'primitive', type: 'number' });
    }
  });

  it('should parse intersection types', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      type Extended = { name: string } & { age: number };
    `);

    const ext = result.types.get('Extended');
    expect(ext!.kind).toBe('intersection');
  });

  it('should parse interface with extends', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      interface Base {
        id: string;
      }
      interface User extends Base {
        name: string;
      }
    `);

    const user = result.types.get('User');
    if (user!.kind === 'object') {
      // Should have merged properties from Base
      expect(user!.properties).toHaveLength(2);
      expect(user!.properties[0].name).toBe('id');
      expect(user!.properties[1].name).toBe('name');
    }
  });

  it('should parse export keyword', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      export interface User { name: string; }
      export type Status = 'active' | 'inactive';
    `);

    expect(result.types.has('User')).toBe(true);
    expect(result.types.has('Status')).toBe(true);
  });

  it('should parse tuple types', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      type Pair = [string, number];
    `);

    const pair = result.types.get('Pair');
    expect(pair!.kind).toBe('tuple');
    if (pair!.kind === 'tuple') {
      expect(pair!.elements).toHaveLength(2);
      expect(pair!.elements[0]).toEqual({ kind: 'primitive', type: 'string' });
      expect(pair!.elements[1]).toEqual({ kind: 'primitive', type: 'number' });
    }
  });

  it('should parse utility type references', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      interface User { id: string; name: string; email: string; }
      type PartialUser = Partial<User>;
    `);

    const partialUser = result.types.get('PartialUser');
    expect(partialUser!.kind).toBe('reference');
    if (partialUser!.kind === 'reference') {
      expect(partialUser!.name).toBe('Partial');
      expect(partialUser!.typeArguments).toHaveLength(1);
    }
  });

  it('should parse complex nested types', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      interface Product {
        id: string;
        name: string;
        price: number;
        variants: Array<{
          color: string;
          size: 'S' | 'M' | 'L' | 'XL';
          stock: number;
        }>;
        metadata: Record<string, string | number>;
      }
    `);

    const product = result.types.get('Product');
    expect(product!.kind).toBe('object');
    if (product!.kind === 'object') {
      expect(product!.properties).toHaveLength(5);

      // variants should be Array<object>
      const variants = product!.properties[3].type;
      expect(variants.kind).toBe('array');

      // metadata should be Record<string, string|number>
      const metadata = product!.properties[4].type;
      expect(metadata.kind).toBe('record');
    }
  });

  it('should parse Date type', () => {
    const parser = new TypeParser();
    const result = parser.parse(`interface Event { date: Date; }`);

    const event = result.types.get('Event');
    if (event!.kind === 'object') {
      expect(event!.properties[0].type).toEqual({ kind: 'primitive', type: 'Date' });
    }
  });

  it('should parse multiple types', () => {
    const parser = new TypeParser();
    const result = parser.parse(`
      interface User { name: string; }
      interface Post { title: string; author: User; }
      type PostList = Post[];
    `);

    expect(result.types.size).toBe(3);
    expect(result.defaultType).toBe('User');
  });
});
