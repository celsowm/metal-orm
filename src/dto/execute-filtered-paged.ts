import type { ColumnNode } from '../core/ast/expression.js';
import type { OrderingTerm } from '../core/ast/query.js';
import { ORDER_DIRECTIONS, type OrderDirection } from '../core/sql/sql.js';
import { type EntityConstructor } from '../orm/entity-metadata.js';
import { type OrmSession } from '../orm/orm-session.js';
import { type SelectQueryBuilder } from '../query-builder/select.js';
import { type ColumnDef } from '../schema/column-types.js';
import { type TableDef } from '../schema/table.js';
import { applyFilter } from './apply-filter.js';
import { type PagedResponse } from './dto-types.js';
import { type WhereInput } from './filter-types.js';
import { toPagedResponse } from './pagination-utils.js';

type SortTerm = ColumnDef | OrderingTerm;

export type ExecuteFilteredPagedOptions<
  TResult,
  TTable extends TableDef,
  TTarget extends TTable | EntityConstructor
> = {
  qb: SelectQueryBuilder<TResult, TTable>;
  tableOrEntity: TTarget;
  session: OrmSession;
  page: number;
  pageSize: number;
  filters?: WhereInput<TTarget> | null;
  sortBy?: string | null;
  sortDirection?: OrderDirection;
  allowedSortColumns?: Record<string, SortTerm>;
  defaultSortBy?: string;
  defaultSortDirection?: OrderDirection;
  tieBreakerColumn?: string;
};

type ResolvedSort = {
  term: SortTerm;
  direction: OrderDirection;
};

const normalizeSortBy = (sortBy?: string | null): string | undefined => {
  if (!sortBy) {
    return undefined;
  }
  const normalized = sortBy.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const detectPrimaryKeyName = (table: TableDef): string | undefined => {
  const pk = Object.values(table.columns).find((column) => column.primary);
  return pk?.name;
};

const toColumnNode = (table: TableDef, name: string): ColumnNode => ({
  type: 'Column',
  table: table.name,
  name
});

const getColumnByName = (table: TableDef, name: string): ColumnDef | undefined => {
  return Object.values(table.columns).find((column) => column.name === name);
};

const resolveSortTermFromAllowed = (
  sortBy: string,
  allowedSortColumns?: Record<string, SortTerm>
): SortTerm => {
  if (!allowedSortColumns) {
    throw new Error('allowedSortColumns is required when sortBy/defaultSortBy is provided.');
  }

  const term = allowedSortColumns[sortBy];
  if (term) {
    return term;
  }

  const allowedKeys = Object.keys(allowedSortColumns);
  throw new Error(
    `Invalid sortBy "${sortBy}". Allowed values: ${allowedKeys.length > 0 ? allowedKeys.join(', ') : '(none)'}.`
  );
};

const resolvePrimarySort = (
  table: TableDef,
  sortBy?: string | null,
  sortDirection?: OrderDirection,
  allowedSortColumns?: Record<string, SortTerm>,
  defaultSortBy?: string,
  defaultSortDirection?: OrderDirection
): ResolvedSort => {
  const requestedSortBy = normalizeSortBy(sortBy);
  if (requestedSortBy) {
    return {
      term: resolveSortTermFromAllowed(requestedSortBy, allowedSortColumns),
      direction: sortDirection ?? ORDER_DIRECTIONS.ASC
    };
  }

  const configuredDefaultSortBy = normalizeSortBy(defaultSortBy);
  if (configuredDefaultSortBy) {
    return {
      term: resolveSortTermFromAllowed(configuredDefaultSortBy, allowedSortColumns),
      direction: defaultSortDirection ?? ORDER_DIRECTIONS.ASC
    };
  }

  const detectedPkName = detectPrimaryKeyName(table);
  if (detectedPkName) {
    const detectedPkColumn = getColumnByName(table, detectedPkName);
    if (detectedPkColumn) {
      return {
        term: detectedPkColumn,
        direction: ORDER_DIRECTIONS.ASC
      };
    }
  }

  const idColumn = getColumnByName(table, 'id');
  return {
    term: idColumn ?? toColumnNode(table, 'id'),
    direction: ORDER_DIRECTIONS.ASC
  };
};

const resolveTieBreaker = (
  table: TableDef,
  tieBreakerColumn?: string
): SortTerm => {
  const configuredName = normalizeSortBy(tieBreakerColumn);
  if (configuredName) {
    const configuredColumn = getColumnByName(table, configuredName);
    if (!configuredColumn) {
      throw new Error(
        `Invalid tieBreakerColumn "${configuredName}" for table "${table.name}".`
      );
    }
    return configuredColumn;
  }

  const idColumn = getColumnByName(table, 'id');
  if (idColumn) {
    return idColumn;
  }

  const detectedPkName = detectPrimaryKeyName(table);
  if (detectedPkName) {
    const detectedPkColumn = getColumnByName(table, detectedPkName);
    if (detectedPkColumn) {
      return detectedPkColumn;
    }
  }

  return toColumnNode(table, 'id');
};

const extractSortColumnName = (term: SortTerm): string | undefined => {
  if (
    typeof term === 'object'
    && term !== null
    && 'name' in term
    && typeof term.name === 'string'
  ) {
    return term.name;
  }

  return undefined;
};

export const executeFilteredPaged = async <
  TResult,
  TTable extends TableDef,
  TTarget extends TTable | EntityConstructor
>(
  options: ExecuteFilteredPagedOptions<TResult, TTable, TTarget>
): Promise<PagedResponse<TResult>> => {
  const table = options.qb.getTable();
  const primarySort = resolvePrimarySort(
    table,
    options.sortBy,
    options.sortDirection,
    options.allowedSortColumns,
    options.defaultSortBy,
    options.defaultSortDirection
  );
  const tieBreaker = resolveTieBreaker(table, options.tieBreakerColumn);

  let qb = applyFilter(
    options.qb,
    options.tableOrEntity,
    options.filters
  );

  qb = qb.orderBy(primarySort.term, primarySort.direction);

  const primarySortColumnName = extractSortColumnName(primarySort.term);
  const tieBreakerColumnName = extractSortColumnName(tieBreaker);
  if (primarySortColumnName !== tieBreakerColumnName) {
    qb = qb.orderBy(tieBreaker, ORDER_DIRECTIONS.ASC);
  }

  const result = await qb.executePaged(options.session, {
    page: options.page,
    pageSize: options.pageSize
  });

  return toPagedResponse(result);
};
