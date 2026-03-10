import type { Token, TypeNode, PropertyNode, ParseResult } from '../types.js';
import { TokenType } from '../types.js';
import { Tokenizer } from './tokenizer.js';
import { TypeRegistry } from './type-registry.js';

const PRIMITIVE_TYPES = new Set([
  'string', 'number', 'boolean', 'null', 'undefined',
  'any', 'unknown', 'void', 'never', 'bigint', 'symbol', 'object',
]);

export class TypeParser {
  private tokens: Token[] = [];
  private pos = 0;
  private registry: TypeRegistry;

  constructor(registry?: TypeRegistry) {
    this.registry = registry ?? new TypeRegistry();
  }

  /**
   * Parse a string containing one or more TypeScript type/interface/enum declarations.
   */
  parse(input: string): ParseResult {
    const tokenizer = new Tokenizer(input);
    this.tokens = tokenizer.tokenize();
    this.pos = 0;

    while (!this.isEOF()) {
      this.parseDeclaration();
    }

    return {
      types: this.registry.getAll(),
      defaultType: this.registry.getDefaultName(),
    };
  }

  getRegistry(): TypeRegistry {
    return this.registry;
  }

  // ─── Declaration parsing ────────────────────────────────────

  private parseDeclaration(): void {
    // Skip 'export', 'declare', 'abstract'
    while (this.check(TokenType.Keyword) &&
           ['export', 'declare', 'abstract'].includes(this.current().value)) {
      this.advance();
    }

    if (this.checkKeyword('interface')) {
      this.parseInterfaceDecl();
    } else if (this.checkKeyword('type')) {
      this.parseTypeAliasDecl();
    } else if (this.checkKeyword('enum') ||
               (this.checkKeyword('const') && this.peekKeyword(1, 'enum'))) {
      this.parseEnumDecl();
    } else {
      // Skip unknown tokens
      this.advance();
    }
  }

  private parseInterfaceDecl(): void {
    this.expect(TokenType.Keyword, 'interface');
    const name = this.expect(TokenType.Identifier).value;

    // Skip generic type parameters
    this.skipGenericParams();

    // Handle extends
    let baseTypes: TypeNode[] = [];
    if (this.checkKeyword('extends')) {
      this.advance();
      baseTypes = this.parseTypeList();
    }

    const properties = this.parseObjectBody();

    // Merge base type properties via intersection (resolved later)
    if (baseTypes.length > 0) {
      const objectNode: TypeNode = { kind: 'object', properties };
      this.registry.register(name, {
        kind: 'intersection',
        members: [...baseTypes, objectNode],
      });
    } else {
      this.registry.register(name, { kind: 'object', properties });
    }
  }

  private parseTypeAliasDecl(): void {
    this.expect(TokenType.Keyword, 'type');
    const name = this.expect(TokenType.Identifier).value;

    // Skip generic type parameters
    this.skipGenericParams();

    this.expect(TokenType.Equals);

    const typeNode = this.parseType();
    this.registry.register(name, typeNode);

    // Optional semicolon
    if (this.check(TokenType.Semicolon)) this.advance();
  }

  private parseEnumDecl(): void {
    // Skip optional 'const'
    if (this.checkKeyword('const')) this.advance();
    this.expect(TokenType.Keyword, 'enum');
    const name = this.expect(TokenType.Identifier).value;

    this.expect(TokenType.OpenBrace);
    const members: Array<{ name: string; value?: string | number }> = [];
    let autoValue = 0;

    while (!this.check(TokenType.CloseBrace) && !this.isEOF()) {
      const memberName = this.expect(TokenType.Identifier).value;
      let value: string | number | undefined;

      if (this.check(TokenType.Equals)) {
        this.advance();
        if (this.check(TokenType.StringLiteral)) {
          value = this.advance().value;
        } else if (this.check(TokenType.NumberLiteral)) {
          value = parseFloat(this.advance().value);
          autoValue = value + 1;
        }
      } else {
        value = autoValue;
        autoValue++;
      }

      members.push({ name: memberName, value });

      if (this.check(TokenType.Comma)) this.advance();
    }

    this.expect(TokenType.CloseBrace);
    this.registry.register(name, { kind: 'enum', members });
  }

  // ─── Type parsing ──────────────────────────────────────────

  parseType(): TypeNode {
    return this.parseUnionType();
  }

  private parseUnionType(): TypeNode {
    // Allow leading pipe: | A | B
    if (this.check(TokenType.Pipe)) this.advance();

    let left = this.parseIntersectionType();

    if (this.check(TokenType.Pipe)) {
      const members: TypeNode[] = [left];
      while (this.check(TokenType.Pipe)) {
        this.advance();
        members.push(this.parseIntersectionType());
      }
      return { kind: 'union', members };
    }

    return left;
  }

  private parseIntersectionType(): TypeNode {
    let left = this.parsePostfixType();

    if (this.check(TokenType.Ampersand)) {
      const members: TypeNode[] = [left];
      while (this.check(TokenType.Ampersand)) {
        this.advance();
        members.push(this.parsePostfixType());
      }
      return { kind: 'intersection', members };
    }

    return left;
  }

  private parsePostfixType(): TypeNode {
    let type = this.parsePrimaryType();

    // Array suffix: Type[] or Type[][]
    while (this.check(TokenType.OpenBracket) && this.peekCheck(1, TokenType.CloseBracket)) {
      this.advance(); // [
      this.advance(); // ]
      type = { kind: 'array', elementType: type };
    }

    return type;
  }

  private parsePrimaryType(): TypeNode {
    const token = this.current();

    // Parenthesized type: (Type)
    if (this.check(TokenType.OpenParen)) {
      this.advance();
      // Check if this is a function type: (a: b) => c
      // Simple heuristic: check if there's identifier followed by colon
      const saved = this.pos;
      if (this.isFunctionType()) {
        this.pos = saved;
        return this.parseFunctionType();
      }
      this.pos = saved;
      const inner = this.parseType();
      this.expect(TokenType.CloseParen);
      return inner;
    }

    // Object literal type: { ... }
    if (this.check(TokenType.OpenBrace)) {
      const properties = this.parseObjectBody();
      return { kind: 'object', properties };
    }

    // Tuple type: [Type, Type]
    if (this.check(TokenType.OpenBracket)) {
      return this.parseTupleType();
    }

    // String literal type
    if (this.check(TokenType.StringLiteral)) {
      this.advance();
      return { kind: 'literal', value: token.value };
    }

    // Number literal type
    if (this.check(TokenType.NumberLiteral)) {
      this.advance();
      return { kind: 'literal', value: parseFloat(token.value) };
    }

    // Boolean literal type
    if (this.check(TokenType.BooleanLiteral)) {
      this.advance();
      return { kind: 'literal', value: token.value === 'true' };
    }

    // keyof Type
    if (this.checkKeyword('keyof')) {
      this.advance();
      const target = this.parsePrimaryType();
      return { kind: 'reference', name: 'keyof', typeArguments: [target] };
    }

    // typeof identifier
    if (this.checkKeyword('typeof')) {
      this.advance();
      const name = this.expect(TokenType.Identifier).value;
      return { kind: 'reference', name: `typeof_${name}` };
    }

    // Identifier (could be primitive, reference, or generic like Array<T>)
    if (this.check(TokenType.Identifier) || this.check(TokenType.Keyword)) {
      return this.parseIdentifierType();
    }

    // Fallback: skip token and return 'any'
    this.advance();
    return { kind: 'primitive', type: 'any' };
  }

  private parseIdentifierType(): TypeNode {
    const name = this.advance().value;

    // Primitive types
    if (PRIMITIVE_TYPES.has(name)) {
      return { kind: 'primitive', type: name as any };
    }

    // Date
    if (name === 'Date') {
      return { kind: 'primitive', type: 'Date' };
    }

    // Array<T>
    if (name === 'Array' && this.check(TokenType.LessThan)) {
      this.advance(); // <
      const elementType = this.parseType();
      this.expect(TokenType.GreaterThan);
      return { kind: 'array', elementType };
    }

    // Promise<T> -> just resolve to T
    if (name === 'Promise' && this.check(TokenType.LessThan)) {
      this.advance(); // <
      const inner = this.parseType();
      this.expect(TokenType.GreaterThan);
      return inner;
    }

    // Record<K, V>
    if (name === 'Record' && this.check(TokenType.LessThan)) {
      this.advance(); // <
      const keyType = this.parseType();
      this.expect(TokenType.Comma);
      const valueType = this.parseType();
      this.expect(TokenType.GreaterThan);
      return { kind: 'record', keyType, valueType };
    }

    // Map<K, V> -> treat as Record
    if (name === 'Map' && this.check(TokenType.LessThan)) {
      this.advance();
      const keyType = this.parseType();
      this.expect(TokenType.Comma);
      const valueType = this.parseType();
      this.expect(TokenType.GreaterThan);
      return { kind: 'record', keyType, valueType };
    }

    // Set<T> -> treat as Array
    if (name === 'Set' && this.check(TokenType.LessThan)) {
      this.advance();
      const elementType = this.parseType();
      this.expect(TokenType.GreaterThan);
      return { kind: 'array', elementType };
    }

    // Generic reference: SomeType<A, B, ...>
    if (this.check(TokenType.LessThan)) {
      const typeArgs = this.parseTypeArguments();
      return { kind: 'reference', name, typeArguments: typeArgs };
    }

    // Simple reference
    return { kind: 'reference', name };
  }

  private parseTupleType(): TypeNode {
    this.expect(TokenType.OpenBracket);
    const elements: TypeNode[] = [];

    while (!this.check(TokenType.CloseBracket) && !this.isEOF()) {
      elements.push(this.parseType());
      if (this.check(TokenType.Comma)) this.advance();
    }

    this.expect(TokenType.CloseBracket);
    return { kind: 'tuple', elements };
  }

  private parseFunctionType(): TypeNode {
    // Skip to => and then the return type
    let depth = 1;
    this.advance(); // skip (
    while (!this.isEOF() && depth > 0) {
      if (this.check(TokenType.OpenParen)) depth++;
      if (this.check(TokenType.CloseParen)) depth--;
      this.advance();
    }
    // Now expect =>
    if (this.check(TokenType.Arrow)) {
      this.advance();
      this.parseType(); // skip return type
    }
    return { kind: 'function' };
  }

  // ─── Object body parsing ───────────────────────────────────

  private parseObjectBody(): PropertyNode[] {
    this.expect(TokenType.OpenBrace);
    const properties: PropertyNode[] = [];

    while (!this.check(TokenType.CloseBrace) && !this.isEOF()) {
      // Skip index signatures: [key: string]: value
      if (this.check(TokenType.OpenBracket)) {
        this.skipIndexSignature();
        continue;
      }

      const prop = this.parseProperty();
      if (prop) properties.push(prop);

      // Skip semicolons and commas
      while (this.check(TokenType.Semicolon) || this.check(TokenType.Comma)) {
        this.advance();
      }
    }

    this.expect(TokenType.CloseBrace);
    return properties;
  }

  private parseProperty(): PropertyNode | null {
    let readonly = false;

    // 'readonly' modifier
    if (this.checkKeyword('readonly')) {
      readonly = true;
      this.advance();
    }

    // Property name (identifier, string literal, or keyword used as name)
    let name: string;
    if (this.check(TokenType.Identifier) || this.check(TokenType.Keyword)) {
      name = this.advance().value;
    } else if (this.check(TokenType.StringLiteral)) {
      name = this.advance().value;
    } else {
      return null;
    }

    // Check for method signature: name(args): ReturnType or name<T>(args): ReturnType
    if (this.check(TokenType.OpenParen) || this.check(TokenType.LessThan)) {
      this.skipMethodSignature();
      return { name, type: { kind: 'function' }, optional: false, readonly };
    }

    // Optional marker
    let optional = false;
    if (this.check(TokenType.Question)) {
      optional = true;
      this.advance();
    }

    this.expect(TokenType.Colon);
    const type = this.parseType();

    return { name, type, optional, readonly };
  }

  // ─── Helpers ───────────────────────────────────────────────

  private parseTypeArguments(): TypeNode[] {
    this.expect(TokenType.LessThan);
    const args: TypeNode[] = [];
    let depth = 1;

    while (!this.isEOF() && depth > 0) {
      if (depth === 1 && this.check(TokenType.GreaterThan)) {
        break;
      }
      args.push(this.parseType());
      if (this.check(TokenType.Comma) && depth === 1) {
        this.advance();
      }
      // Update depth for nested <>
      if (this.check(TokenType.GreaterThan)) {
        break;
      }
    }

    this.expect(TokenType.GreaterThan);
    return args;
  }

  private parseTypeList(): TypeNode[] {
    const types: TypeNode[] = [];
    types.push(this.parseType());
    while (this.check(TokenType.Comma)) {
      this.advance();
      types.push(this.parseType());
    }
    return types;
  }

  private skipGenericParams(): void {
    if (!this.check(TokenType.LessThan)) return;
    let depth = 0;
    while (!this.isEOF()) {
      if (this.check(TokenType.LessThan)) depth++;
      if (this.check(TokenType.GreaterThan)) {
        depth--;
        this.advance();
        if (depth === 0) return;
        continue;
      }
      this.advance();
    }
  }

  private skipIndexSignature(): void {
    let depth = 1;
    this.advance(); // skip [
    while (!this.isEOF() && depth > 0) {
      if (this.check(TokenType.OpenBracket)) depth++;
      if (this.check(TokenType.CloseBracket)) depth--;
      this.advance();
    }
    // Skip : Type
    if (this.check(TokenType.Colon)) {
      this.advance();
      this.parseType();
    }
    // Skip semicolons
    while (this.check(TokenType.Semicolon) || this.check(TokenType.Comma)) {
      this.advance();
    }
  }

  private skipMethodSignature(): void {
    // Skip generic params
    if (this.check(TokenType.LessThan)) {
      this.skipGenericParams();
    }
    // Skip params
    if (this.check(TokenType.OpenParen)) {
      let depth = 1;
      this.advance();
      while (!this.isEOF() && depth > 0) {
        if (this.check(TokenType.OpenParen)) depth++;
        if (this.check(TokenType.CloseParen)) depth--;
        this.advance();
      }
    }
    // Skip return type
    if (this.check(TokenType.Colon)) {
      this.advance();
      this.parseType();
    }
  }

  private isFunctionType(): boolean {
    // Heuristic: check if this looks like (param: type, ...) =>
    let depth = 1;
    let pos = this.pos;
    while (pos < this.tokens.length && depth > 0) {
      const t = this.tokens[pos];
      if (t.type === TokenType.OpenParen) depth++;
      if (t.type === TokenType.CloseParen) depth--;
      pos++;
    }
    // Check if next token is =>
    if (pos < this.tokens.length && this.tokens[pos].type === TokenType.Arrow) {
      return true;
    }
    return false;
  }

  private collectProperties(types: TypeNode[]): PropertyNode[] {
    const props: PropertyNode[] = [];
    for (const t of types) {
      if (t.kind === 'object') {
        props.push(...t.properties);
      }
    }
    return props;
  }

  // ─── Token access ─────────────────────────────────────────

  private current(): Token {
    return this.tokens[this.pos] || { type: TokenType.EOF, value: '', position: -1 };
  }

  private advance(): Token {
    const token = this.current();
    this.pos++;
    return token;
  }

  private check(type: TokenType): boolean {
    return this.current().type === type;
  }

  private checkKeyword(value: string): boolean {
    return this.current().type === TokenType.Keyword && this.current().value === value;
  }

  private peekCheck(offset: number, type: TokenType): boolean {
    const idx = this.pos + offset;
    return idx < this.tokens.length && this.tokens[idx].type === type;
  }

  private peekKeyword(offset: number, value: string): boolean {
    const idx = this.pos + offset;
    return idx < this.tokens.length &&
           this.tokens[idx].type === TokenType.Keyword &&
           this.tokens[idx].value === value;
  }

  private expect(type: TokenType, value?: string): Token {
    const token = this.current();
    if (token.type !== type || (value !== undefined && token.value !== value)) {
      throw new Error(
        `Parser error at position ${token.position}: expected ${type}${value ? ` "${value}"` : ''}, got ${token.type} "${token.value}"`
      );
    }
    return this.advance();
  }

  private isEOF(): boolean {
    return this.current().type === TokenType.EOF;
  }
}
