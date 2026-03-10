import { Token, TokenType } from '../types.js';

const KEYWORDS = new Set([
  'interface', 'type', 'enum', 'export', 'extends', 'implements',
  'readonly', 'const', 'keyof', 'typeof', 'infer', 'in', 'out',
  'declare', 'namespace', 'module', 'abstract', 'class',
]);

const PRIMITIVE_TYPES = new Set([
  'string', 'number', 'boolean', 'null', 'undefined',
  'any', 'unknown', 'void', 'never', 'bigint', 'symbol', 'object',
]);

export class Tokenizer {
  private pos = 0;
  private tokens: Token[] = [];

  constructor(private input: string) {}

  tokenize(): Token[] {
    this.tokens = [];
    this.pos = 0;

    while (this.pos < this.input.length) {
      this.skipWhitespaceAndComments();
      if (this.pos >= this.input.length) break;

      const ch = this.input[this.pos];

      // String literals
      if (ch === "'" || ch === '"' || ch === '`') {
        this.tokens.push(this.readStringLiteral());
        continue;
      }

      // Numbers
      if (this.isDigit(ch) || (ch === '-' && this.isDigit(this.peek(1)))) {
        this.tokens.push(this.readNumberLiteral());
        continue;
      }

      // Spread operator or Dot
      if (ch === '.' && this.peek(1) === '.' && this.peek(2) === '.') {
        this.tokens.push({ type: TokenType.Spread, value: '...', position: this.pos });
        this.pos += 3;
        continue;
      }

      // Arrow =>
      if (ch === '=' && this.peek(1) === '>') {
        this.tokens.push({ type: TokenType.Arrow, value: '=>', position: this.pos });
        this.pos += 2;
        continue;
      }

      // Single-character punctuation
      const punctMap: Record<string, TokenType> = {
        '{': TokenType.OpenBrace,
        '}': TokenType.CloseBrace,
        '(': TokenType.OpenParen,
        ')': TokenType.CloseParen,
        '[': TokenType.OpenBracket,
        ']': TokenType.CloseBracket,
        '<': TokenType.LessThan,
        '>': TokenType.GreaterThan,
        ',': TokenType.Comma,
        ';': TokenType.Semicolon,
        ':': TokenType.Colon,
        '?': TokenType.Question,
        '|': TokenType.Pipe,
        '&': TokenType.Ampersand,
        '=': TokenType.Equals,
        '.': TokenType.Dot,
      };

      if (punctMap[ch]) {
        this.tokens.push({ type: punctMap[ch], value: ch, position: this.pos });
        this.pos++;
        continue;
      }

      // Identifiers and keywords
      if (this.isIdentStart(ch)) {
        this.tokens.push(this.readIdentifier());
        continue;
      }

      // Skip unknown characters
      this.pos++;
    }

    this.tokens.push({ type: TokenType.EOF, value: '', position: this.pos });
    return this.tokens;
  }

  private skipWhitespaceAndComments(): void {
    while (this.pos < this.input.length) {
      const ch = this.input[this.pos];

      // Whitespace
      if (/\s/.test(ch)) {
        this.pos++;
        continue;
      }

      // Single-line comment
      if (ch === '/' && this.peek(1) === '/') {
        while (this.pos < this.input.length && this.input[this.pos] !== '\n') {
          this.pos++;
        }
        continue;
      }

      // Multi-line comment
      if (ch === '/' && this.peek(1) === '*') {
        this.pos += 2;
        while (this.pos < this.input.length) {
          if (this.input[this.pos] === '*' && this.peek(1) === '/') {
            this.pos += 2;
            break;
          }
          this.pos++;
        }
        continue;
      }

      break;
    }
  }

  private readStringLiteral(): Token {
    const quote = this.input[this.pos];
    const start = this.pos;
    this.pos++; // skip opening quote
    let value = '';

    while (this.pos < this.input.length && this.input[this.pos] !== quote) {
      if (this.input[this.pos] === '\\') {
        this.pos++; // skip backslash
        if (this.pos < this.input.length) {
          value += this.input[this.pos];
          this.pos++;
        }
      } else {
        value += this.input[this.pos];
        this.pos++;
      }
    }

    this.pos++; // skip closing quote
    return { type: TokenType.StringLiteral, value, position: start };
  }

  private readNumberLiteral(): Token {
    const start = this.pos;
    let value = '';

    if (this.input[this.pos] === '-') {
      value += '-';
      this.pos++;
    }

    while (this.pos < this.input.length && (this.isDigit(this.input[this.pos]) || this.input[this.pos] === '.')) {
      value += this.input[this.pos];
      this.pos++;
    }

    return { type: TokenType.NumberLiteral, value, position: start };
  }

  private readIdentifier(): Token {
    const start = this.pos;
    let value = '';

    while (this.pos < this.input.length && this.isIdentPart(this.input[this.pos])) {
      value += this.input[this.pos];
      this.pos++;
    }

    // Check for boolean literals
    if (value === 'true' || value === 'false') {
      return { type: TokenType.BooleanLiteral, value, position: start };
    }

    // Check for keywords
    if (KEYWORDS.has(value)) {
      return { type: TokenType.Keyword, value, position: start };
    }

    // Check for primitive types - still use Identifier type but the parser will recognize them
    if (PRIMITIVE_TYPES.has(value)) {
      return { type: TokenType.Identifier, value, position: start };
    }

    return { type: TokenType.Identifier, value, position: start };
  }

  private peek(offset: number): string {
    const idx = this.pos + offset;
    return idx < this.input.length ? this.input[idx] : '';
  }

  private isDigit(ch: string): boolean {
    return ch >= '0' && ch <= '9';
  }

  private isIdentStart(ch: string): boolean {
    return /[a-zA-Z_$]/.test(ch);
  }

  private isIdentPart(ch: string): boolean {
    return /[a-zA-Z0-9_$]/.test(ch);
  }
}
