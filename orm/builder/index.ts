import { TableDef } from '../schema';
import { SelectQueryNode, ColumnNode, BinaryExpressionNode, TableNode } from '../ast';
import { Dialect } from '../dialect';

// Helper for "eq" function in playground
export const eq = (left: string, right: string | number): BinaryExpressionNode => {
    // Parsing logic for string "users.id" -> ColumnNode
    // This is a simplification for the demo. In real ORM, we pass Column objects.
    const parse = (val: string | number) => {
        if (typeof val === 'number') return { type: 'Literal', value: val } as const;
        if (typeof val === 'string' && val.startsWith("'")) return { type: 'Literal', value: val.replace(/'/g, '') } as const;
        // Assume column if string
        const [table, col] = (val as string).split('.');
        return { type: 'Column', table, name: col } as const;
    };

    return {
        type: 'BinaryExpression',
        left: parse(left) as any,
        operator: '=',
        right: parse(right) as any
    };
};

export class QueryBuilder {
    private ast: SelectQueryNode;

    constructor(table: TableDef, ast?: SelectQueryNode) {
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

    select(...cols: string[]): QueryBuilder {
        const newCols = cols.map(c => {
            const [table, name] = c.split('.');
            return { type: 'Column', table, name } as ColumnNode;
        });
        
        return new QueryBuilder(null as any, {
            ...this.ast,
            columns: [...this.ast.columns, ...newCols]
        });
    }

    where(expr: BinaryExpressionNode | string): QueryBuilder {
        let node: BinaryExpressionNode;
        if (typeof expr === 'string') {
             // Basic parsing for demo purposes if string passed
             const [left, op, right] = expr.split(' ');
             node = eq(left, right);
        } else {
            node = expr;
        }

        return new QueryBuilder(null as any, {
            ...this.ast,
            where: node
        });
    }

    innerJoin(tableDef: TableDef, on: BinaryExpressionNode): QueryBuilder {
         return new QueryBuilder(null as any, {
            ...this.ast,
            joins: [...this.ast.joins, {
                type: 'Join',
                kind: 'INNER',
                table: { type: 'Table', name: tableDef.name },
                condition: on
            }]
        });
    }

    limit(n: number): QueryBuilder {
        return new QueryBuilder(null as any, { ...this.ast, limit: n });
    }

    offset(n: number): QueryBuilder {
        return new QueryBuilder(null as any, { ...this.ast, offset: n });
    }

    toSql(dialect: Dialect): string {
        return dialect.compile(this.ast);
    }

    getAST() {
        return this.ast;
    }
}