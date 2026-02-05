import { JOIN_KINDS } from '../core/sql/sql.js';
import type { TableDef } from '../schema/table.js';
import { findJoinByRelationKey, findJoinIndexByRelationKey } from './join-utils.js';
import { addRelationJoin, updateRelationJoin } from './relation-join-strategies.js';
import { getExposedName } from './table-alias-utils.js';
import { cloneRelationIncludeTree, getIncludeNode, setIncludeOptions } from './relation-include-tree.js';
import { buildRelationKey } from './relation-key.js';
import { RelationIncludeOptions } from './relation-types.js';
import { SelectQueryBuilder } from './select.js';

type IncludeUpdater = (options: RelationIncludeOptions) => RelationIncludeOptions;

export const updateInclude = <T, TTable extends TableDef>(
  qb: SelectQueryBuilder<T, TTable>,
  relationPath: string,
  updater: IncludeUpdater
): SelectQueryBuilder<T, TTable> => {
  if (!relationPath || !relationPath.trim()) {
    return qb;
  }

  const segments = relationPath.split('.').filter(Boolean);
  if (segments.length === 0) {
    return qb;
  }

  const internals = qb.getInternals();
  const { context, includeTree } = internals;
  let state = context.state;
  const hydration = context.hydration;
  let currentTable: TableDef = qb.getTable();
  let currentAlias = getExposedName(state.ast.from) ?? currentTable.name;

  const includeInfo = getIncludeNode(includeTree, segments);
  const existingOptions = includeInfo.options ?? {};
  const nextOptions = updater({ ...existingOptions });

  let nextIncludeTree = includeTree;
  const shouldCreateIncludePath = segments.length === 1 || includeInfo.exists;
  if (shouldCreateIncludePath) {
    nextIncludeTree = cloneRelationIncludeTree(includeTree);
    setIncludeOptions(nextIncludeTree, segments, nextOptions);
  }

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const relation = currentTable.relations[segment];
    if (!relation) {
      throw new Error(`Relation '${segment}' not found on table '${currentTable.name}'`);
    }

    const relationKey = buildRelationKey(segments.slice(0, i + 1));
    const joinIndex = findJoinIndexByRelationKey(state.ast.joins, relationKey);
    const isLeaf = i === segments.length - 1;

    if (isLeaf) {
      if (joinIndex === -1) {
        const joinKind = nextOptions.joinKind ?? JOIN_KINDS.LEFT;
        state = addRelationJoin({
          state,
          rootTable: currentTable,
          rootAlias: currentAlias,
          relationKey,
          relation,
          joinKind,
          filter: nextOptions.filter
        });
      } else {
        const joins = [...state.ast.joins];
        updateRelationJoin({
          joins,
          joinIndex,
          relation,
          currentTable,
          currentAlias,
          options: nextOptions
        });

        state = state.withJoins(joins);
      }
    } else if (joinIndex === -1) {
      const segmentOptions = getIncludeNode(includeTree, segments.slice(0, i + 1)).options;
      const joinKind = segmentOptions?.joinKind ?? JOIN_KINDS.LEFT;
      state = addRelationJoin({
        state,
        rootTable: currentTable,
        rootAlias: currentAlias,
        relationKey,
        relation,
        joinKind,
        filter: segmentOptions?.filter
      });
    }

    const joinForSegment = findJoinByRelationKey(state.ast.joins, relationKey);
    currentAlias = joinForSegment ? (getExposedName(joinForSegment.table) ?? relation.target.name) : relation.target.name;
    currentTable = relation.target;
  }

  const nextContext = { state, hydration };
  return internals.clone(nextContext, nextIncludeTree);
};
