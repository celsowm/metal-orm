import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { SelectQueryNode, HydrationPlan, CommonTableExpressionNode } from '../ast/query';
import {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  LiteralNode,
  BinaryExpressionNode,
  ScalarSubqueryNode,
  CaseExpressionNode,
  WindowFunctionNode,
  and,
  exists,
  notExists
} from '../ast/expression';
import { JoinNode } from '../ast/join';
import { CompiledQuery, Dialect } from '../dialect/abstract';
import { SelectQueryState, ProjectionNode } from './select-query-state';
import { HydrationManager } from './hydration-manager';
import { findPrimaryKey, isRelationAlias } from './hydration-planner';
import { buildRelationJoinCondition, buildRelationCorrelation } from './relation-conditions';

const toColumnNode = (col: ColumnDef | ColumnNode): ColumnNode => {
  if ((col as ColumnNode).type === 'Column') {
    return col as ColumnNode;
  }

  const def = col as ColumnDef;
  return {
    type: 'Column',
    table: def.table || 'unknown',
    name: def.name
  };
};

export class SelectQueryBuilder<T> {
  private readonly table: TableDef;
  private readonly state: SelectQueryState;
  private readonly hydration: HydrationManager;

  constructor(table: TableDef, state?: SelectQueryState, hydration?: HydrationManager) {
    this.table = table;
    this.state = state ?? new SelectQueryState(table);
    this.hydration = hydration ?? new HydrationManager(table);
  }

  private get ast(): SelectQueryNode {
    return this.state.ast;
  }

  private clone(
    state: SelectQueryState = this.state,
    hydration: HydrationManager = this.hydration
  ): SelectQueryBuilder<T> {
    return new SelectQueryBuilder(this.table, state, hydration);
  }

  select(columns: Record<string, ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode>): SelectQueryBuilder<T> {
    const existingAliases = new Set(
      this.ast.columns.map(c => (c as ColumnNode).alias || (c as ColumnNode).name)
    );

    const newCols = Object.entries(columns).reduce<ProjectionNode[]>((acc, [alias, val]) => {
      if (existingAliases.has(alias)) return acc;

      if ((val as any).type === 'Function' || (val as any).type === 'CaseExpression' || (val as any).type === 'WindowFunction') {
        acc.push({ ...(val as FunctionNode | CaseExpressionNode | WindowFunctionNode), alias } as ProjectionNode);
        return acc;
      }

      const colDef = val as ColumnDef;
      acc.push({
        type: 'Column',
        table: colDef.table || this.table.name,
        name: colDef.name,
        alias
      } as ColumnNode);
      return acc;
    }, []);

    const nextState = this.state.withColumns(newCols);
    const nextHydration = this.hydration.onColumnsSelected(nextState, newCols);

    return this.clone(nextState, nextHydration);
  }

  selectRaw(...cols: string[]): SelectQueryBuilder<T> {
    const newCols = cols.map(c => {
      if (c.includes('(')) {
        const [fn, rest] = c.split('(');
        const colName = rest.replace(')', '');
        const [table, name] = colName.includes('.') ? colName.split('.') : [this.table.name, colName];
        return { type: 'Column', table, name, alias: c } as ColumnNode;
      }

      if (c.includes('.')) {
        const [potentialCteName, columnName] = c.split('.');
        const hasCte = this.ast.ctes && this.ast.ctes.some(cte => cte.name === potentialCteName);

        if (hasCte) {
          return { type: 'Column', table: this.table.name, name: c } as ColumnNode;
        }

        return { type: 'Column', table: potentialCteName, name: columnName } as ColumnNode;
      }

      return { type: 'Column', table: this.table.name, name: c } as ColumnNode;
    });

    const nextState = this.state.withColumns(newCols);
    return this.clone(nextState, this.hydration);
  }

  with(name: string, query: SelectQueryBuilder<any> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T> {
    const subAst: SelectQueryNode =
      typeof (query as any).getAST === 'function'
        ? (query as SelectQueryBuilder<any>).getAST()
        : (query as SelectQueryNode);

    const cte: CommonTableExpressionNode = {
      type: 'CommonTableExpression',
      name,
      query: subAst,
      columns,
      recursive: false
    };

    const nextState = this.state.withCte(cte);
    return this.clone(nextState, this.hydration);
  }

  withRecursive(name: string, query: SelectQueryBuilder<any> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T> {
    const subAst: SelectQueryNode =
      typeof (query as any).getAST === 'function'
        ? (query as SelectQueryBuilder<any>).getAST()
        : (query as SelectQueryNode);

    const cte: CommonTableExpressionNode = {
      type: 'CommonTableExpression',
      name,
      query: subAst,
      columns,
      recursive: true
    };

    const nextState = this.state.withCte(cte);
    return this.clone(nextState, this.hydration);
  }

  selectSubquery(alias: string, sub: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const query = sub instanceof SelectQueryBuilder ? sub.getAST() : sub;
    const node: ScalarSubqueryNode = { type: 'ScalarSubquery', query, alias };
    const nextState = this.state.withColumns([node]);
    return this.clone(nextState, this.hydration);
  }

  innerJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const joinNode: JoinNode = {
      type: 'Join',
      kind: 'INNER',
      table: { type: 'Table', name: table.name },
      condition
    };
    const nextState = this.state.withJoin(joinNode);
    return this.clone(nextState, this.hydration);
  }

  leftJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const joinNode: JoinNode = {
      type: 'Join',
      kind: 'LEFT',
      table: { type: 'Table', name: table.name },
      condition
    };
    const nextState = this.state.withJoin(joinNode);
    return this.clone(nextState, this.hydration);
  }

  rightJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const joinNode: JoinNode = {
      type: 'Join',
      kind: 'RIGHT',
      table: { type: 'Table', name: table.name },
      condition
    };
    const nextState = this.state.withJoin(joinNode);
    return this.clone(nextState, this.hydration);
  }

  match(relationName: string, predicate?: ExpressionNode): SelectQueryBuilder<T> {
    const joined = this.joinRelation(relationName, 'INNER', predicate);
    const pk = findPrimaryKey(this.table);
    const distinctCols: ColumnNode[] = [{ type: 'Column', table: this.table.name, name: pk }];
    const existingDistinct = joined.ast.distinct ? joined.ast.distinct : [];
    const nextState = joined.state.withDistinct([...existingDistinct, ...distinctCols]);
    return joined.clone(nextState, joined.hydration);
  }

  joinRelation(
    relationName: string,
    joinKind: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER',
    extraCondition?: ExpressionNode
  ): SelectQueryBuilder<T> {
    const relation = this.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.table.name}'`);
    }

    const condition = buildRelationJoinCondition(this.table, relation, extraCondition);

    const joinNode: JoinNode = {
      type: 'Join',
      kind: joinKind,
      table: { type: 'Table', name: relation.target.name },
      condition,
      relationName
    };

    const nextState = this.state.withJoin(joinNode);
    return this.clone(nextState, this.hydration);
  }

  include(
    relationName: string,
    options?: { columns?: string[]; aliasPrefix?: string; filter?: ExpressionNode; joinKind?: 'LEFT' | 'INNER' }
  ): SelectQueryBuilder<T> {
    const relation = this.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.table.name}'`);
    }

    const aliasPrefix = options?.aliasPrefix ?? relationName;
    const alreadyJoined = this.ast.joins.some(j => j.relationName === relationName);
    const builderWithJoin = alreadyJoined
      ? this
      : this.joinRelation(relationName, options?.joinKind ?? 'LEFT', options?.filter);

    const primaryKey = findPrimaryKey(this.table);
    const hasPrimarySelected = builderWithJoin.ast.columns
      .some(col => !isRelationAlias((col as ColumnNode).alias) && ((col as ColumnNode).alias || (col as ColumnNode).name) === primaryKey);

    let workingBuilder: SelectQueryBuilder<T> = builderWithJoin;

    const hasBaseProjection = workingBuilder.ast.columns.some(col => !isRelationAlias((col as ColumnNode).alias));
    if (!hasBaseProjection) {
      const baseSelection = Object.keys(this.table.columns).reduce((acc, key) => {
        acc[key] = (this.table.columns as any)[key];
        return acc;
      }, {} as Record<string, ColumnDef>);

      workingBuilder = workingBuilder.select(baseSelection);
    } else if (!hasPrimarySelected && (this.table.columns as any)[primaryKey]) {
      workingBuilder = workingBuilder.select({ [primaryKey]: (this.table.columns as any)[primaryKey] });
    }

    const targetColumns = options?.columns?.length
      ? options.columns
      : Object.keys(relation.target.columns);

    const relationSelection = targetColumns.reduce((acc, key) => {
      const def = (relation.target.columns as any)[key];
      if (!def) {
        throw new Error(`Column '${key}' not found on relation '${relationName}'`);
      }
      acc[`${aliasPrefix}__${key}`] = def;
      return acc;
    }, {} as Record<string, ColumnDef>);

    const withRelationProjection = workingBuilder.select(relationSelection);
    const nextState = withRelationProjection.state;
    const nextHydration = withRelationProjection.hydration.onRelationIncluded(
      nextState,
      relation,
      relationName,
      aliasPrefix,
      targetColumns
    );

    return withRelationProjection.clone(nextState, nextHydration);
  }

  where(expr: ExpressionNode): SelectQueryBuilder<T> {
    const combined = this.ast.where
      ? and(this.ast.where, expr)
      : expr;

    const nextState = this.state.withWhere(combined);
    return this.clone(nextState, this.hydration);
  }

  groupBy(col: ColumnDef | ColumnNode): SelectQueryBuilder<T> {
    const node: ColumnNode = (col as any).type === 'Column'
      ? (col as ColumnNode)
      : { type: 'Column', table: (col as ColumnDef).table!, name: (col as ColumnDef).name };

    const nextState = this.state.withGroupBy([node]);
    return this.clone(nextState, this.hydration);
  }

  having(expr: ExpressionNode): SelectQueryBuilder<T> {
    const combined = this.ast.having
      ? and(this.ast.having, expr)
      : expr;

    const nextState = this.state.withHaving(combined);
    return this.clone(nextState, this.hydration);
  }

  orderBy(col: ColumnDef | ColumnNode, direction: 'ASC' | 'DESC' = 'ASC'): SelectQueryBuilder<T> {
    const node: ColumnNode = (col as any).type === 'Column'
      ? (col as ColumnNode)
      : { type: 'Column', table: (col as ColumnDef).table!, name: (col as ColumnDef).name };

    const nextState = this.state.withOrderBy([{ type: 'OrderBy', column: node, direction }]);
    return this.clone(nextState, this.hydration);
  }

  distinct(...cols: (ColumnDef | ColumnNode)[]): SelectQueryBuilder<T> {
    const nodes: ColumnNode[] = cols.map(toColumnNode);
    const nextState = this.state.withDistinct(nodes);
    return this.clone(nextState, this.hydration);
  }

  limit(n: number): SelectQueryBuilder<T> {
    return this.clone(this.state.withLimit(n), this.hydration);
  }

  offset(n: number): SelectQueryBuilder<T> {
    return this.clone(this.state.withOffset(n), this.hydration);
  }

  whereExists(subquery: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const subAst: SelectQueryNode =
      typeof (subquery as any).getAST === 'function'
        ? (subquery as SelectQueryBuilder<any>).getAST()
        : (subquery as SelectQueryNode);

    const existsExpr = exists(subAst);
    return this.where(existsExpr);
  }

  whereNotExists(subquery: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const subAst: SelectQueryNode =
      typeof (subquery as any).getAST === 'function'
        ? (subquery as SelectQueryBuilder<any>).getAST()
        : (subquery as SelectQueryNode);

    const expr = notExists(subAst);
    return this.where(expr);
  }

  whereHas(
    relationName: string,
    callback?: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>
  ): SelectQueryBuilder<T> {
    const relation = this.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.table.name}'`);
    }

    let subQb = new SelectQueryBuilder<any>(relation.target);
    if (callback) {
      subQb = callback(subQb);
    }

    const subAst = subQb.getAST();
    const correlation = buildRelationCorrelation(this.table, relation);

    const whereInSubquery = subAst.where
      ? and(correlation, subAst.where)
      : correlation;

    const finalSubAst: SelectQueryNode = {
      ...subAst,
      where: whereInSubquery
    };

    return this.where(exists(finalSubAst));
  }

  whereHasNot(
    relationName: string,
    callback?: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>
  ): SelectQueryBuilder<T> {
    const relation = this.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.table.name}'`);
    }

    let subQb = new SelectQueryBuilder<any>(relation.target);
    if (callback) {
      subQb = callback(subQb);
    }

    const subAst = subQb.getAST();
    const correlation = buildRelationCorrelation(this.table, relation);

    const whereInSubquery = subAst.where
      ? and(correlation, subAst.where)
      : correlation;

    const finalSubAst: SelectQueryNode = {
      ...subAst,
      where: whereInSubquery
    };

    return this.where(notExists(finalSubAst));
  }

  compile(dialect: Dialect): CompiledQuery {
    return dialect.compileSelect(this.state.ast);
  }

  toSql(dialect: Dialect): string {
    return this.compile(dialect).sql;
  }

  getHydrationPlan(): HydrationPlan | undefined {
    return this.hydration.getPlan();
  }

  getAST(): SelectQueryNode {
    return this.hydration.applyToAst(this.state.ast);
  }
}

export const createColumn = (table: string, name: string): ColumnNode => ({ type: 'Column', table, name });
export const createLiteral = (val: string | number): LiteralNode => ({ type: 'Literal', value: val });
