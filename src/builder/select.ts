import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { SelectQueryNode, HydrationPlan } from '../ast/query';
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
import { CompiledQuery, Dialect } from '../dialect/abstract';
import { SelectQueryState } from './select-query-state';
import { HydrationManager } from './hydration-manager';
import {
  defaultSelectQueryBuilderDependencies,
  SelectQueryBuilderContext,
  SelectQueryBuilderDependencies,
  SelectQueryBuilderEnvironment
} from './select-query-builder-deps';
import { ColumnSelector } from './operations/column-selector';
import { CteManager } from './operations/cte-manager';
import { JoinManager } from './operations/join-manager';
import { FilterManager } from './operations/filter-manager';
import { PaginationManager } from './operations/pagination-manager';
import { RelationManager, RelationIncludeOptions } from './operations/relation-manager';
import { JOIN_KINDS, JoinKind, ORDER_DIRECTIONS, OrderDirection } from '../constants/sql';

export class SelectQueryBuilder<T> {
  private readonly env: SelectQueryBuilderEnvironment;
  private readonly context: SelectQueryBuilderContext;
  private readonly columnSelector: ColumnSelector;
  private readonly cteManager: CteManager;
  private readonly joinManager: JoinManager;
  private readonly filterManager: FilterManager;
  private readonly paginationManager: PaginationManager;
  private readonly relationManager: RelationManager;

  constructor(
    table: TableDef,
    state?: SelectQueryState,
    hydration?: HydrationManager,
    dependencies?: SelectQueryBuilderDependencies
  ) {
    const deps = dependencies ?? defaultSelectQueryBuilderDependencies;
    this.env = { table, deps };
    const initialState = state ?? deps.createState(table);
    const initialHydration = hydration ?? deps.createHydration(table);
    this.context = {
      state: initialState,
      hydration: initialHydration
    };
    this.columnSelector = new ColumnSelector(this.env);
    this.cteManager = new CteManager(this.env);
    this.joinManager = new JoinManager(this.env);
    this.filterManager = new FilterManager(this.env);
    this.paginationManager = new PaginationManager(this.env);
    this.relationManager = new RelationManager(this.env);
  }

  private clone(context: SelectQueryBuilderContext = this.context): SelectQueryBuilder<T> {
    return new SelectQueryBuilder(this.env.table, context.state, context.hydration, this.env.deps);
  }

  private resolveQueryNode(query: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryNode {
    return typeof (query as any).getAST === 'function'
      ? (query as SelectQueryBuilder<any>).getAST()
      : (query as SelectQueryNode);
  }

  private createChildBuilder<R>(table: TableDef): SelectQueryBuilder<R> {
    return new SelectQueryBuilder(table, undefined, undefined, this.env.deps);
  }

  select(columns: Record<string, ColumnDef | FunctionNode | CaseExpressionNode | WindowFunctionNode>): SelectQueryBuilder<T> {
    return this.clone(this.columnSelector.select(this.context, columns));
  }

  selectRaw(...cols: string[]): SelectQueryBuilder<T> {
    return this.clone(this.columnSelector.selectRaw(this.context, cols));
  }

  with(name: string, query: SelectQueryBuilder<any> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(query);
    const nextContext = this.cteManager.withCte(this.context, name, subAst, columns, false);
    return this.clone(nextContext);
  }

  withRecursive(name: string, query: SelectQueryBuilder<any> | SelectQueryNode, columns?: string[]): SelectQueryBuilder<T> {
    const subAst = this.resolveQueryNode(query);
    const nextContext = this.cteManager.withCte(this.context, name, subAst, columns, true);
    return this.clone(nextContext);
  }

  selectSubquery(alias: string, sub: SelectQueryBuilder<any> | SelectQueryNode): SelectQueryBuilder<T> {
    const query = this.resolveQueryNode(sub);
    return this.clone(this.columnSelector.selectSubquery(this.context, alias, query));
  }

  innerJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.joinManager.join(this.context, table, condition, JOIN_KINDS.INNER);
    return this.clone(nextContext);
  }

  leftJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.joinManager.join(this.context, table, condition, JOIN_KINDS.LEFT);
    return this.clone(nextContext);
  }

  rightJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.joinManager.join(this.context, table, condition, JOIN_KINDS.RIGHT);
    return this.clone(nextContext);
  }

  match(relationName: string, predicate?: ExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.relationManager.match(this.context, relationName, predicate);
    return this.clone(nextContext);
  }

  joinRelation(
    relationName: string,
    joinKind: JoinKind = JOIN_KINDS.INNER,
    extraCondition?: ExpressionNode
  ): SelectQueryBuilder<T> {
    const nextContext = this.relationManager.joinRelation(this.context, relationName, joinKind, extraCondition);
    return this.clone(nextContext);
  }

  include(relationName: string, options?: RelationIncludeOptions): SelectQueryBuilder<T> {
    const nextContext = this.relationManager.include(this.context, relationName, options);
    return this.clone(nextContext);
  }

  where(expr: ExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.filterManager.where(this.context, expr);
    return this.clone(nextContext);
  }

  groupBy(col: ColumnDef | ColumnNode): SelectQueryBuilder<T> {
    const nextContext = this.filterManager.groupBy(this.context, col);
    return this.clone(nextContext);
  }

  having(expr: ExpressionNode): SelectQueryBuilder<T> {
    const nextContext = this.filterManager.having(this.context, expr);
    return this.clone(nextContext);
  }

  orderBy(col: ColumnDef | ColumnNode, direction: OrderDirection = ORDER_DIRECTIONS.ASC): SelectQueryBuilder<T> {
    const nextContext = this.filterManager.orderBy(this.context, col, direction);
    return this.clone(nextContext);
  }

  distinct(...cols: (ColumnDef | ColumnNode)[]): SelectQueryBuilder<T> {
    return this.clone(this.columnSelector.distinct(this.context, cols));
  }

  limit(n: number): SelectQueryBuilder<T> {
    const nextContext = this.paginationManager.limit(this.context, n);
    return this.clone(nextContext);
  }

  offset(n: number): SelectQueryBuilder<T> {
    const nextContext = this.paginationManager.offset(this.context, n);
    return this.clone(nextContext);
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
    const relation = this.env.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.env.table.name}'`);
    }

    let subQb = this.createChildBuilder<any>(relation.target);
    if (callback) {
      subQb = callback(subQb);
    }

    const subAst = subQb.getAST();
    const finalSubAst = this.relationManager.applyRelationCorrelation(this.context, relationName, subAst);
    return this.where(exists(finalSubAst));
  }

  whereHasNot(
    relationName: string,
    callback?: (qb: SelectQueryBuilder<any>) => SelectQueryBuilder<any>
  ): SelectQueryBuilder<T> {
    const relation = this.env.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.env.table.name}'`);
    }

    let subQb = this.createChildBuilder<any>(relation.target);
    if (callback) {
      subQb = callback(subQb);
    }

    const subAst = subQb.getAST();
    const finalSubAst = this.relationManager.applyRelationCorrelation(this.context, relationName, subAst);
    return this.where(notExists(finalSubAst));
  }

  compile(dialect: Dialect): CompiledQuery {
    return dialect.compileSelect(this.context.state.ast);
  }

  toSql(dialect: Dialect): string {
    return this.compile(dialect).sql;
  }

  getHydrationPlan(): HydrationPlan | undefined {
    return this.context.hydration.getPlan();
  }

  getAST(): SelectQueryNode {
    return this.context.hydration.applyToAst(this.context.state.ast);
  }
}

export const createColumn = (table: string, name: string): ColumnNode => ({ type: 'Column', table, name });
export const createLiteral = (val: string | number): LiteralNode => ({ type: 'Literal', value: val });
