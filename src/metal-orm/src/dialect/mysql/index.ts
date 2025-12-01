import { Dialect } from '../abstract';
import { SelectQueryNode } from '../../ast/query';
import { JsonPathNode } from '../../ast/expression';

export class MySqlDialect extends Dialect {
  quoteIdentifier(id: string): string {
    return `\`${id}\``;
  }

  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // MySQL 5.7+ uses col->'$.path'
    return `${col}->'${node.path}'`;
  }

  compileSelect(ast: SelectQueryNode): string {
    const columns = ast.columns.map(c => {
         let expr = '';
         if (c.type === 'Function') {
             expr = this.compileOperand(c);
         } else if (c.type === 'Column') {
             expr = `${this.quoteIdentifier(c.table)}.${this.quoteIdentifier(c.name)}`;
         }
         
         if (c.alias) {
             if (c.alias.includes('(')) return c.alias; 
             return `${expr} AS ${this.quoteIdentifier(c.alias)}`;
         }
         return expr;
    }).join(', ');

    const from = `${this.quoteIdentifier(ast.from.name)}`;

    const joins = ast.joins.map(j => {
        const table = this.quoteIdentifier(j.table.name);
        const left = this.compileOperand(j.condition.left);
        const right = this.compileOperand(j.condition.right);
        const cond = `${left} ${j.condition.operator} ${right}`;
        return `${j.kind} JOIN ${table} ON ${cond}`;
    }).join(' ');

    const groupBy = ast.groupBy && ast.groupBy.length > 0 
        ? ' GROUP BY ' + ast.groupBy.map(c => `${this.quoteIdentifier(c.table)}.${this.quoteIdentifier(c.name)}`).join(', ')
        : '';

    const orderBy = ast.orderBy && ast.orderBy.length > 0
        ? ' ORDER BY ' + ast.orderBy.map(o => `${this.quoteIdentifier(o.column.table)}.${this.quoteIdentifier(o.column.name)} ${o.direction}`).join(', ')
        : '';

    const limit = ast.limit ? ` LIMIT ${ast.limit}` : '';
    const offset = ast.offset ? ` OFFSET ${ast.offset}` : '';

    return `SELECT ${columns} FROM ${from}${joins ? ' ' + joins : ''}${this.compileWhere(ast.where)}${groupBy}${orderBy}${limit}${offset};`;
  }
}