import { TableDef } from '../schema/table.js';
import { ColumnDef } from '../schema/column-types.js';
import {
  RelationDef,
  RelationKinds,
  BelongsToManyRelation,
  HasManyRelation,
  HasOneRelation,
  BelongsToRelation
} from '../schema/relation.js';
import { ColumnNode } from '../core/ast/expression.js';
import { SelectQueryState } from './select-query-state.js';
import { HydrationManager } from './hydration-manager.js';
import type { RelationResult } from './relation-projection-helper.js';
import { RelationIncludeOptions } from './relation-types.js';
import { makeRelationAlias } from './relation-alias.js';
import { buildDefaultPivotColumns } from './relation-utils.js';
import { findPrimaryKey } from './hydration-planner.js';

type RelationWithForeignKey =
  | HasManyRelation
  | HasOneRelation
  | BelongsToRelation;

type IncludeStrategyContext = {
  rootTable: TableDef;
  state: SelectQueryState;
  hydration: HydrationManager;
  relation: RelationDef;
  relationName: string;
  aliasPrefix: string;
  options?: RelationIncludeOptions;
  selectColumns: (
    state: SelectQueryState,
    hydration: HydrationManager,
    columns: Record<string, ColumnDef>
  ) => RelationResult;
};

type IncludeStrategy = (context: IncludeStrategyContext) => RelationResult;

const buildTypedSelection = (
  columns: Record<string, ColumnDef>,
  prefix: string,
  keys: string[],
  missingMsg: (col: string) => string
): Record<string, ColumnDef> => {
  return keys.reduce((acc, key) => {
    const def = columns[key];
    if (!def) {
      throw new Error(missingMsg(key));
    }
    acc[makeRelationAlias(prefix, key)] = def;
    return acc;
  }, {} as Record<string, ColumnDef>);
};

const resolveTargetColumns = (relation: RelationDef, options?: RelationIncludeOptions): string[] => {
  const requestedColumns = options?.columns?.length
    ? [...options.columns]
    : Object.keys(relation.target.columns);
  const targetPrimaryKey = findPrimaryKey(relation.target);
  if (!requestedColumns.includes(targetPrimaryKey)) {
    requestedColumns.push(targetPrimaryKey);
  }
  return requestedColumns;
};

const ensureRootForeignKeySelected = (
  context: IncludeStrategyContext,
  relation: RelationWithForeignKey
): RelationResult => {
  const fkColumn = context.rootTable.columns[relation.foreignKey];
  if (!fkColumn) {
    return { state: context.state, hydration: context.hydration };
  }

  const hasForeignKeySelected = context.state.ast.columns.some(col => {
    if ((col as ColumnNode).type !== 'Column') return false;
    const node = col as ColumnNode;
    const alias = node.alias ?? node.name;
    return alias === relation.foreignKey;
  });

  if (hasForeignKeySelected) {
    return { state: context.state, hydration: context.hydration };
  }

  return context.selectColumns(context.state, context.hydration, {
    [relation.foreignKey]: fkColumn
  });
};

const standardIncludeStrategy: IncludeStrategy = context => {
  const relation = context.relation as RelationWithForeignKey;
  let { state, hydration } = context;

  const fkSelectionResult = ensureRootForeignKeySelected(context, relation);
  state = fkSelectionResult.state;
  hydration = fkSelectionResult.hydration;

  const targetColumns = resolveTargetColumns(relation, context.options);
  const targetSelection = buildTypedSelection(
    relation.target.columns as Record<string, ColumnDef>,
    context.aliasPrefix,
    targetColumns,
    key => `Column '${key}' not found on relation '${context.relationName}'`
  );

  const relationSelectionResult = context.selectColumns(state, hydration, targetSelection);
  state = relationSelectionResult.state;
  hydration = relationSelectionResult.hydration;

  hydration = hydration.onRelationIncluded(
    state,
    relation,
    context.relationName,
    context.aliasPrefix,
    targetColumns
  );

  return { state, hydration };
};

const belongsToManyStrategy: IncludeStrategy = context => {
  const relation = context.relation as BelongsToManyRelation;
  let { state, hydration } = context;

  const targetColumns = resolveTargetColumns(relation, context.options);
  const targetSelection = buildTypedSelection(
    relation.target.columns as Record<string, ColumnDef>,
    context.aliasPrefix,
    targetColumns,
    key => `Column '${key}' not found on relation '${context.relationName}'`
  );

  const pivotAliasPrefix = context.options?.pivot?.aliasPrefix ?? `${context.aliasPrefix}_pivot`;
  const pivotPk = relation.pivotPrimaryKey || findPrimaryKey(relation.pivotTable);
  const defaultPivotColumns = relation.defaultPivotColumns ?? buildDefaultPivotColumns(relation, pivotPk);
  const pivotColumns = context.options?.pivot?.columns
    ? [...context.options.pivot.columns]
    : [...defaultPivotColumns];

  const pivotSelection = buildTypedSelection(
    relation.pivotTable.columns as Record<string, ColumnDef>,
    pivotAliasPrefix,
    pivotColumns,
    key => `Column '${key}' not found on pivot table '${relation.pivotTable.name}'`
  );

  const combinedSelection = {
    ...targetSelection,
    ...pivotSelection
  };

  const relationSelectionResult = context.selectColumns(state, hydration, combinedSelection);
  state = relationSelectionResult.state;
  hydration = relationSelectionResult.hydration;

  hydration = hydration.onRelationIncluded(
    state,
    relation,
    context.relationName,
    context.aliasPrefix,
    targetColumns,
    { aliasPrefix: pivotAliasPrefix, columns: pivotColumns }
  );

  return { state, hydration };
};

export const relationIncludeStrategies: Record<RelationDef['type'], IncludeStrategy> = {
  [RelationKinds.HasMany]: standardIncludeStrategy,
  [RelationKinds.HasOne]: standardIncludeStrategy,
  [RelationKinds.BelongsTo]: standardIncludeStrategy,
  [RelationKinds.BelongsToMany]: belongsToManyStrategy
};
