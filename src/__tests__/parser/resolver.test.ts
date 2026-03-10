import { describe, it, expect } from 'vitest';
import { TypeParser } from '../../core/parser/parser.js';
import { TypeResolver } from '../../core/parser/resolver.js';
import { parseAndResolve } from '../../core/parser/index.js';

describe('TypeResolver', () => {
  it('should resolve Partial<T>', () => {
    const resolved = parseAndResolve(`
      interface User { id: string; name: string; email: string; }
      type PartialUser = Partial<User>;
    `, 'PartialUser');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties).toHaveLength(3);
      expect(resolved.properties.every(p => p.optional)).toBe(true);
    }
  });

  it('should resolve Required<T>', () => {
    const resolved = parseAndResolve(`
      interface Config { name?: string; value?: number; }
      type RequiredConfig = Required<Config>;
    `, 'RequiredConfig');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties.every(p => !p.optional)).toBe(true);
    }
  });

  it('should resolve Pick<T, K>', () => {
    const resolved = parseAndResolve(`
      interface User { id: string; name: string; email: string; age: number; }
      type UserPreview = Pick<User, 'name' | 'email'>;
    `, 'UserPreview');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties).toHaveLength(2);
      expect(resolved.properties.map(p => p.name)).toEqual(['name', 'email']);
    }
  });

  it('should resolve Omit<T, K>', () => {
    const resolved = parseAndResolve(`
      interface User { id: string; name: string; email: string; password: string; }
      type SafeUser = Omit<User, 'password'>;
    `, 'SafeUser');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties).toHaveLength(3);
      expect(resolved.properties.map(p => p.name)).toEqual(['id', 'name', 'email']);
    }
  });

  it('should resolve Readonly<T>', () => {
    const resolved = parseAndResolve(`
      interface Data { value: number; }
      type ReadonlyData = Readonly<Data>;
    `, 'ReadonlyData');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties.every(p => p.readonly)).toBe(true);
    }
  });

  it('should resolve nested utility types: Partial<Pick<T, K>>', () => {
    const resolved = parseAndResolve(`
      interface User { id: string; name: string; email: string; age: number; }
      type PartialPreview = Partial<Pick<User, 'name' | 'email'>>;
    `, 'PartialPreview');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties).toHaveLength(2);
      expect(resolved.properties.every(p => p.optional)).toBe(true);
    }
  });

  it('should resolve type references', () => {
    const resolved = parseAndResolve(`
      interface Address { city: string; country: string; }
      interface User { name: string; address: Address; }
    `, 'User');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      const addressProp = resolved.properties.find(p => p.name === 'address');
      expect(addressProp!.type.kind).toBe('object');
    }
  });

  it('should resolve intersection types', () => {
    const resolved = parseAndResolve(`
      type A = { x: number; };
      type B = { y: string; };
      type C = A & B;
    `, 'C');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties).toHaveLength(2);
      expect(resolved.properties.map(p => p.name)).toEqual(['x', 'y']);
    }
  });

  it('should resolve NonNullable<T>', () => {
    const resolved = parseAndResolve(`
      type MaybeString = string | null | undefined;
      type DefiniteString = NonNullable<MaybeString>;
    `, 'DefiniteString');

    expect(resolved.kind).toBe('primitive');
    if (resolved.kind === 'primitive') {
      expect(resolved.type).toBe('string');
    }
  });

  it('should resolve Exclude<T, U>', () => {
    const resolved = parseAndResolve(`
      type AllTypes = string | number | boolean;
      type NotBoolean = Exclude<AllTypes, boolean>;
    `, 'NotBoolean');

    expect(resolved.kind).toBe('union');
    if (resolved.kind === 'union') {
      expect(resolved.members).toHaveLength(2);
    }
  });

  it('should handle default type (first declared)', () => {
    const resolved = parseAndResolve(`
      interface Product { name: string; price: number; }
      interface Category { label: string; }
    `);

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties.map(p => p.name)).toEqual(['name', 'price']);
    }
  });
});
