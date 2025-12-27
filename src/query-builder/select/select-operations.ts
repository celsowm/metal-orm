import { TableDef } from '../../schema/table.js';
import { ColumnDef } from '../../schema/column-types.js';
import { OrderingTerm, SelectQueryNode } from '../../core/ast/query.js';
import { FunctionNode, ExpressionNode, exists, notExists } from '../../core/ast/expression.js';
import { derivedTable } from '../../core/ast/builders.js';
import { SelectQueryState } from '../select-query-state.js';
import { SelectQueryBuilderContext, SelectQueryBuilderEnvironment } from '../select-query-builder-deps.js';
import { SelectPredicateFacet } from './predicate-facet.js';
import { SelectRelationFacet } from './relation-facet.js';
import { ORDER_DIRECTIONS, OrderDirection } from '../../core/sql/sql.js';
import { OrmSession } from '../../orm/orm-session.js';
import type { SelectQueryBuilder } from '../select.js';

export type WhereHasOptions = {
  correlate?: ExpressionNode;
};

export type RelationCallback = <TChildTable extends TableDef>(
  qb: SelectQueryBuilder<unknown, TChildTable>
) => SelectQueryBuilder<unknown, TChildTable>;

type ChildBuilderFactory = <R, TChild extends TableDef>(table: TChild) => SelectQueryBuilder<R, TChild>;

/**
 * Builds a new query context with an ORDER BY clause applied.
 */
export function applyOrderBy(
  context: SelectQueryBuilderContext,
  predicateFacet: SelectPredicateFacet,
  term: ColumnDef | OrderingTerm,
  directionOrOptions: OrderDirection | { direction?: OrderDirection; nulls?: 'FIRST' | 'LAST'; collation?: string }
): SelectQueryBuilderContext {
  const options =
    typeof directionOrOptions === 'string' ? { direction: directionOrOptions } : directionOrOptions;
  const dir = options.direction ?? ORDER_DIRECTIONS.ASC;
  return predicateFacet.orderBy(context, term, dir, options.nulls, options.collation);
}

/**
 * Runs the count query for the provided context and session.
 */
export async function executeCount(
  context: SelectQueryBuilderContext,
  env: SelectQueryBuilderEnvironment,
  session: OrmSession
): Promise<number> {
  const unpagedAst: SelectQueryNode = {
    ...context.state.ast,
    orderBy: undefined,
    limit: undefined,
    offset: undefined
  };

  const nextState = new SelectQueryState(env.table as TableDef, unpagedAst);
  const nextContext: SelectQueryBuilderContext = {
    ...context,
    state: nextState
  };

  const subAst = nextContext.hydration.applyToAst(nextState.ast);
  const countQuery: SelectQueryNode = {
    type: 'SelectQuery',
    from: derivedTable(subAst, '__metal_count'),
    columns: [{ type: 'Function', name: 'COUNT', args: [], alias: 'total' } as FunctionNode],
    joins: []
  };

  const execCtx = session.getExecutionContext();
  const compiled = execCtx.dialect.compileSelect(countQuery);
  const results = await execCtx.interceptors.run({ sql: compiled.sql, params: compiled.params }, execCtx.executor);
  const value = results[0]?.values?.[0]?.[0];

  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') return Number(value);
  return value === null || value === undefined ? 0 : Number(value);
}

/**
 * Executes paged queries using the provided builder helpers.
 */
export async function executePagedQuery<T, TTable extends TableDef>(
  builder: SelectQueryBuilder<T, TTable>,
  session: OrmSession,
  options: { page: number; pageSize: number },
  countCallback: (session: OrmSession) => Promise<number>
): Promise<{ items: T[]; totalItems: number }> {
  const { page, pageSize } = options;

  if (!Number.isInteger(page) || page < 1) {
    throw new Error('executePaged: page must be an integer >= 1');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) {
    throw new Error('executePaged: pageSize must be an integer >= 1');
  }

  const offset = (page - 1) * pageSize;

  const [items, totalItems] = await Promise.all([
    builder.limit(pageSize).offset(offset).execute(session),
    countCallback(session)
  ]);

  return { items, totalItems };
}

/**
 * Builds an EXISTS or NOT EXISTS predicate for a related table.
 */
export function buildWhereHasPredicate<TTable extends TableDef>(
  env: SelectQueryBuilderEnvironment,
  context: SelectQueryBuilderContext,
  relationFacet: SelectRelationFacet,
  createChildBuilder: ChildBuilderFactory,
  relationName: keyof TTable['relations'] & string,
  callbackOrOptions?: RelationCallback | WhereHasOptions,
  maybeOptions?: WhereHasOptions,
  negate = false
): ExpressionNode {
  const relation = env.table.relations[relationName as string];
  if (!relation) {
    throw new Error(`Relation '${relationName}' not found on table '${env.table.name}'`);
  }

  const callback = typeof callbackOrOptions === 'function' ? callbackOrOptions : undefined;
  const options = (typeof callbackOrOptions === 'function' ? maybeOptions : callbackOrOptions) as
    | WhereHasOptions
    | undefined;

  let subQb = createChildBuilder<unknown, TableDef>(relation.target);
  if (callback) {
    subQb = callback(subQb);
  }

  const subAst = subQb.getAST();
  const finalSubAst = relationFacet.applyRelationCorrelation(
    context,
    relationName,
    subAst,
    options?.correlate
  );

  return negate ? notExists(finalSubAst) : exists(finalSubAst);
}
