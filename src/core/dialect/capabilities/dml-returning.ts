/** Optional dialect capability for INSERT/UPDATE/DELETE RETURNING/OUTPUT. */
export interface DmlReturningCapability {
  supportsDmlReturningClause(): boolean;
}

export const hasDmlReturningCapability = (
  value: unknown
): value is DmlReturningCapability =>
  typeof (value as { supportsDmlReturningClause?: unknown } | null)?.supportsDmlReturningClause === 'function';

export const supportsDmlReturning = (value: unknown): boolean =>
  hasDmlReturningCapability(value) && value.supportsDmlReturningClause();
