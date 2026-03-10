import type { TypeNode, PropertyNode } from '../types.js';
import { TypeRegistry } from './type-registry.js';

const MAX_RESOLVE_DEPTH = 10;

/**
 * Resolves type references and utility types (Partial, Pick, Omit, etc.)
 * into fully expanded TypeNode trees.
 */
export class TypeResolver {
  constructor(private registry: TypeRegistry) {}

  /**
   * Resolve a TypeNode, expanding all references and utility types.
   */
  resolve(node: TypeNode, depth = 0): TypeNode {
    if (depth > MAX_RESOLVE_DEPTH) {
      return { kind: 'primitive', type: 'any' };
    }

    switch (node.kind) {
      case 'reference':
        return this.resolveReference(node.name, node.typeArguments, depth);

      case 'union':
        return {
          kind: 'union',
          members: node.members.map(m => this.resolve(m, depth + 1)),
        };

      case 'intersection':
        return this.resolveIntersection(node.members, depth);

      case 'array':
        return { kind: 'array', elementType: this.resolve(node.elementType, depth + 1) };

      case 'tuple':
        return { kind: 'tuple', elements: node.elements.map(e => this.resolve(e, depth + 1)) };

      case 'object':
        return {
          kind: 'object',
          properties: node.properties.map(p => ({
            ...p,
            type: this.resolve(p.type, depth + 1),
          })),
        };

      case 'record':
        return {
          kind: 'record',
          keyType: this.resolve(node.keyType, depth + 1),
          valueType: this.resolve(node.valueType, depth + 1),
        };

      default:
        return node;
    }
  }

  private resolveReference(name: string, typeArgs: TypeNode[] | undefined, depth: number): TypeNode {
    // Built-in utility types
    const utilityHandler = UTILITY_TYPES[name];
    if (utilityHandler && typeArgs) {
      return utilityHandler(this, typeArgs, depth);
    }

    // Look up in registry
    const registered = this.registry.get(name);
    if (registered) {
      return this.resolve(registered, depth + 1);
    }

    // Unknown reference - return as-is (generator will handle as 'any')
    return { kind: 'primitive', type: 'any' };
  }

  resolveIntersection(members: TypeNode[], depth: number): TypeNode {
    const resolvedMembers = members.map(m => this.resolve(m, depth + 1));

    // Try to merge all object types
    const objectMembers: PropertyNode[] = [];
    const nonObjectMembers: TypeNode[] = [];

    for (const m of resolvedMembers) {
      if (m.kind === 'object') {
        objectMembers.push(...m.properties);
      } else {
        nonObjectMembers.push(m);
      }
    }

    if (objectMembers.length > 0 && nonObjectMembers.length === 0) {
      // All objects - merge properties (later ones override)
      const merged = new Map<string, PropertyNode>();
      for (const prop of objectMembers) {
        merged.set(prop.name, prop);
      }
      return { kind: 'object', properties: Array.from(merged.values()) };
    }

    if (nonObjectMembers.length > 0 && objectMembers.length === 0) {
      // No objects - return first non-object type
      return nonObjectMembers[0];
    }

    // Mix of objects and non-objects - return merged object
    if (objectMembers.length > 0) {
      const merged = new Map<string, PropertyNode>();
      for (const prop of objectMembers) {
        merged.set(prop.name, prop);
      }
      return { kind: 'object', properties: Array.from(merged.values()) };
    }

    return resolvedMembers[0] || { kind: 'primitive', type: 'any' };
  }

  // Public helper for utility type handlers
  getProperties(node: TypeNode, depth: number): PropertyNode[] {
    const resolved = this.resolve(node, depth);
    if (resolved.kind === 'object') {
      return resolved.properties;
    }
    return [];
  }

  extractStringLiterals(node: TypeNode): string[] {
    const resolved = this.resolve(node, 0);
    if (resolved.kind === 'literal' && typeof resolved.value === 'string') {
      return [resolved.value];
    }
    if (resolved.kind === 'union') {
      return resolved.members.flatMap(m => this.extractStringLiterals(m));
    }
    return [];
  }
}

// ─── Utility type handlers ──────────────────────────────────

type UtilityHandler = (
  resolver: TypeResolver,
  typeArgs: TypeNode[],
  depth: number,
) => TypeNode;

const UTILITY_TYPES: Record<string, UtilityHandler> = {
  Partial: (resolver, args, depth) => {
    const props = resolver.getProperties(args[0], depth + 1);
    return {
      kind: 'object',
      properties: props.map(p => ({ ...p, optional: true })),
    };
  },

  Required: (resolver, args, depth) => {
    const props = resolver.getProperties(args[0], depth + 1);
    return {
      kind: 'object',
      properties: props.map(p => ({ ...p, optional: false })),
    };
  },

  Readonly: (resolver, args, depth) => {
    const props = resolver.getProperties(args[0], depth + 1);
    return {
      kind: 'object',
      properties: props.map(p => ({ ...p, readonly: true })),
    };
  },

  Pick: (resolver, args, depth) => {
    const props = resolver.getProperties(args[0], depth + 1);
    const keys = resolver.extractStringLiterals(args[1]);
    return {
      kind: 'object',
      properties: props.filter(p => keys.includes(p.name)),
    };
  },

  Omit: (resolver, args, depth) => {
    const props = resolver.getProperties(args[0], depth + 1);
    const keys = resolver.extractStringLiterals(args[1]);
    return {
      kind: 'object',
      properties: props.filter(p => !keys.includes(p.name)),
    };
  },

  Extract: (resolver, args, depth) => {
    const source = resolver.resolve(args[0], depth + 1);
    const target = resolver.resolve(args[1], depth + 1);
    if (source.kind === 'union') {
      return {
        kind: 'union',
        members: source.members.filter(m => isAssignableTo(m, target)),
      };
    }
    return isAssignableTo(source, target) ? source : { kind: 'primitive', type: 'never' };
  },

  Exclude: (resolver, args, depth) => {
    const source = resolver.resolve(args[0], depth + 1);
    const target = resolver.resolve(args[1], depth + 1);
    if (source.kind === 'union') {
      const filtered = source.members.filter(m => !isAssignableTo(m, target));
      if (filtered.length === 0) return { kind: 'primitive', type: 'never' };
      if (filtered.length === 1) return filtered[0];
      return { kind: 'union', members: filtered };
    }
    return isAssignableTo(source, target) ? { kind: 'primitive', type: 'never' } : source;
  },

  NonNullable: (resolver, args, depth) => {
    const source = resolver.resolve(args[0], depth + 1);
    if (source.kind === 'union') {
      const filtered = source.members.filter(
        m => !(m.kind === 'primitive' && (m.type === 'null' || m.type === 'undefined'))
      );
      if (filtered.length === 0) return { kind: 'primitive', type: 'never' };
      if (filtered.length === 1) return filtered[0];
      return { kind: 'union', members: filtered };
    }
    return source;
  },

  // ReturnType, Parameters, etc. -> fallback to any
  ReturnType: () => ({ kind: 'primitive', type: 'any' }),
  Parameters: () => ({ kind: 'array', elementType: { kind: 'primitive', type: 'any' } }),
  InstanceType: () => ({ kind: 'primitive', type: 'any' }),
  ConstructorParameters: () => ({ kind: 'array', elementType: { kind: 'primitive', type: 'any' } }),
};

function isAssignableTo(source: TypeNode, target: TypeNode): boolean {
  if (target.kind === 'primitive' && source.kind === 'primitive') {
    return source.type === target.type;
  }
  if (target.kind === 'literal' && source.kind === 'literal') {
    return source.value === target.value;
  }
  if (target.kind === 'primitive') {
    if (target.type === 'string' && source.kind === 'literal' && typeof source.value === 'string') return true;
    if (target.type === 'number' && source.kind === 'literal' && typeof source.value === 'number') return true;
    if (target.type === 'boolean' && source.kind === 'literal' && typeof source.value === 'boolean') return true;
  }
  return false;
}
