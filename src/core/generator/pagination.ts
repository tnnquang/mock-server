import type { RequestConfig } from '../types.js';

export interface PaginatedResult {
  data: unknown;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * Wrap generated data with pagination info.
 * If responseType is 'single', returns data as-is.
 * If responseType is 'list', wraps in pagination envelope.
 */
export function applyPagination(
  items: unknown[],
  config?: RequestConfig,
): PaginatedResult | unknown {
  if (!config || config.responseType !== 'list') {
    // Single mode: return first item
    return items[0] ?? null;
  }

  const page = config.page ?? 1;
  const limit = config.perPage ?? config.limit ?? 10;
  const totalPages = config.totalPage ?? Math.max(1, Math.ceil(items.length / limit));
  const total = items.length > limit ? items.length : totalPages * limit;

  return {
    data: items.slice(0, limit),
    page,
    limit,
    total,
    totalPages,
  };
}
