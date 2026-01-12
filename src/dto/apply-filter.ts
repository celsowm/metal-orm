/**
 * Runtime filter application - converts JSON filter objects to query builder conditions.
 */

import type { TableDef } from '../schema/table.js';
import type { ColumnDef } from '../schema/column-types.js';
import type { SelectQueryBuilder } from '../query-builder/select.js';
import type { WhereInput, FilterValue, StringFilter } from './filter-types.js';
import type { EntityConstructor } from '../orm/entity-metadata.js';
import { getTableDefFromEntity } from '../decorators/bootstrap.js';
import {
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  like,
  inList,
  notInList,
  and,
  type ExpressionNode
} from '../core/ast/expression.js';

/**
 * Builds an expression node from a single field filter.
 */
function buildFieldExpression(
  column: ColumnDef,
  filter: FilterValue
): ExpressionNode | null {
  const expressions: ExpressionNode[] = [];

  // String filters
  if ('contains' in filter && filter.contains !== undefined) {
    const pattern = `%${escapePattern(filter.contains)}%`;
    const mode = (filter as StringFilter).mode;
    if (mode === 'insensitive') {
      expressions.push(caseInsensitiveLike(column, pattern));
    } else {
      expressions.push(like(column, pattern));
    }
  }

  if ('startsWith' in filter && filter.startsWith !== undefined) {
    const pattern = `${escapePattern(filter.startsWith)}%`;
    const mode = (filter as StringFilter).mode;
    if (mode === 'insensitive') {
      expressions.push(caseInsensitiveLike(column, pattern));
    } else {
      expressions.push(like(column, pattern));
    }
  }

  if ('endsWith' in filter && filter.endsWith !== undefined) {
    const pattern = `%${escapePattern(filter.endsWith)}`;
    const mode = (filter as StringFilter).mode;
    if (mode === 'insensitive') {
      expressions.push(caseInsensitiveLike(column, pattern));
    } else {
      expressions.push(like(column, pattern));
    }
  }

  // Common filters (equals, not, in, notIn)
  if ('equals' in filter && filter.equals !== undefined) {
    expressions.push(eq(column, filter.equals as string | number | boolean));
  }

  if ('not' in filter && filter.not !== undefined) {
    expressions.push(neq(column, filter.not as string | number | boolean));
  }

  if ('in' in filter && filter.in !== undefined) {
    expressions.push(inList(column, filter.in as (string | number)[]));
  }

  if ('notIn' in filter && filter.notIn !== undefined) {
    expressions.push(notInList(column, filter.notIn as (string | number)[]));
  }

  // Comparison filters (lt, lte, gt, gte)
  if ('lt' in filter && filter.lt !== undefined) {
    expressions.push(lt(column, filter.lt as string | number));
  }

  if ('lte' in filter && filter.lte !== undefined) {
    expressions.push(lte(column, filter.lte as string | number));
  }

  if ('gt' in filter && filter.gt !== undefined) {
    expressions.push(gt(column, filter.gt as string | number));
  }

  if ('gte' in filter && filter.gte !== undefined) {
    expressions.push(gte(column, filter.gte as string | number));
  }

  if (expressions.length === 0) {
    return null;
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  return and(...expressions);
}

/**
 * Escapes special LIKE pattern characters.
 */
function escapePattern(value: string): string {
  return value.replace(/[%_\\]/g, '\\$&');
}

/**
 * Creates a case-insensitive LIKE expression using LOWER().
 * This is portable across all SQL dialects.
 */
function caseInsensitiveLike(column: ColumnDef, pattern: string): ExpressionNode {
  return {
    type: 'BinaryExpression',
    left: {
      type: 'Function',
      name: 'LOWER',
      args: [{ type: 'Column', table: column.table!, name: column.name }]
    },
    operator: 'LIKE',
    right: { type: 'Literal', value: pattern.toLowerCase() }
  } as unknown as ExpressionNode;
}

/**
 * Applies a filter object to a SelectQueryBuilder.
 * All conditions are AND-ed together.
 *
 * @param qb - The query builder to apply filters to
 * @param tableOrEntity - The table definition or entity constructor (used to resolve column references)
 * @param where - The filter object from: API request
 * @returns The query builder with filters applied
 *
 * @example
 * ```ts
 * // In a controller - using Entity class
 * @Get()
 * async list(@Query() where?: UserFilter): Promise<UserResponse[]> {
 *   let query = selectFromEntity(User);
 *   query = applyFilter(query, User, where);
 *   return query.execute(db);
 * }
 *
 * // Using TableDef directly
 * @Get()
 * async list(@Query() where?: UserFilter): Promise<UserResponse[]> {
 *   let query = selectFrom(usersTable);
 *   query = applyFilter(query, usersTable, where);
 *   return query.execute(db);
 * }
 *
 * // Request: { "name": { "contains": "john" }, "email": { "endsWith": "@gmail.com" } }
 * // SQL: WHERE name LIKE '%john%' AND email LIKE '%@gmail.com'
 * ```
 */
export function applyFilter<T, TTable extends TableDef>(
  qb: SelectQueryBuilder<T, TTable>,
  tableOrEntity: TTable | EntityConstructor,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where?: WhereInput<any> | null
): SelectQueryBuilder<T, TTable> {
  if (!where) {
    return qb;
  }

  const table = isEntityConstructor(tableOrEntity)
    ? getTableDefFromEntity(tableOrEntity)
    : tableOrEntity;

  if (!table) {
    return qb;
  }

  const expressions: ExpressionNode[] = [];

  for (const [fieldName, fieldFilter] of Object.entries(where)) {
    if (fieldFilter === undefined || fieldFilter === null) {
      continue;
    }

    const column = table.columns[fieldName];
    if (!column) {
      continue;
    }

    const expr = buildFieldExpression(column, fieldFilter as FilterValue);
    if (expr) {
      expressions.push(expr);
    }
  }

  if (expressions.length === 0) {
    return qb;
  }

  if (expressions.length === 1) {
    return qb.where(expressions[0]);
  }

  return qb.where(and(...expressions));
}

function isEntityConstructor(value: unknown): value is EntityConstructor {
  return typeof value === 'function' && value.prototype?.constructor === value;
}

/**
 * Builds an expression tree from a filter object without applying it.
 * Useful for combining with other conditions.
 *
 * @param tableOrEntity - The table definition or entity constructor
 * @param where - The filter object
 * @returns An expression node or null if no filters
 *
 * @example
 * ```ts
 * // Using Entity class
 * const filterExpr = buildFilterExpression(User, { name: { contains: "john" } });
 *
 * // Using TableDef directly
 * const filterExpr = buildFilterExpression(usersTable, { name: { contains: "john" } });
 *
 * if (filterExpr) {
 *   qb = qb.where(and(filterExpr, eq(users.columns.active, true)));
 * }
 * ```
 */
export function buildFilterExpression(
  tableOrEntity: TableDef | EntityConstructor,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  where?: WhereInput<any> | null
): ExpressionNode | null {
  if (!where) {
    return null;
  }

  const table = isEntityConstructor(tableOrEntity)
    ? getTableDefFromEntity(tableOrEntity)
    : tableOrEntity;

  if (!table) {
    return null;
  }

  const expressions: ExpressionNode[] = [];

  for (const [fieldName, fieldFilter] of Object.entries(where)) {
    if (fieldFilter === undefined || fieldFilter === null) {
      continue;
    }

    const column = table.columns[fieldName];
    if (!column) {
      continue;
    }

    const expr = buildFieldExpression(column, fieldFilter as FilterValue);
    if (expr) {
      expressions.push(expr);
    }
  }

  if (expressions.length === 0) {
    return null;
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  return and(...expressions);
}
