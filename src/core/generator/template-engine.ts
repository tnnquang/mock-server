import type { PaginatedResult } from './pagination.js';

/**
 * Apply a response template to generated data.
 * Replaces tokens like {{data}}, {{page}}, {{limit}}, {{total}}, {{totalPages}},
 * and special string values like 'currentPage'.
 */
export function applyTemplate(
  template: Record<string, unknown>,
  result: PaginatedResult | unknown,
): unknown {
  const isPaginated = result && typeof result === 'object' && 'data' in (result as any);
  const paginatedResult = isPaginated ? result as PaginatedResult : null;

  const tokens: Record<string, unknown> = {
    data: paginatedResult ? paginatedResult.data : result,
    page: paginatedResult?.page ?? 1,
    limit: paginatedResult?.limit ?? 1,
    total: paginatedResult?.total ?? 1,
    totalPages: paginatedResult?.totalPages ?? 1,
    currentPage: paginatedResult?.page ?? 1,
  };

  return replaceTokens(template, tokens);
}

function replaceTokens(value: unknown, tokens: Record<string, unknown>): unknown {
  if (value === null || value === undefined) return value;

  // String token replacement
  if (typeof value === 'string') {
    // Exact match: "{{data}}" -> replace entirely (preserves type)
    const exactMatch = value.match(/^\{\{(\w+)\}\}$/);
    if (exactMatch) {
      const key = exactMatch[1];
      return tokens[key] ?? value;
    }

    // Special string values
    if (value === 'currentPage') return tokens.currentPage;

    // Partial replacement: "Page {{page}} of {{totalPages}}" -> string interpolation
    return value.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = tokens[key];
      return val !== undefined ? String(val) : `{{${key}}}`;
    });
  }

  // Array
  if (Array.isArray(value)) {
    return value.map(item => replaceTokens(item, tokens));
  }

  // Object
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = replaceTokens(v, tokens);
    }
    return result;
  }

  return value;
}
