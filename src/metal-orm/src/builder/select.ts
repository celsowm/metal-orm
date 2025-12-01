import { TableDef } from '../schema/table';
import { ColumnDef } from '../schema/column';
import { SelectQueryNode, TableNode } from '../ast/query';
import { ColumnNode, ExpressionNode, FunctionNode, LiteralNode, BinaryExpressionNode, eq } from '../ast/expression';
import { JoinNode } from '../ast/join';
import { Dialect } from '../dialect/abstract';

export class SelectQueryBuilder<T> {
  private ast: SelectQueryNode;
  private table: TableDef;

  constructor(table: TableDef, ast?: SelectQueryNode) {
    this.table = table;
    if (ast) {
        this.ast = ast;
    } else {
        this.ast = {
            type: 'SelectQuery',
            from: { type: 'Table', name: table.name },
            columns: [],
            joins: []
        };
    }
  }

  select(columns: Record<string, ColumnDef | FunctionNode>): SelectQueryBuilder<T> {
    const newCols = Object.entries(columns).map(([alias, val]) => {
        if ((val as any).type === 'Function') {
            return { ...(val as FunctionNode), alias };
        }
        const colDef = val as ColumnDef;
        return {
            type: 'Column',
            table: colDef.table || 'unknown',
            name: colDef.name,
            alias
        } as ColumnNode;
    });

    return new SelectQueryBuilder(this.table, {
        ...this.ast,
        columns: [...this.ast.columns, ...newCols]
    });
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
      return new SelectQueryBuilder(this.table, {
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
     return new SelectQueryBuilder(this.table, {
         ...this.ast,
         joins: [...this.ast.joins, joinNode]
     });
  }

  /**
   * Smart Join: Automatically joins a defined relationship.
   * e.g. .joinRelation('orders')
   */
  joinRelation(relationName: string): SelectQueryBuilder<T> {
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

      const joinNode: JoinNode = {
          type: 'Join',
          kind: 'INNER',
          table: { type: 'Table', name: relation.target.name },
          condition,
          relationName // Store intent for codegen
      };

      return new SelectQueryBuilder(this.table, {
          ...this.ast,
          joins: [...this.ast.joins, joinNode]
      });
  }

  where(expr: ExpressionNode): SelectQueryBuilder<T> {
      return new SelectQueryBuilder(this.table, {
          ...this.ast,
          where: expr
      });
  }

  groupBy(col: ColumnDef | ColumnNode): SelectQueryBuilder<T> {
      const node: ColumnNode = (col as any).type === 'Column' 
        ? (col as ColumnNode) 
        : { type: 'Column', table: (col as ColumnDef).table!, name: (col as ColumnDef).name };

      return new SelectQueryBuilder(this.table, {
          ...this.ast,
          groupBy: [...(this.ast.groupBy || []), node]
      });
  }

  orderBy(col: ColumnDef | ColumnNode, direction: 'ASC' | 'DESC' = 'ASC'): SelectQueryBuilder<T> {
      const node: ColumnNode = (col as any).type === 'Column' 
        ? (col as ColumnNode) 
        : { type: 'Column', table: (col as ColumnDef).table!, name: (col as ColumnDef).name };

      return new SelectQueryBuilder(this.table, {
          ...this.ast,
          orderBy: [...(this.ast.orderBy || []), { type: 'OrderBy', column: node, direction }]
      });
  }

  limit(n: number): SelectQueryBuilder<T> {
      return new SelectQueryBuilder(this.table, { ...this.ast, limit: n });
  }

  offset(n: number): SelectQueryBuilder<T> {
      return new SelectQueryBuilder(this.table, { ...this.ast, offset: n });
  }

  toSql(dialect: Dialect): string {
      return dialect.compileSelect(this.ast);
  }

  getAST(): SelectQueryNode {
      return this.ast;
  }
}

// Helpers for the playground
export const createColumn = (table: string, name: string): ColumnNode => ({ type: 'Column', table, name });
export const createLiteral = (val: string | number): LiteralNode => ({ type: 'Literal', value: val });