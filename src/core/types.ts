// ============================================================
// MockSchema - The schema users provide to generate mock data
// ============================================================

export interface MockSchema {
  /** Inline TypeScript type definition as string (works in browser + Node) */
  typeDefinition?: string;
  /** Name of the type to use (required when multiple types exist) */
  typeName?: string;
  /** Path to .ts file containing the type (Node/CLI only) */
  pathType?: string;
  /** Line range to extract specific type from a multi-type file */
  startLine?: number;
  endLine?: number;

  /** Data generation configuration */
  dataConfig?: DataConfig;

  /** Save response to file (CLI only). false = don't save */
  responseSave?: false | { path: string };
}

export interface DataConfig {
  request?: RequestConfig;
  response?: Record<string, unknown>;
}

export interface RequestConfig {
  page?: number;
  limit?: number;
  perPage?: number;
  totalPage?: number;
  responseType?: 'single' | 'list';
}

// ============================================================
// AST - Internal type system produced by the parser
// ============================================================

export type TypeNode =
  | PrimitiveTypeNode
  | LiteralTypeNode
  | ObjectTypeNode
  | ArrayTypeNode
  | TupleTypeNode
  | UnionTypeNode
  | IntersectionTypeNode
  | ReferenceTypeNode
  | EnumTypeNode
  | RecordTypeNode
  | IndexedAccessTypeNode
  | FunctionTypeNode;

export interface PrimitiveTypeNode {
  kind: 'primitive';
  type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'any' | 'unknown' | 'void' | 'never' | 'bigint' | 'symbol' | 'object' | 'Date';
}

export interface LiteralTypeNode {
  kind: 'literal';
  value: string | number | boolean;
}

export interface ObjectTypeNode {
  kind: 'object';
  properties: PropertyNode[];
}

export interface ArrayTypeNode {
  kind: 'array';
  elementType: TypeNode;
}

export interface TupleTypeNode {
  kind: 'tuple';
  elements: TypeNode[];
}

export interface UnionTypeNode {
  kind: 'union';
  members: TypeNode[];
}

export interface IntersectionTypeNode {
  kind: 'intersection';
  members: TypeNode[];
}

export interface ReferenceTypeNode {
  kind: 'reference';
  name: string;
  typeArguments?: TypeNode[];
}

export interface EnumTypeNode {
  kind: 'enum';
  members: Array<{ name: string; value?: string | number }>;
}

export interface RecordTypeNode {
  kind: 'record';
  keyType: TypeNode;
  valueType: TypeNode;
}

export interface IndexedAccessTypeNode {
  kind: 'indexed-access';
  objectType: TypeNode;
  indexType: TypeNode;
}

export interface FunctionTypeNode {
  kind: 'function';
}

export interface PropertyNode {
  name: string;
  type: TypeNode;
  optional: boolean;
  readonly: boolean;
}

// ============================================================
// Token types for the lexer
// ============================================================

export enum TokenType {
  // Identifiers & Keywords
  Identifier = 'Identifier',
  Keyword = 'Keyword',

  // Literals
  StringLiteral = 'StringLiteral',
  NumberLiteral = 'NumberLiteral',
  BooleanLiteral = 'BooleanLiteral',

  // Punctuation
  OpenBrace = 'OpenBrace',       // {
  CloseBrace = 'CloseBrace',     // }
  OpenParen = 'OpenParen',       // (
  CloseParen = 'CloseParen',     // )
  OpenBracket = 'OpenBracket',   // [
  CloseBracket = 'CloseBracket', // ]
  LessThan = 'LessThan',        // <
  GreaterThan = 'GreaterThan',   // >
  Comma = 'Comma',               // ,
  Semicolon = 'Semicolon',       // ;
  Colon = 'Colon',               // :
  Question = 'Question',         // ?
  Pipe = 'Pipe',                 // |
  Ampersand = 'Ampersand',       // &
  Equals = 'Equals',             // =
  Dot = 'Dot',                   // .
  Spread = 'Spread',             // ...
  Arrow = 'Arrow',               // =>

  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// ============================================================
// Parser output
// ============================================================

export interface ParseResult {
  types: Map<string, TypeNode>;
  /** The first/default type found */
  defaultType?: string;
}

// ============================================================
// Generator options
// ============================================================

export interface GeneratorOptions {
  /** Faker locale (default: auto-detect) */
  locale?: string;
  /** Seed for reproducible output */
  seed?: number;
  /** Max recursion depth for circular references */
  maxDepth?: number;
  /** Number of items for arrays */
  arrayLength?: { min: number; max: number };
}

// ============================================================
// Client-side createMockServer options
// ============================================================

export interface MockServerOptions {
  /** URL prefix to intercept (default: 'http://localhost:3000') */
  baseURL?: string;
  /** Faker locale (default: auto-detect from browser) */
  locale?: string;
  /** Simulated response delay in ms */
  delay?: number;
  /** Log intercepted requests to console */
  logging?: boolean;
  /** Pre-registered type definitions */
  types?: Record<string, string>;
  /** Generator options */
  generator?: GeneratorOptions;
}

export interface MockServerInstance {
  /** Stop intercepting requests */
  stop: () => void;
  /** Register a type definition for later use by typeName */
  registerType: (name: string, definition: string) => void;
  /** Remove a registered type */
  unregisterType: (name: string) => void;
  /** Generate mock data directly (without HTTP) */
  generate: (schema: MockSchema) => unknown;
}
