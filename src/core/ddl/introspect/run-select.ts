import type { IntrospectContext } from './context.js';
import type { SelectQueryNode } from '../../ast/query.js';

import { toRows } from './utils.js';

/** A source that can provide a select query AST. */
type SelectQuerySource = { getAST(): SelectQueryNode };

/**
 * Runs a select query from a query builder and returns the results.
 * @param qb - The query builder.
 * @param ctx - The introspection context.
 * @returns The query results.
 */
export async function runSelect<T = Record<string, unknown>>(
  qb: SelectQuerySource,
  ctx: IntrospectContext
): Promise<T[]> {
  const ast = qb.getAST();
  const compiled = ctx.dialect.compileSelect(ast);
  const results = await ctx.executor.executeSql(compiled.sql, compiled.params);
  // executor returns QueryResult[]; take the first result set and map to rows
  const [first] = results;
  return toRows(first) as T[];
}

export default runSelect;

/**
 * Runs a select query from an AST node and returns the results.
 * @param ast - The select query AST.
 * @param ctx - The introspection context.
 * @returns The query results.
 */
export async function runSelectNode<T = Record<string, unknown>>(ast: SelectQueryNode, ctx: IntrospectContext): Promise<T[]> {
  const compiled = ctx.dialect.compileSelect(ast);
  const results = await ctx.executor.executeSql(compiled.sql, compiled.params);
  const [first] = results;
  return toRows(first) as T[];
}
