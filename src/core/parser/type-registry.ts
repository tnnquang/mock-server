import type { TypeNode } from '../types.js';

/**
 * Stores parsed type definitions for cross-referencing.
 * Used by the resolver to look up type references.
 */
export class TypeRegistry {
  private types = new Map<string, TypeNode>();
  private order: string[] = [];

  register(name: string, node: TypeNode): void {
    if (!this.types.has(name)) {
      this.order.push(name);
    }
    this.types.set(name, node);
  }

  get(name: string): TypeNode | undefined {
    return this.types.get(name);
  }

  has(name: string): boolean {
    return this.types.has(name);
  }

  /** Returns the first registered type name */
  getDefaultName(): string | undefined {
    return this.order[0];
  }

  getAll(): Map<string, TypeNode> {
    return new Map(this.types);
  }

  clear(): void {
    this.types.clear();
    this.order = [];
  }
}
