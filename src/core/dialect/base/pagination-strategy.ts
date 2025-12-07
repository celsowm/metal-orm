/**
 * Strategy interface for compiling pagination clauses.
 * Allows dialects to customize how pagination (LIMIT/OFFSET, ROWS FETCH, etc.) is generated.
 */
export interface PaginationStrategy {
  /**
   * Compiles pagination logic into SQL clause.
   * @param limit - The limit value, if present.
   * @param offset - The offset value, if present.
   * @returns SQL pagination clause (e.g., " LIMIT 10 OFFSET 0") or empty string if no pagination.
   */
  compilePagination(limit?: number, offset?: number): string;
}

/**
 * Standard SQL pagination using LIMIT and OFFSET.
 * Implements the ANSI SQL-style pagination with LIMIT/OFFSET syntax.
 */
export class StandardLimitOffsetPagination implements PaginationStrategy {
  /**
   * Compiles LIMIT/OFFSET pagination clause.
   * @param limit - The maximum number of rows to return.
   * @param offset - The number of rows to skip.
   * @returns SQL pagination clause with LIMIT and/or OFFSET.
   */
  compilePagination(limit?: number, offset?: number): string {
    const parts: string[] = [];
    if (limit !== undefined) parts.push(`LIMIT ${limit}`);
    if (offset !== undefined) parts.push(`OFFSET ${offset}`);
    return parts.length ? ` ${parts.join(' ')}` : '';
  }
}
