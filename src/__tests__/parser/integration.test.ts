import { describe, it, expect } from 'vitest';
import { parseAndResolve } from '../../core/parser/index.js';
import { generateFromType } from '../../core/generator/type-mapper.js';

describe('End-to-end: parse -> resolve -> generate', () => {
  it('should handle a real-world User type', () => {
    const resolved = parseAndResolve(`
      interface User {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        age: number;
        isActive: boolean;
        avatar: string;
        createdAt: Date;
        tags: string[];
        address: {
          street: string;
          city: string;
          country: string;
          zip: string;
        };
      }
    `);

    const data = generateFromType(resolved) as any;

    expect(typeof data.id).toBe('string');
    expect(typeof data.firstName).toBe('string');
    expect(typeof data.email).toBe('string');
    expect(typeof data.age).toBe('number');
    expect(typeof data.isActive).toBe('boolean');
    expect(Array.isArray(data.tags)).toBe(true);
    expect(typeof data.address).toBe('object');
    expect(typeof data.address.city).toBe('string');
  });

  it('should handle enum + union', () => {
    const resolved = parseAndResolve(`
      enum Role { Admin = 'admin', User = 'user', Guest = 'guest' }
      type Permission = 'read' | 'write' | 'delete';
      interface Account {
        role: Role;
        permissions: Permission[];
      }
    `, 'Account');

    const data = generateFromType(resolved) as any;
    expect(['admin', 'user', 'guest']).toContain(data.role);
    expect(Array.isArray(data.permissions)).toBe(true);
  });

  it('should handle complex Omit + intersection', () => {
    const resolved = parseAndResolve(`
      interface User {
        id: string;
        name: string;
        email: string;
        password: string;
      }
      type CreateUserDTO = Omit<User, 'id'> & { confirmPassword: string; };
    `, 'CreateUserDTO');

    const data = generateFromType(resolved) as any;
    expect(data.id).toBeUndefined();
    expect(typeof data.name).toBe('string');
    expect(typeof data.email).toBe('string');
    expect(typeof data.confirmPassword).toBe('string');
  });

  it('should handle Record with union keys', () => {
    const resolved = parseAndResolve(`
      type Theme = Record<'primary' | 'secondary' | 'accent', string>;
    `);

    const data = generateFromType(resolved) as any;
    expect(typeof data.primary).toBe('string');
    expect(typeof data.secondary).toBe('string');
    expect(typeof data.accent).toBe('string');
  });

  it('should handle deeply nested types', () => {
    const resolved = parseAndResolve(`
      interface Category {
        id: number;
        name: string;
        subcategories: Category[];
      }
    `);

    const data = generateFromType(resolved, undefined, { maxDepth: 3 }) as any;
    expect(typeof data.id).toBe('number');
    expect(typeof data.name).toBe('string');
    expect(Array.isArray(data.subcategories)).toBe(true);
  });

  it('should handle Partial<Pick<T, K>>', () => {
    const resolved = parseAndResolve(`
      interface Product {
        id: string;
        name: string;
        price: number;
        description: string;
        stock: number;
      }
      type UpdateProduct = Partial<Pick<Product, 'name' | 'price' | 'description'>>;
    `, 'UpdateProduct');

    expect(resolved.kind).toBe('object');
    if (resolved.kind === 'object') {
      expect(resolved.properties).toHaveLength(3);
      expect(resolved.properties.every(p => p.optional)).toBe(true);
      expect(resolved.properties.map(p => p.name).sort()).toEqual(['description', 'name', 'price']);
    }
  });
});
