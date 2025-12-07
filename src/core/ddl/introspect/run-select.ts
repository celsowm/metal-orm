import type { SelectQueryBuilder } from '../../../query-builder/select.js';
import type { IntrospectContext } from './context.js';

import { toRows } from './utils.js';

export async function runSelect<T = Record<string, any>>(
  qb: SelectQueryBuilder<any, any>,
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

export async function runSelectNode<T = Record<string, any>>(ast: any, ctx: IntrospectContext): Promise<T[]> {
  const compiled = ctx.dialect.compileSelect(ast);
  const results = await ctx.executor.executeSql(compiled.sql, compiled.params);
  const [first] = results;
  return toRows(first) as T[];
}
