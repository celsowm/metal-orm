import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { SelectQueryNode, HydrationPlan } from '../ast/query';
import { ColumnNode, ExpressionNode, FunctionNode, LiteralNode, BinaryExpressionNode, eq, and } from '../ast/expression';
import { JoinNode } from '../ast/join';
import { Dialect } from '../dialect/abstract';

const findPrimaryKey = (table: TableDef): string => {
  const pk = Object.values(table.columns).find(c => c.primary);
  return pk?.name || 'id';
};

const buildDefaultHydrationPlan = (table: TableDef): HydrationPlan => ({
  rootTable: table.name,
  rootPrimaryKey: findPrimaryKey(table),
  rootColumns: [],
  relations: []
});

const isRelationAlias = (alias?: string) => alias ? alias.includes('__') : false;

export class SelectQueryBuilder<T> {
  private ast: SelectQueryNode;
  private table: TableDef;
  private hydrationPlan?: HydrationPlan;

  constructor(table: TableDef, ast?: SelectQueryNode, hydrationPlan?: HydrationPlan) {
    this.table = table;
    this.ast = ast ?? {
      type: 'SelectQuery',
      from: { type: 'Table', name: table.name },
      columns: [],
      joins: []
    };
    this.hydrationPlan = hydrationPlan;
  }

  private clone(ast: SelectQueryNode, hydrationPlan: HydrationPlan | undefined = this.hydrationPlan): SelectQueryBuilder<T> {
    return new SelectQueryBuilder(this.table, ast, hydrationPlan);
  }

  select(columns: Record<string, ColumnDef | FunctionNode>): SelectQueryBuilder<T> {
    const existingAliases = new Set(this.ast.columns.map(c => (c as ColumnNode).alias || (c as ColumnNode).name));
    const newCols = Object.entries(columns).reduce<(ColumnNode | FunctionNode)[]>((acc, [alias, val]) => {
      if (existingAliases.has(alias)) return acc;

      if ((val as any).type === 'Function') {
        acc.push({ ...(val as FunctionNode), alias });
        return acc;
      }

      const colDef = val as ColumnDef;
      acc.push({
        type: 'Column',
        table: colDef.table || 'unknown',
        name: colDef.name,
        alias
      } as ColumnNode);
      return acc;
    }, []);

    const nextAst: SelectQueryNode = {
      ...this.ast,
      columns: [...this.ast.columns, ...newCols]
    };

    let nextPlan = this.hydrationPlan;
    if (nextPlan) {
      const rootCols = new Set(nextPlan.rootColumns);
      newCols.forEach(col => {
        if (col.type === 'Column' && (col as ColumnNode).table === this.table.name && !isRelationAlias((col as ColumnNode).alias)) {
          rootCols.add((col as ColumnNode).alias || (col as ColumnNode).name);
        }
      });
      nextPlan = { ...nextPlan, rootColumns: Array.from(rootCols) };
    }

    return this.clone(nextAst, nextPlan);
  }

  // Simplified select for backward compatibility/demo string parsing
  selectRaw(...cols: string[]): SelectQueryBuilder<T> {
    const newCols = cols.map(c => {
      if (c.includes('(')) {
        // VERY basic support for aggregates like COUNT(id) for the demo
        const [fn, rest] = c.split('(');
        const colName = rest.replace(')', '');
        const [table, name] = colName.includes('.') ? colName.split('.') : ['unknown', colName];
        return { type: 'Column', table, name, alias: c } as ColumnNode;
      }

      const [table, name] = c.split('.');
      return { type: 'Column', table, name } as ColumnNode;
    });

    return this.clone({
      ...this.ast,
      columns: [...this.ast.columns, ...newCols]
    });
  }

  innerJoin(table: TableDef, condition: BinaryExpressionNode): SelectQueryBuilder<T> {
    const joinNode: JoinNode = {
      type: 'Join',
      kind: 'INNER',
      table: { type: 'Table', name: table.name },
      condition
    };
    return this.clone({
      ...this.ast,
      joins: [...this.ast.joins, joinNode]
    });
  }

  /**
   * Match semantics: INNER JOIN a relation with optional predicate and DISTINCT on root.
   * Keeps the parent selection but only where the relation matches.
   */
  match(relationName: string, predicate?: ExpressionNode): SelectQueryBuilder<T> {
    const joined = this.joinRelation(relationName, 'INNER', predicate);
    const pk = findPrimaryKey(this.table);
    const distinctCols = [{ type: 'Column', table: this.table.name, name: pk } as ColumnNode];
    const existingDistinct = joined.ast.distinct ? joined.ast.distinct : [];
    const nextDistinct = [...existingDistinct, ...distinctCols];
    return new SelectQueryBuilder(this.table, { ...joined.ast, distinct: nextDistinct }, joined.hydrationPlan);
  }

  /**
   * Smart Join: Automatically joins a defined relationship.
   * e.g. .joinRelation('orders')
   */
  joinRelation(relationName: string, joinKind: 'INNER' | 'LEFT' = 'INNER', extraCondition?: ExpressionNode): SelectQueryBuilder<T> {
    const relation = this.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.table.name}'`);
    }

    let condition: BinaryExpressionNode;

    if (relation.type === 'HAS_MANY') {
      // Parent (Users) has many Children (Orders)
      // JOIN orders ON orders.user_id = users.id
      condition = eq(
        { type: 'Column', table: relation.target.name, name: relation.foreignKey }, // orders.user_id
        { type: 'Column', table: this.table.name, name: relation.localKey || 'id' } // users.id
      );
    } else {
      // Child (Orders) belongs to Parent (Users)
      // JOIN users ON users.id = orders.user_id
      condition = eq(
        { type: 'Column', table: relation.target.name, name: relation.localKey || 'id' }, // users.id
        { type: 'Column', table: this.table.name, name: relation.foreignKey } // orders.user_id
      );
    }

    if (extraCondition) {
      condition = and(condition, extraCondition);
    }

    const joinNode: JoinNode = {
      type: 'Join',
      kind: joinKind,
      table: { type: 'Table', name: relation.target.name },
      condition,
      relationName // Store intent for codegen
    };

    return this.clone({
      ...this.ast,
      joins: [...this.ast.joins, joinNode]
    });
  }

  /**
   * Eager-load a relation and embed its projection with an alias prefix.
   * This preserves a flat SQL result while enabling JSON hydration.
   * Similar to CakePHP contain(): LEFT join + optional filter on the relation without dropping parents.
   */
  include(
    relationName: string,
    options?: { columns?: string[], aliasPrefix?: string, filter?: ExpressionNode, joinKind?: 'LEFT' | 'INNER' }
  ): SelectQueryBuilder<T> {
    const relation = this.table.relations[relationName];
    if (!relation) {
      throw new Error(`Relation '${relationName}' not found on table '${this.table.name}'`);
    }

    const aliasPrefix = options?.aliasPrefix || relationName;
    const alreadyJoined = this.ast.joins.some(j => j.relationName === relationName);
    const builderWithJoin = alreadyJoined
      ? this
      : this.joinRelation(relationName, options?.joinKind || 'LEFT', options?.filter);

    const primaryKey = findPrimaryKey(this.table);
    const hasPrimarySelected = builderWithJoin.ast.columns
      .some(col => !isRelationAlias((col as ColumnNode).alias) && ((col as ColumnNode).alias || (col as ColumnNode).name) === primaryKey);

    let workingBuilder: SelectQueryBuilder<T> = builderWithJoin;

    // Ensure we have a base projection; default to full table columns if none provided.
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

    const targetColumns = options?.columns?.length ? options.columns : Object.keys(relation.target.columns);
    const relationSelection = targetColumns.reduce((acc, key) => {
      const def = (relation.target.columns as any)[key];
      if (!def) {
        throw new Error(`Column '${key}' not found on relation '${relationName}'`);
      }
      acc[`${aliasPrefix}__${key}`] = def;
      return acc;
    }, {} as Record<string, ColumnDef>);

    const withRelationProjection = workingBuilder.select(relationSelection);
    const basePlan = withRelationProjection.hydrationPlan ?? buildDefaultHydrationPlan(this.table);

    const rootCols = new Set(basePlan.rootColumns.length ? basePlan.rootColumns : []);
    withRelationProjection.ast.columns
      .filter(col => !isRelationAlias((col as ColumnNode).alias))
      .forEach(col => {
        rootCols.add((col as ColumnNode).alias || (col as ColumnNode).name);
      });

    const relations = basePlan.relations.filter(r => r.name !== relationName);
    relations.push({
      name: relationName,
      aliasPrefix,
      type: relation.type,
      targetTable: relation.target.name,
      targetPrimaryKey: findPrimaryKey(relation.target),
      foreignKey: relation.foreignKey,
      localKey: relation.localKey || 'id',
      columns: targetColumns
    });

    const nextPlan: HydrationPlan = {
      ...basePlan,
      rootColumns: Array.from(rootCols),
      relations
    };

    return new SelectQueryBuilder(this.table, withRelationProjection.ast, nextPlan);
  }

  where(expr: ExpressionNode): SelectQueryBuilder<T> {
    return this.clone({
      ...this.ast,
      where: expr
    });
  }

  groupBy(col: ColumnDef | ColumnNode): SelectQueryBuilder<T> {
    const node: ColumnNode = (col as any).type === 'Column'
      ? (col as ColumnNode)
      : { type: 'Column', table: (col as ColumnDef).table!, name: (col as ColumnDef).name };

    return this.clone({
      ...this.ast,
      groupBy: [...(this.ast.groupBy || []), node]
    });
  }

  orderBy(col: ColumnDef | ColumnNode, direction: 'ASC' | 'DESC' = 'ASC'): SelectQueryBuilder<T> {
    const node: ColumnNode = (col as any).type === 'Column'
      ? (col as ColumnNode)
      : { type: 'Column', table: (col as ColumnDef).table!, name: (col as ColumnDef).name };

    return this.clone({
      ...this.ast,
      orderBy: [...(this.ast.orderBy || []), { type: 'OrderBy', column: node, direction }]
    });
  }

  distinct(...cols: (ColumnDef | ColumnNode)[]): SelectQueryBuilder<T> {
    const nodes = cols.map(col => (col as any).type === 'Column'
      ? (col as ColumnNode)
      : { type: 'Column', table: (col as ColumnDef).table!, name: (col as ColumnDef).name });
    return this.clone({
      ...this.ast,
      distinct: [...(this.ast.distinct || []), ...nodes]
    });
  }

  limit(n: number): SelectQueryBuilder<T> {
    return this.clone({ ...this.ast, limit: n });
  }

  offset(n: number): SelectQueryBuilder<T> {
    return this.clone({ ...this.ast, offset: n });
  }

  toSql(dialect: Dialect): string {
    return dialect.compileSelect(this.ast);
  }

  getHydrationPlan(): HydrationPlan | undefined {
    return this.hydrationPlan;
  }

  getAST(): SelectQueryNode {
    if (this.hydrationPlan) {
      return { ...this.ast, meta: { ...(this.ast.meta || {}), hydration: this.hydrationPlan } };
    }
    return this.ast;
  }
}

// Helpers for the playground
export const createColumn = (table: string, name: string): ColumnNode => ({ type: 'Column', table, name });
export const createLiteral = (val: string | number): LiteralNode => ({ type: 'Literal', value: val });
