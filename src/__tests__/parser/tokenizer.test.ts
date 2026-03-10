import { describe, it, expect } from 'vitest';
import { Tokenizer } from '../../core/parser/tokenizer.js';
import { TokenType } from '../../core/types.js';

describe('Tokenizer', () => {
  it('should tokenize a simple interface', () => {
    const input = 'interface User { name: string; }';
    const tokens = new Tokenizer(input).tokenize();

    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.Keyword, value: 'interface' }));
    expect(tokens[1]).toEqual(expect.objectContaining({ type: TokenType.Identifier, value: 'User' }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.OpenBrace }));
    expect(tokens[3]).toEqual(expect.objectContaining({ type: TokenType.Identifier, value: 'name' }));
    expect(tokens[4]).toEqual(expect.objectContaining({ type: TokenType.Colon }));
    expect(tokens[5]).toEqual(expect.objectContaining({ type: TokenType.Identifier, value: 'string' }));
    expect(tokens[6]).toEqual(expect.objectContaining({ type: TokenType.Semicolon }));
    expect(tokens[7]).toEqual(expect.objectContaining({ type: TokenType.CloseBrace }));
    expect(tokens[8]).toEqual(expect.objectContaining({ type: TokenType.EOF }));
  });

  it('should handle string literals', () => {
    const tokens = new Tokenizer(`'hello' | "world"`).tokenize();
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.StringLiteral, value: 'hello' }));
    expect(tokens[1]).toEqual(expect.objectContaining({ type: TokenType.Pipe }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.StringLiteral, value: 'world' }));
  });

  it('should handle number literals', () => {
    const tokens = new Tokenizer('42 | -3.14').tokenize();
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.NumberLiteral, value: '42' }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.NumberLiteral, value: '-3.14' }));
  });

  it('should handle boolean literals', () => {
    const tokens = new Tokenizer('true | false').tokenize();
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.BooleanLiteral, value: 'true' }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.BooleanLiteral, value: 'false' }));
  });

  it('should skip single-line comments', () => {
    const tokens = new Tokenizer('string // comment\nnumber').tokenize();
    expect(tokens.filter(t => t.type !== TokenType.EOF).map(t => t.value)).toEqual(['string', 'number']);
  });

  it('should skip multi-line comments', () => {
    const tokens = new Tokenizer('string /* comment */ number').tokenize();
    expect(tokens.filter(t => t.type !== TokenType.EOF).map(t => t.value)).toEqual(['string', 'number']);
  });

  it('should handle generic syntax', () => {
    const tokens = new Tokenizer('Partial<User>').tokenize();
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.Identifier, value: 'Partial' }));
    expect(tokens[1]).toEqual(expect.objectContaining({ type: TokenType.LessThan }));
    expect(tokens[2]).toEqual(expect.objectContaining({ type: TokenType.Identifier, value: 'User' }));
    expect(tokens[3]).toEqual(expect.objectContaining({ type: TokenType.GreaterThan }));
  });

  it('should handle spread operator', () => {
    const tokens = new Tokenizer('...args').tokenize();
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.Spread, value: '...' }));
  });

  it('should handle arrow', () => {
    const tokens = new Tokenizer('=>').tokenize();
    expect(tokens[0]).toEqual(expect.objectContaining({ type: TokenType.Arrow, value: '=>' }));
  });

  it('should handle optional property marker', () => {
    const tokens = new Tokenizer('name?: string').tokenize();
    expect(tokens[1]).toEqual(expect.objectContaining({ type: TokenType.Question }));
  });
});
