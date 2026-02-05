import {
  CaseExpressionNode,
  CastExpressionNode,
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  JsonPathNode,
  OperandNode,
  ScalarSubqueryNode,
  WindowFunctionNode,
  isOperandNode,
  and,
  eq
} from '../core/ast/expression.js';
import type { OrderingTerm, SelectQueryNode, TableSourceNode } from '../core/ast/query.js';
import type { JoinNode } from '../core/ast/join.js';
import { createJoinNode } from '../core/ast/join-node.js';
import { getJoinRelationName } from '../core/ast/join-metadata.js';
import { JOIN_KINDS, JoinKind } from '../core/sql/sql.js';
import { RelationDef, RelationKinds, type BelongsToManyRelation } from '../schema/relation.js';
import type { TableDef } from '../schema/table.js';
import { buildBelongsToManyJoins, buildRelationJoinCondition } from './relation-conditions.js';
import { cloneRelationIncludeTree, type NormalizedRelationIncludeTree } from './relation-include-tree.js';
import { RelationIncludeOptions } from './relation-types.js';
import { SelectQueryBuilder } from './select.js';
import { SelectQueryState } from './select-query-state.js';
import { findPrimaryKey } from './hydration-planner.js';

type IncludeUpdater = (options: RelationIncludeOptions) => RelationIncludeOptions;

type BuilderInternals<T, TTable extends TableDef> = {
  context: { state: SelectQueryState; hydration: unknown };
  includeTree: NormalizedRelationIncludeTree;
  clone: (
    context?: { state: SelectQueryState; hydration: unknown },
    lazyRelations?: Set<string>,
    lazyRelationOptions?: Map<string, RelationIncludeOptions>,
    includeTree?: NormalizedRelationIncludeTree
  ) => SelectQueryBuilder<T, TTable>;
};

const getExposedName = (ts: TableSourceNode): string | null => {
  if (ts.type === 'Table') return ts.alias ?? ts.name;
  if (ts.type === 'DerivedTable') return ts.alias;
  if (ts.type === 'FunctionTable') return ts.alias ?? ts.name;
  return null;
};

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

const makeUniqueAlias = (base: string, used: Set<string>): string => {
  let alias = base;
  let i = 2;
  while (used.has(alias)) alias = `${base}_${i++}`;
  return alias;
};

const ensureCorrelationName = (
  state: SelectQueryState,
  relationKey: string,
  ts: TableSourceNode,
  extraUsed?: Iterable<string>
): TableSourceNode => {
  if (ts.type !== 'Table') return ts;
  if (ts.alias) return ts;

  const used = collectExposedNames(state);
  for (const x of extraUsed ?? []) used.add(x);

  if (!used.has(ts.name)) return ts;

  const alias = makeUniqueAlias(relationKey, used);
  return { ...ts, alias };
};

const findJoinIndex = (joins: JoinNode[], relationKey: string): number =>
  joins.findIndex(j => getJoinRelationName(j) === relationKey);

const getJoinByKey = (joins: JoinNode[], relationKey: string): JoinNode | undefined =>
  joins.find(j => getJoinRelationName(j) === relationKey);

const remapExpressionTable = (
  expr: ExpressionNode | undefined,
  fromTable: string,
  toTable: string
): ExpressionNode | undefined => {
  if (!expr || fromTable === toTable) return expr;
  return mapExpression(expr, fromTable, toTable);
};

const mapExpression = (expr: ExpressionNode, fromTable: string, toTable: string): ExpressionNode => {
  switch (expr.type) {
    case 'BinaryExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      const right = mapOperand(expr.right, fromTable, toTable);
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    case 'LogicalExpression': {
      const nextOperands = expr.operands.map(op => mapExpression(op, fromTable, toTable));
      if (nextOperands.every((op, i) => op === expr.operands[i])) return expr;
      return { ...expr, operands: nextOperands };
    }
    case 'NullExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      if (left === expr.left) return expr;
      return { ...expr, left };
    }
    case 'InExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      let right = expr.right;
      if (Array.isArray(expr.right)) {
        const mapped = expr.right.map(val => mapOperand(val, fromTable, toTable));
        if (!mapped.every((val, i) => val === expr.right[i])) {
          right = mapped;
        }
      } else if (expr.right.type === 'ScalarSubquery') {
        const mapped = mapScalarSubquery(expr.right, fromTable, toTable);
        if (mapped !== expr.right) right = mapped;
      }
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    case 'ExistsExpression': {
      const mapped = mapSelectQuery(expr.subquery, fromTable, toTable);
      if (mapped === expr.subquery) return expr;
      return { ...expr, subquery: mapped };
    }
    case 'BetweenExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      const lower = mapOperand(expr.lower, fromTable, toTable);
      const upper = mapOperand(expr.upper, fromTable, toTable);
      if (left === expr.left && lower === expr.lower && upper === expr.upper) return expr;
      return { ...expr, left, lower, upper };
    }
    case 'ArithmeticExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      const right = mapOperand(expr.right, fromTable, toTable);
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    case 'BitwiseExpression': {
      const left = mapOperand(expr.left, fromTable, toTable);
      const right = mapOperand(expr.right, fromTable, toTable);
      if (left === expr.left && right === expr.right) return expr;
      return { ...expr, left, right };
    }
    default:
      return expr;
  }
};

const mapColumn = (node: ColumnNode, fromTable: string, toTable: string): ColumnNode => {
  if (node.table !== fromTable) return node;
  return { ...node, table: toTable };
};

const mapJsonPath = (node: JsonPathNode, fromTable: string, toTable: string): JsonPathNode => {
  const nextColumn = mapColumn(node.column, fromTable, toTable);
  if (nextColumn === node.column) return node;
  return { ...node, column: nextColumn };
};

const mapWindowFunctionArg = (
  node: WindowFunctionNode['args'][number],
  fromTable: string,
  toTable: string
): WindowFunctionNode['args'][number] => {
  switch (node.type) {
    case 'Column':
      return mapColumn(node, fromTable, toTable);
    case 'JsonPath':
      return mapJsonPath(node, fromTable, toTable);
    default:
      return node;
  }
};

const mapOperand = (node: OperandNode, fromTable: string, toTable: string): OperandNode => {
  switch (node.type) {
    case 'Column':
      return mapColumn(node, fromTable, toTable);
    case 'Function': {
      const nextArgs = node.args.map(arg => mapOperand(arg, fromTable, toTable));
      const nextSeparator = node.separator ? mapOperand(node.separator, fromTable, toTable) : node.separator;
      const nextOrderBy = node.orderBy?.map(order => ({
        ...order,
        term: mapOrderingTerm(order.term, fromTable, toTable)
      }));
      const changed = nextArgs.some((arg, i) => arg !== node.args[i]) ||
        nextSeparator !== node.separator ||
        (nextOrderBy && node.orderBy && nextOrderBy.some((ob, i) => ob.term !== node.orderBy![i].term));
      if (!changed) return node;
      return {
        ...node,
        args: nextArgs,
        separator: nextSeparator,
        orderBy: nextOrderBy
      };
    }
    case 'JsonPath': {
      return mapJsonPath(node, fromTable, toTable);
    }
    case 'ScalarSubquery': {
      return mapScalarSubquery(node, fromTable, toTable);
    }
    case 'CaseExpression': {
      const nextConditions = node.conditions.map(cond => ({
        when: mapExpression(cond.when, fromTable, toTable),
        then: mapOperand(cond.then, fromTable, toTable)
      }));
      const nextElse = node.else ? mapOperand(node.else, fromTable, toTable) : node.else;
      const changed =
        nextConditions.some((cond, i) =>
          cond.when !== node.conditions[i].when || cond.then !== node.conditions[i].then
        ) ||
        nextElse !== node.else;
      if (!changed) return node;
      return { ...node, conditions: nextConditions, else: nextElse };
    }
    case 'Cast': {
      const nextExpr = mapOperand(node.expression, fromTable, toTable);
      if (nextExpr === node.expression) return node;
      return { ...node, expression: nextExpr };
    }
    case 'WindowFunction': {
      const nextArgs = node.args.map(arg => mapWindowFunctionArg(arg, fromTable, toTable));
      const nextPartition = node.partitionBy?.map(part => mapColumn(part, fromTable, toTable));
      const nextOrderBy = node.orderBy?.map(order => ({
        ...order,
        term: mapOrderingTerm(order.term, fromTable, toTable)
      }));
      const changed =
        nextArgs.some((arg, i) => arg !== node.args[i]) ||
        (nextPartition && node.partitionBy && nextPartition.some((p, i) => p !== node.partitionBy![i])) ||
        (nextOrderBy && node.orderBy && nextOrderBy.some((ob, i) => ob.term !== node.orderBy![i].term));
      if (!changed) return node;
      return {
        ...node,
        args: nextArgs,
        partitionBy: nextPartition,
        orderBy: nextOrderBy
      };
    }
    case 'Collate': {
      const nextExpr = mapOperand(node.expression, fromTable, toTable);
      if (nextExpr === node.expression) return node;
      return { ...node, expression: nextExpr };
    }
    case 'ArithmeticExpression': {
      const left = mapOperand(node.left, fromTable, toTable);
      const right = mapOperand(node.right, fromTable, toTable);
      if (left === node.left && right === node.right) return node;
      return { ...node, left, right };
    }
    case 'BitwiseExpression': {
      const left = mapOperand(node.left, fromTable, toTable);
      const right = mapOperand(node.right, fromTable, toTable);
      if (left === node.left && right === node.right) return node;
      return { ...node, left, right };
    }
    default:
      return node;
  }
};

const mapOrderingTerm = (term: OrderingTerm, fromTable: string, toTable: string): OrderingTerm => {
  if (isOperandNode(term)) {
    return mapOperand(term, fromTable, toTable);
  }
  return mapExpression(term as ExpressionNode, fromTable, toTable);
};

const mapScalarSubquery = (
  node: ScalarSubqueryNode,
  fromTable: string,
  toTable: string
): ScalarSubqueryNode => {
  const mapped = mapSelectQuery(node.query, fromTable, toTable);
  if (mapped === node.query) return node;
  return { ...node, query: mapped };
};

type ProjectionNode = SelectQueryNode['columns'][number];

const mapProjectionNode = (
  node: ProjectionNode,
  fromTable: string,
  toTable: string
): ProjectionNode => {
  switch (node.type) {
    case 'Column':
      return mapColumn(node, fromTable, toTable);
    case 'Function':
      return mapOperand(node, fromTable, toTable) as FunctionNode;
    case 'CaseExpression':
      return mapOperand(node, fromTable, toTable) as CaseExpressionNode;
    case 'Cast':
      return mapOperand(node, fromTable, toTable) as CastExpressionNode;
    case 'WindowFunction':
      return mapOperand(node, fromTable, toTable) as WindowFunctionNode;
    case 'ScalarSubquery':
      return mapScalarSubquery(node, fromTable, toTable);
    default:
      return node;
  }
};

const mapSelectQuery = (query: SelectQueryNode, fromTable: string, toTable: string): SelectQueryNode => {
  const nextColumns = query.columns.map(col => mapProjectionNode(col, fromTable, toTable));
  const nextJoins = query.joins.map(join => ({
    ...join,
    condition: mapExpression(join.condition, fromTable, toTable)
  }));
  const nextWhere = query.where ? mapExpression(query.where, fromTable, toTable) : query.where;
  const nextHaving = query.having ? mapExpression(query.having, fromTable, toTable) : query.having;
  const nextGroupBy = query.groupBy?.map(term => mapOrderingTerm(term, fromTable, toTable));
  const nextOrderBy = query.orderBy?.map(ob => ({
    ...ob,
    term: mapOrderingTerm(ob.term, fromTable, toTable)
  }));
  const nextDistinct = query.distinct?.map(col => mapColumn(col, fromTable, toTable));
  const nextSetOps = query.setOps?.map(op => ({ ...op, query: mapSelectQuery(op.query, fromTable, toTable) }));
  const nextCtes = query.ctes?.map(cte => ({ ...cte, query: mapSelectQuery(cte.query, fromTable, toTable) }));

  const changed =
    nextColumns.some((c, i) => c !== query.columns[i]) ||
    nextJoins.some((j, i) => j.condition !== query.joins[i].condition) ||
    nextWhere !== query.where ||
    nextHaving !== query.having ||
    (nextGroupBy && query.groupBy && nextGroupBy.some((t, i) => t !== query.groupBy![i])) ||
    (nextOrderBy && query.orderBy && nextOrderBy.some((o, i) => o.term !== query.orderBy![i].term)) ||
    (nextDistinct && query.distinct && nextDistinct.some((d, i) => d !== query.distinct![i])) ||
    (nextSetOps && query.setOps && nextSetOps.some((o, i) => o.query !== query.setOps![i].query)) ||
    (nextCtes && query.ctes && nextCtes.some((c, i) => c.query !== query.ctes![i].query));

  if (!changed) return query;

  return {
    ...query,
    columns: nextColumns,
    joins: nextJoins,
    where: nextWhere,
    having: nextHaving,
    groupBy: nextGroupBy,
    orderBy: nextOrderBy,
    distinct: nextDistinct,
    setOps: nextSetOps,
    ctes: nextCtes
  };
};

const getIncludeNode = (
  tree: NormalizedRelationIncludeTree,
  segments: string[]
): { options?: RelationIncludeOptions; exists: boolean } => {
  let current: NormalizedRelationIncludeTree | undefined = tree;
  let node: { options?: RelationIncludeOptions; include?: NormalizedRelationIncludeTree } | undefined;
  for (let i = 0; i < segments.length; i += 1) {
    if (!current) return { exists: false };
    node = current[segments[i]];
    if (!node) return { exists: false };
    if (i < segments.length - 1) {
      current = node.include;
    }
  }
  return { options: node?.options, exists: Boolean(node) };
};

const setIncludeOptions = (
  tree: NormalizedRelationIncludeTree,
  segments: string[],
  options: RelationIncludeOptions
): void => {
  let current: NormalizedRelationIncludeTree = tree;
  for (let i = 0; i < segments.length; i += 1) {
    const key = segments[i];
    const isLeaf = i === segments.length - 1;
    const existing = current[key] ?? {};
    if (isLeaf) {
      current[key] = { ...existing, options };
      return;
    }
    const nextInclude = existing.include ?? {};
    current[key] = { ...existing, include: nextInclude };
    current = nextInclude;
  }
};

const updateJoins = (state: SelectQueryState, joins: JoinNode[]): SelectQueryState => {
  return new SelectQueryState(state.table, {
    ...state.ast,
    joins
  });
};

const buildBelongsToManyTargetCondition = (
  relation: BelongsToManyRelation,
  targetName: string,
  extra?: ExpressionNode
): ExpressionNode => {
  const targetKey = relation.targetKey || findPrimaryKey(relation.target);
  let condition: ExpressionNode = eq(
    { type: 'Column', table: targetName, name: targetKey },
    { type: 'Column', table: relation.pivotTable.name, name: relation.pivotForeignKeyToTarget }
  );
  if (extra) {
    condition = and(condition, extra);
  }
  return condition;
};

const addRelationJoin = (
  state: SelectQueryState,
  rootTable: TableDef,
  rootAlias: string | undefined,
  relationKey: string,
  relation: RelationDef,
  joinKind: JoinKind,
  filter?: ExpressionNode
): SelectQueryState => {
  if (relation.type === RelationKinds.BelongsToMany) {
    const many = relation as BelongsToManyRelation;
    let targetSource: TableSourceNode = {
      type: 'Table',
      name: relation.target.name,
      schema: relation.target.schema
    };
    targetSource = ensureCorrelationName(state, relationKey, targetSource, [many.pivotTable.name]);
    const targetName = getExposedName(targetSource) ?? relation.target.name;
    const extra = remapExpressionTable(filter, relation.target.name, targetName);
    const joins = buildBelongsToManyJoins(
      rootTable,
      relationKey,
      many,
      joinKind,
      extra,
      rootAlias,
      targetSource,
      targetName
    );
    return joins.reduce((curr, join) => curr.withJoin(join), state);
  }

  let targetSource: TableSourceNode = {
    type: 'Table',
    name: relation.target.name,
    schema: relation.target.schema
  };
  targetSource = ensureCorrelationName(state, relationKey, targetSource);
  const targetName = getExposedName(targetSource) ?? relation.target.name;
  const extra = remapExpressionTable(filter, relation.target.name, targetName);
  const condition = buildRelationJoinCondition(rootTable, relation, extra, rootAlias, targetName);
  const joinNode = createJoinNode(joinKind, targetSource, condition, relationKey);
  return state.withJoin(joinNode);
};

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

  const internal = qb as unknown as BuilderInternals<T, TTable>;
  let state = internal.context.state;
  const hydration = internal.context.hydration;
  let currentTable: TableDef = qb.getTable();
  let currentAlias = getExposedName(state.ast.from) ?? currentTable.name;

  const includeInfo = getIncludeNode(internal.includeTree, segments);
  const existingOptions = includeInfo.options ?? {};
  const nextOptions = updater({ ...existingOptions });

  let nextIncludeTree = internal.includeTree;
  const shouldCreateIncludePath = segments.length === 1 || includeInfo.exists;
  if (shouldCreateIncludePath) {
    nextIncludeTree = cloneRelationIncludeTree(internal.includeTree);
    setIncludeOptions(nextIncludeTree, segments, nextOptions);
  }

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    const relation = currentTable.relations[segment];
    if (!relation) {
      throw new Error(`Relation '${segment}' not found on table '${currentTable.name}'`);
    }

    const relationKey = segments.slice(0, i + 1).join('__');
    const joinIndex = findJoinIndex(state.ast.joins, relationKey);
    const isLeaf = i === segments.length - 1;

    if (isLeaf) {
      if (joinIndex === -1) {
        const joinKind = nextOptions.joinKind ?? JOIN_KINDS.LEFT;
        state = addRelationJoin(state, currentTable, currentAlias, relationKey, relation, joinKind, nextOptions.filter);
      } else {
        const joins = [...state.ast.joins];
        const join = joins[joinIndex];
        const targetName = getExposedName(join.table) ?? relation.target.name;
        const extra = remapExpressionTable(nextOptions.filter, relation.target.name, targetName);

        if (relation.type === RelationKinds.BelongsToMany) {
          const many = relation as BelongsToManyRelation;
          const targetCondition = buildBelongsToManyTargetCondition(many, targetName, extra);
          joins[joinIndex] = {
            ...join,
            kind: nextOptions.joinKind ?? join.kind,
            condition: targetCondition
          };
          if (nextOptions.joinKind && joinIndex > 0) {
            const pivotJoin = joins[joinIndex - 1];
            const pivotTable = pivotJoin.table.type === 'Table' ? pivotJoin.table.name : undefined;
            if (pivotTable === many.pivotTable.name) {
              joins[joinIndex - 1] = { ...pivotJoin, kind: nextOptions.joinKind };
            }
          }
        } else {
          const condition = buildRelationJoinCondition(currentTable, relation, extra, currentAlias, targetName);
          joins[joinIndex] = {
            ...join,
            kind: nextOptions.joinKind ?? join.kind,
            condition
          };
        }

        state = updateJoins(state, joins);
      }
    } else if (joinIndex === -1) {
      const segmentOptions = getIncludeNode(internal.includeTree, segments.slice(0, i + 1)).options;
      const joinKind = segmentOptions?.joinKind ?? JOIN_KINDS.LEFT;
      state = addRelationJoin(state, currentTable, currentAlias, relationKey, relation, joinKind, segmentOptions?.filter);
    }

    const joinForSegment = getJoinByKey(state.ast.joins, relationKey);
    currentAlias = joinForSegment ? (getExposedName(joinForSegment.table) ?? relation.target.name) : relation.target.name;
    currentTable = relation.target;
  }

  const nextContext = { state, hydration };
  return internal.clone(nextContext, undefined, undefined, nextIncludeTree);
};
