import { TableDef } from '../schema/table.js';
import { RelationDef, RelationKinds, BelongsToManyRelation } from '../schema/relation.js';
import { SelectQueryState } from './select-query-state.js';
import { QueryAstService } from './query-ast-service.js';
import { TableSourceNode, TableNode } from '../core/ast/query.js';
import { ExpressionNode } from '../core/ast/expression.js';
import { JoinKind } from '../core/sql/sql.js';
import { buildRelationJoinCondition, buildBelongsToManyJoins } from './relation-conditions.js';
import { createJoinNode } from '../core/ast/join-node.js';

/**
 * Gets the exposed name from a TableSourceNode.
 * The exposed name is the alias if present, otherwise the table name.
 */
const getExposedName = (ts: TableSourceNode): string | null => {
  if (ts.type === 'Table') return ts.alias ?? ts.name;
  if (ts.type === 'DerivedTable') return ts.alias;
  if (ts.type === 'FunctionTable') return ts.alias ?? ts.name;
  return null;
};

/**
 * Collects all exposed names from the current query state (FROM + JOINs).
 * This is used to detect naming collisions when adding new joins.
 */
const collectExposedNames = (state: SelectQueryState): Set<string> => {
  const used = new Set<string>();
  const fromName = getExposedName(state.ast.from);
  if (fromName) used.add(fromName);

  for (const j of state.ast.joins) {
    const n = getExposedName(j.table);
    if (n) used.add(n);
  }
  return used;
};

/**
 * Creates a unique alias based on a base name, avoiding collisions with already-used names.
 */
const makeUniqueAlias = (base: string, used: Set<string>): string => {
  let alias = base;
  let i = 2;
  while (used.has(alias)) alias = `${base}_${i++}`;
  return alias;
};

/**
 * Ensures a TableSourceNode has a unique correlation name (alias) to avoid SQL Server's
 * "same exposed names" error. If the table's exposed name already exists in the query,
 * an alias is generated using the relation name.
 */
const ensureCorrelationName = (
  state: SelectQueryState,
  relationName: string,
  ts: TableSourceNode,
  extraUsed?: Iterable<string>
): TableSourceNode => {
  if (ts.type !== 'Table') return ts;
  if (ts.alias) return ts;

  const used = collectExposedNames(state);
  for (const x of extraUsed ?? []) used.add(x);

  // Only alias if the exposed name (table name) already exists
  if (!used.has(ts.name)) return ts;

  const alias = makeUniqueAlias(relationName, used);
  return { ...ts, alias };
};

export class RelationJoinPlanner {
  constructor(
    private readonly table: TableDef,
    private readonly createQueryAstService: (table: TableDef, state: SelectQueryState) => QueryAstService
  ) {}

  withJoin(
    state: SelectQueryState,
    relationName: string,
    relation: RelationDef,
    joinKind: JoinKind,
    extraCondition?: ExpressionNode,
    tableSource?: TableSourceNode
  ): SelectQueryState {
    const rootAlias = state.ast.from.type === 'Table' ? state.ast.from.alias : undefined;
    if (relation.type === RelationKinds.BelongsToMany) {
      let targetTableSource: TableSourceNode = tableSource ?? {
        type: 'Table',
        name: relation.target.name,
        schema: relation.target.schema
      };
      // Ensure unique alias to avoid "same exposed names" error
      // Include pivot table name in extraUsed since it will be added in this operation
      targetTableSource = ensureCorrelationName(
        state,
        relationName,
        targetTableSource,
        [relation.pivotTable.name]
      );
      const targetName = this.resolveTargetTableName(targetTableSource, relation);
      const joins = buildBelongsToManyJoins(
        this.table,
        relationName,
        relation as BelongsToManyRelation,
        joinKind,
        extraCondition,
        rootAlias,
        targetTableSource,
        targetName
      );
      return joins.reduce((current, join) => this.astService(current).withJoin(join), state);
    }

    let targetTable: TableSourceNode = tableSource ?? {
      type: 'Table',
      name: relation.target.name,
      schema: relation.target.schema
    };
    // Ensure unique alias to avoid "same exposed names" error
    targetTable = ensureCorrelationName(state, relationName, targetTable);
    const targetName = this.resolveTargetTableName(targetTable, relation);
    const condition = buildRelationJoinCondition(
      this.table,
      relation,
      extraCondition,
      rootAlias,
      targetName
    );
    const joinNode = createJoinNode(joinKind, targetTable, condition, relationName);

    return this.astService(state).withJoin(joinNode);
  }

  private astService(state: SelectQueryState): QueryAstService {
    return this.createQueryAstService(this.table, state);
  }

  private resolveTargetTableName(target: TableSourceNode, relation: RelationDef): string {
    if (target.type === 'Table') {
      return target.alias ?? target.name;
    }
    if (target.type === 'DerivedTable') {
      return target.alias;
    }
    if (target.type === 'FunctionTable') {
      return target.alias ?? relation.target.name;
    }
    return relation.target.name;
  }
}
