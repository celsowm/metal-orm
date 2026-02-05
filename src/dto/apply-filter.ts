/**
 * Runtime filter application - converts JSON filter objects to query builder conditions.
 */

import type { TableDef } from '../schema/table.js';
import type { ColumnDef } from '../schema/column-types.js';
import { SelectQueryBuilder } from '../query-builder/select.js';
import type { WhereInput, FilterValue, StringFilter, RelationFilter } from './filter-types.js';
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
  exists,
  notExists,
  type ColumnNode,
  type ExpressionNode
} from '../core/ast/expression.js';
import { findPrimaryKey } from '../query-builder/hydration-planner.js';
import { RelationKinds, type RelationDef, type BelongsToManyRelation } from '../schema/relation.js';
import type { SelectQueryNode, TableSourceNode } from '../core/ast/query.js';
import type { JoinNode } from '../core/ast/join.js';
import { createJoinNode } from '../core/ast/join-node.js';
import { JOIN_KINDS } from '../core/sql/sql.js';
import { buildRelationCorrelation } from '../query-builder/relation-conditions.js';
import { updateInclude } from '../query-builder/update-include.js';

/**
 * Options for applyFilter to control relation filtering behavior.
 */
export interface ApplyFilterOptions<TTable extends TableDef> {
  relations?: {
    [K in keyof TTable['relations']]?: boolean | {
      relations?: ApplyFilterOptions<TTable['relations'][K]['target']>['relations'];
    };
  };
}

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
 * @param options - Options to control relation filtering behavior
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
  where?: WhereInput<TTable | EntityConstructor> | null,
  _options?: ApplyFilterOptions<TTable>
): SelectQueryBuilder<T, TTable> {
  if (!where) {
    return qb;
  }

  const table = (isEntityConstructor(tableOrEntity)
    ? getTableDefFromEntity(tableOrEntity)
    : tableOrEntity) as TTable;

  if (!table) {
    return qb;
  }

  const expressions: ExpressionNode[] = [];

  for (const [fieldName, fieldFilter] of Object.entries(where)) {
    if (fieldFilter === undefined || fieldFilter === null) {
      continue;
    }

    const column = table.columns[fieldName as keyof typeof table.columns];
    if (column) {
      const expr = buildFieldExpression(column, fieldFilter as FilterValue);
      if (expr) {
        expressions.push(expr);
      }
    } else if (table.relations && fieldName in table.relations) {
      const relationFilter = fieldFilter as RelationFilter;
      const relationName = fieldName as keyof TTable['relations'] & string;
      qb = applyRelationFilter(qb, table, relationName, relationFilter);
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

function applyRelationFilter<T, TTable extends TableDef>(
  qb: SelectQueryBuilder<T, TTable>,
  table: TTable,
  relationName: keyof TTable['relations'] & string,
  filter: RelationFilter
): SelectQueryBuilder<T, TTable> {
  const relation = table.relations[relationName];
  if (!relation) {
    return qb;
  }

  if (filter.some) {
    const predicate = buildFilterExpression(relation.target, filter.some);
    if (predicate) {
      qb = updateInclude(qb, relationName, opts => ({
        ...opts,
        joinKind: JOIN_KINDS.INNER,
        filter: opts.filter ? and(opts.filter, predicate) : predicate
      }));
      const pk = findPrimaryKey(table);
      const pkColumn = table.columns[pk];
      qb = pkColumn
        ? qb.distinct(pkColumn)
        : qb.distinct({ type: 'Column', table: table.name, name: pk } as ColumnNode);
    }
  }

  if (filter.none) {
    const predicate = buildFilterExpression(relation.target, filter.none);
    if (predicate) {
      qb = qb.whereHasNot(relationName, (subQb) => subQb.where(predicate));
    }
  }

  if (filter.every) {
    const predicate = buildFilterExpression(relation.target, filter.every);
    if (predicate) {
      const pk = findPrimaryKey(table);
      qb = qb.joinRelation(relationName);
      qb = qb.groupBy({ type: 'Column', table: table.name, name: pk }) as typeof qb;
      qb = qb.having(buildEveryHavingClause(relationName, predicate, relation.target)) as typeof qb;
    }
  }

  if (filter.isEmpty !== undefined) {
    if (filter.isEmpty) {
      qb = qb.whereHasNot(relationName);
    } else {
      qb = qb.whereHas(relationName);
    }
  }

  if (filter.isNotEmpty !== undefined) {
    if (filter.isNotEmpty) {
      qb = qb.whereHas(relationName);
    } else {
      qb = qb.whereHasNot(relationName);
    }
  }

  return qb;
}

type RelationSubqueryBase = {
  from: TableSourceNode;
  joins: JoinNode[];
  correlation: ExpressionNode;
  groupByColumn: ColumnNode;
  targetTable: TableDef;
  targetTableName: string;
};

const buildRelationSubqueryBase = (
  table: TableDef,
  relation: RelationDef
): RelationSubqueryBase => {
  const target = relation.target;

  if (relation.type === RelationKinds.BelongsToMany) {
    const many = relation as BelongsToManyRelation;
    const localKey = many.localKey || findPrimaryKey(table);
    const targetKey = many.targetKey || findPrimaryKey(target);
    const pivot = many.pivotTable;

    const from: TableSourceNode = {
      type: 'Table',
      name: pivot.name,
      schema: pivot.schema
    };

    const joins: JoinNode[] = [
      createJoinNode(
        JOIN_KINDS.INNER,
        { type: 'Table', name: target.name, schema: target.schema },
        eq(
          { type: 'Column', table: target.name, name: targetKey },
          { type: 'Column', table: pivot.name, name: many.pivotForeignKeyToTarget }
        )
      )
    ];

    const correlation = eq(
      { type: 'Column', table: pivot.name, name: many.pivotForeignKeyToRoot },
      { type: 'Column', table: table.name, name: localKey }
    );

    const groupByColumn: ColumnNode = {
      type: 'Column',
      table: pivot.name,
      name: many.pivotForeignKeyToRoot
    };

    return {
      from,
      joins,
      correlation,
      groupByColumn,
      targetTable: target,
      targetTableName: target.name
    };
  }

  const from: TableSourceNode = {
    type: 'Table',
    name: target.name,
    schema: target.schema
  };

  const correlation = buildRelationCorrelation(table, relation);
  const groupByColumnName =
    relation.type === RelationKinds.BelongsTo
      ? (relation.localKey || findPrimaryKey(target))
      : relation.foreignKey;

  return {
    from,
    joins: [],
    correlation,
    groupByColumn: { type: 'Column', table: target.name, name: groupByColumnName },
    targetTable: target,
    targetTableName: target.name
  };
};

function buildRelationFilterExpression(
  table: TableDef,
  relationName: string,
  filter: RelationFilter
): ExpressionNode | null {
  const relation = table.relations[relationName];
  if (!relation) {
    return null;
  }

  const expressions: ExpressionNode[] = [];
  const subqueryBase = buildRelationSubqueryBase(table, relation);

  const buildSubquery = (predicate?: ExpressionNode): SelectQueryNode => {
    const where = predicate
      ? and(subqueryBase.correlation, predicate)
      : subqueryBase.correlation;
    return {
      type: 'SelectQuery',
      from: subqueryBase.from,
      columns: [],
      joins: subqueryBase.joins,
      where
    };
  };

  if (filter.some) {
    const predicate = buildFilterExpression(relation.target, filter.some);
    if (predicate) {
      expressions.push(exists(buildSubquery(predicate)));
    }
  }

  if (filter.none) {
    const predicate = buildFilterExpression(relation.target, filter.none);
    if (predicate) {
      expressions.push(notExists(buildSubquery(predicate)));
    }
  }

  if (filter.every) {
    const predicate = buildFilterExpression(relation.target, filter.every);
    if (predicate) {
      const subquery: SelectQueryNode = {
        type: 'SelectQuery',
        from: subqueryBase.from,
        columns: [],
        joins: subqueryBase.joins,
        where: subqueryBase.correlation,
        groupBy: [subqueryBase.groupByColumn],
        having: buildEveryHavingClause(subqueryBase.targetTableName, predicate, subqueryBase.targetTable)
      };
      expressions.push(exists(subquery));
    }
  }

  if (filter.isEmpty !== undefined) {
    const subquery = buildSubquery();
    expressions.push(filter.isEmpty ? notExists(subquery) : exists(subquery));
  }

  if (filter.isNotEmpty !== undefined) {
    const subquery = buildSubquery();
    expressions.push(filter.isNotEmpty ? exists(subquery) : notExists(subquery));
  }

  if (expressions.length === 0) {
    return null;
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  return and(...expressions);
}

function buildEveryHavingClause(
  relationName: string,
  predicate: ExpressionNode,
  targetTable: TableDef
): ExpressionNode {
  const pk = findPrimaryKey(targetTable);

  const whenClause = {
    when: predicate,
    then: { type: 'Literal' as const, value: 1 }
  };

  const caseExpr = {
    type: 'CaseExpression' as const,
    conditions: [whenClause],
    else: { type: 'Literal' as const, value: null }
  };

  const countMatching = {
    type: 'Function' as const,
    name: 'COUNT',
    args: [caseExpr]
  };

  const countAll = {
    type: 'Function' as const,
    name: 'COUNT',
    args: [{ type: 'Column' as const, table: relationName, name: pk }]
  };

  return {
    type: 'BinaryExpression' as const,
    operator: '=',
    left: countAll,
    right: countMatching
  };
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
  where?: WhereInput<TableDef | EntityConstructor> | null
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

    const column = table.columns[fieldName as keyof typeof table.columns];
    if (column) {
      const expr = buildFieldExpression(column, fieldFilter as FilterValue);
      if (expr) {
        expressions.push(expr);
      }
    } else if (table.relations && fieldName in table.relations) {
      const relationExpr = buildRelationFilterExpression(
        table,
        fieldName,
        fieldFilter as RelationFilter
      );
      if (relationExpr) {
        expressions.push(relationExpr);
      }
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
