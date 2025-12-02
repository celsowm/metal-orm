import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { SelectQueryNode, HydrationPlan, CommonTableExpressionNode } from '../ast/query';
import {
  ColumnNode,
  ExpressionNode,
  FunctionNode,
  LiteralNode,
  BinaryExpressionNode,
  CaseExpressionNode,
  WindowFunctionNode,
  exists,
  notExists
} from '../ast/expression';
import { JoinNode } from '../ast/join';
import { CompiledQuery, Dialect } from '../dialect/abstract';
import { SelectQueryState } from './select-query-state';
import { HydrationManager } from './hydration-manager';
import { QueryAstService, buildColumnNode } from './query-ast-service';
import { RelationService } from './relation-service';

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

  private astService(state: SelectQueryState = this.state): QueryAstService {
    return new QueryAstService(this.table, state);
  }

  private resolveQueryNode(query: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryNode {
    return typeof (query as any).getAST === 'function'
      ? (query as SelectQueryBuilder<any>).getAST()
      : (query as SelectQueryNode);
  }

  private relationService(
    state: SelectQueryState = this.state,
    hydration: HydrationManager = this.hydration
  ): RelationService {
    return new RelationService(this.table, state, hydration);
  }

  select(columns: Record<string, ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode>): SelectQueryBuilder<T> {
    const { state: nextState, addedColumns } = this.astService().select(columns);
    const nextHydration = this.hydration.onColumnsSelected(nextState, addedColumns);
    return this.clone(nextState, nextHydration);
  }

  selectRaw(...cols: string[]): SelectQueryBuilder<T> {
    const { state: nextState } = this.astService().selectRaw(cols);
    return this.clone(nextState, this.hydration);
  }

  with(name: string, query: SelectQueryBuilder<any> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(query);
    const nextState = this.astService().withCte(name, subAst, columns, false);
    return this.clone(nextState, this.hydration);
  }

  withRecursive(name: string, query: SelectQueryBuilder<any> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(query);
    const nextState = this.astService().withCte(name, subAst, columns, true);
    return this.clone(nextState, this.hydration);
  }

  selectSubquery(alias: string, sub: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const query = this.resolveQueryNode(sub);
    const nextState = this.astService().selectSubquery(alias, query);
    return this.clone(nextState, this.hydration);
  }

  innerJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const joinNode: JoinNode = {
      type: 'Join',
      kind: 'INNER',
      table: { type: 'Table', name: table.name },
      condition
    };
    const nextState = this.astService().withJoin(joinNode);
    return this.clone(nextState, this.hydration);
  }

  leftJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const joinNode: JoinNode = {
      type: 'Join',
      kind: 'LEFT',
      table: { type: 'Table', name: table.name },
      condition
    };
    const nextState = this.astService().withJoin(joinNode);
    return this.clone(nextState, this.hydration);
  }

  rightJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const joinNode: JoinNode = {
      type: 'Join',
      kind: 'RIGHT',
      table: { type: 'Table', name: table.name },
      condition
    };
    const nextState = this.astService().withJoin(joinNode);
    return this.clone(nextState, this.hydration);
  }

  match(relationName: string, predicate?: ExpressionNode): SelectQueryBuilder<T> {
    const result = this.relationService().match(relationName, predicate);
    return this.clone(result.state, result.hydration);
  }

  joinRelation(
    relationName: string,
    joinKind: 'INNER' | 'LEFT' | 'RIGHT' = 'INNER',
    extraCondition?: ExpressionNode
  ): SelectQueryBuilder<T> {
    const result = this.relationService().joinRelation(relationName, joinKind, extraCondition);
    return this.clone(result.state, result.hydration);
  }

  include(
    relationName: string,
    options?: { columns?: string[]; aliasPrefix?: string; filter?: ExpressionNode; joinKind?: 'LEFT' | 'INNER' }
  ): SelectQueryBuilder<T> {
    const result = this.relationService().include(relationName, options);
    return this.clone(result.state, result.hydration);
  }

  where(expr: ExpressionNode): SelectQueryBuilder<T> {
    const nextState = this.astService().withWhere(expr);
    return this.clone(nextState, this.hydration);
  }

  groupBy(col: ColumnDef | ColumnNode): SelectQueryBuilder<T> {
    const nextState = this.astService().withGroupBy(col);
    return this.clone(nextState, this.hydration);
  }

  having(expr: ExpressionNode): SelectQueryBuilder<T> {
    const nextState = this.astService().withHaving(expr);
    return this.clone(nextState, this.hydration);
  }

  orderBy(col: ColumnDef | ColumnNode, direction: 'ASC' | 'DESC' = 'ASC'): SelectQueryBuilder<T> {
    const nextState = this.astService().withOrderBy(col, direction);
    return this.clone(nextState, this.hydration);
  }

  distinct(...cols: (ColumnDef | ColumnNode)[]): SelectQueryBuilder<T> {
    const nodes: ColumnNode[] = cols.map(col => buildColumnNode(this.table, col));
    const nextState = this.astService().withDistinct(nodes);
    return this.clone(nextState, this.hydration);
  }

  limit(n: number): SelectQueryBuilder<T> {
    const nextState = this.astService().withLimit(n);
    return this.clone(nextState, this.hydration);
  }

  offset(n: number): SelectQueryBuilder<T> {
    const nextState = this.astService().withOffset(n);
    return this.clone(nextState, this.hydration);
  }

  whereExists(subquery: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(subquery);
    return this.where(exists(subAst));
  }

  whereNotExists(subquery: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(subquery);
    return this.where(notExists(subAst));
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
    const finalSubAst = this.relationService().applyRelationCorrelation(relationName, subAst);
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
    const finalSubAst = this.relationService().applyRelationCorrelation(relationName, subAst);
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
