import { Dialect } from './index';
import { SelectQueryNode, ExpressionNode, BinaryExpressionNode, ColumnNode, LiteralNode, LogicalExpressionNode } from '../ast';

export class MySqlDialect implements Dialect {
    compile(ast: SelectQueryNode): string {
        const columns = ast.columns.map(c => `\`${c.table}\`.\`${c.name}\``).join(', ');
        const from = `\`${ast.from.name}\``;
        
        const joins = ast.joins.map(j => {
            const table = `\`${j.table.name}\``;
            const on = this.compileExpression(j.condition);
            return `${j.kind} JOIN ${table} ON ${on}`;
        }).join(' ');

        const where = ast.where ? ` WHERE ${this.compileExpression(ast.where)}` : '';
        const limit = ast.limit ? ` LIMIT ${ast.limit}` : '';
        const offset = ast.offset ? ` OFFSET ${ast.offset}` : '';

        return `SELECT ${columns} FROM ${from}${joins ? ' ' + joins : ''}${where}${limit}${offset};`;
    }

    private compileExpression(expr: ExpressionNode): string {
        if (expr.type === 'BinaryExpression') {
            const left = this.compileOperand(expr.left);
            const right = this.compileOperand(expr.right);
            return `${left} ${expr.operator} ${right}`;
        }

        if (expr.type === 'LogicalExpression') {
            const left = this.compileExpression(expr.left);
            const right = this.compileExpression(expr.right);
            return `${left} ${expr.operator} ${right}`;
        }

        return '';
    }

    private compileOperand(node: ColumnNode | LiteralNode): string {
        if (node.type === 'Column') return `\`${node.table}\`.\`${node.name}\``;
        if (typeof node.value === 'string') return `'${node.value}'`;
        return String(node.value);
    }
}
