import { Dialect } from './index';
import { SelectQueryNode, BinaryExpressionNode, ColumnNode, LiteralNode } from '../ast';

export class SqlServerDialect implements Dialect {
    compile(ast: SelectQueryNode): string {
        const columns = ast.columns.map(c => `[${c.table}].[${c.name}]`).join(', ');
        const from = `[${ast.from.name}]`;
        
        const joins = ast.joins.map(j => {
            const table = `[${j.table.name}]`;
            const on = this.compileExpression(j.condition);
            return `${j.kind} JOIN ${table} ON ${on}`;
        }).join(' ');

        const where = ast.where ? ` WHERE ${this.compileExpression(ast.where)}` : '';
        
        let pagination = '';
        if (ast.limit || ast.offset) {
            const off = ast.offset || 0;
            pagination = ` ORDER BY (SELECT NULL) OFFSET ${off} ROWS`;
            if (ast.limit) {
                pagination += ` FETCH NEXT ${ast.limit} ROWS ONLY`;
            }
        }

        return `SELECT ${columns} FROM ${from}${joins ? ' ' + joins : ''}${where}${pagination};`;
    }

    private compileExpression(expr: BinaryExpressionNode): string {
        const left = this.compileOperand(expr.left);
        const right = this.compileOperand(expr.right);
        return `${left} ${expr.operator} ${right}`;
    }

    private compileOperand(node: ColumnNode | LiteralNode): string {
        if (node.type === 'Column') return `[${node.table}].[${node.name}]`;
        if (typeof node.value === 'string') return `'${node.value}'`;
        return String(node.value);
    }
}