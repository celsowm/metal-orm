/**
 * Pagination utility functions for DTO responses.
 * Converts basic PaginatedResult to enhanced PagedResponse with computed metadata.
 */

import type { PaginatedResult } from '../query-builder/select.js';
import type { PagedResponse } from './dto-types.js';

/**
 * Converts PaginatedResult to PagedResponse with computed metadata.
 *
 * @param result - The basic paginated result from executePaged()
 * @returns Enhanced paginated response with totalPages, hasNextPage, hasPrevPage
 *
 * @example
 * ```ts
 * // In your controller
 * const basic = await qb.executePaged(session, { page: 2, pageSize: 20 });
 * const response = toPagedResponse(basic);
 * return res.json(response);
 * // → { items: [...], totalItems: 150, page: 2, pageSize: 20,
 * //     totalPages: 8, hasNextPage: true, hasPrevPage: true }
 * ```
 */
export function toPagedResponse<T>(
  result: PaginatedResult<T>
): PagedResponse<T> {
  const { items, totalItems, page, pageSize } = result;

  const totalPages = calculateTotalPages(totalItems, pageSize);
  const next = hasNextPage(page, totalPages);
  const prev = hasPrevPage(page);

  return {
    items,
    totalItems,
    page,
    pageSize,
    totalPages,
    hasNextPage: next,
    hasPrevPage: prev,
  };
}

/**
 * Creates a reusable toPagedResponse function with fixed pageSize.
 * Useful when your API uses a consistent page size across all endpoints.
 *
 * @param fixedPageSize - The fixed page size to use
 * @returns A function that converts PaginatedResult to PagedResponse
 *
 * @example
 * ```ts
 * const toUserPagedResponse = toPagedResponseBuilder<UserResponse>(20);
 *
 * app.get('/users', async (req, res) => {
 *   const basic = await qb.executePaged(session, { page: req.query.page || 1, pageSize: 20 });
 *   const response = toUserPagedResponse(basic);
 *   res.json(response);
 * });
 * ```
 */
export function toPagedResponseBuilder<T>(
  fixedPageSize: number
): (result: Omit<PaginatedResult<T>, 'pageSize'> & { pageSize?: number }) => PagedResponse<T> {
  return (result) => toPagedResponse({
    ...result,
    pageSize: fixedPageSize,
  });
}

/**
 * Calculates total pages from total items and page size.
 *
 * @param totalItems - Total number of items
 * @param pageSize - Number of items per page
 * @returns Total number of pages (minimum 1)
 *
 * @example
 * ```ts
 * const totalPages = calculateTotalPages(150, 20); // → 8
 * const totalPages = calculateTotalPages(150, 50); // → 3
 * ```
 */
export function calculateTotalPages(totalItems: number, pageSize: number): number {
  if (pageSize <= 0) {
    throw new Error('pageSize must be greater than 0');
  }
  return Math.max(1, Math.ceil(totalItems / pageSize));
}

/**
 * Checks if there is a next page.
 *
 * @param currentPage - Current page number (1-based)
 * @param totalPages - Total number of pages
 * @returns true if there is a next page
 *
 * @example
 * ```ts
 * const hasNext = hasNextPage(2, 8); // → true
 * const hasNext = hasNextPage(8, 8); // → false
 * ```
 */
export function hasNextPage(currentPage: number, totalPages: number): boolean {
  return currentPage < totalPages;
}

/**
 * Checks if there is a previous page.
 *
 * @param currentPage - Current page number (1-based)
 * @returns true if there is a previous page
 *
 * @example
 * ```ts
 * const hasPrev = hasPrevPage(2); // → true
 * const hasPrev = hasPrevPage(1); // → false
 * ```
 */
export function hasPrevPage(currentPage: number): boolean {
  return currentPage > 1;
}

/**
 * Computes all pagination metadata from basic pagination info.
 *
 * @param totalItems - Total number of items
 * @param page - Current page number (1-based)
 * @param pageSize - Number of items per page
 * @returns Object with totalPages, hasNextPage, hasPrevPage
 *
 * @example
 * ```ts
 * const meta = computePaginationMetadata(150, 2, 20);
 * // → { totalPages: 8, hasNextPage: true, hasPrevPage: true }
 * ```
 */
export function computePaginationMetadata(
  totalItems: number,
  page: number,
  pageSize: number
): Pick<PagedResponse<unknown>, 'totalPages' | 'hasNextPage' | 'hasPrevPage'> {
  const totalPages = calculateTotalPages(totalItems, pageSize);
  return {
    totalPages,
    hasNextPage: hasNextPage(page, totalPages),
    hasPrevPage: hasPrevPage(page),
  };
}
