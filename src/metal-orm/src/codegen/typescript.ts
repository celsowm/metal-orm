import { SelectQueryNode } from '../ast/query';
import { ExpressionNode, OperandNode, BinaryExpressionNode, LogicalExpressionNode, InExpressionNode, NullExpressionNode, JsonPathNode } from '../ast/expression';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export class TypeScriptGenerator {
  generate(ast: SelectQueryNode): string {
    const lines: string[] = [];
    
    // 1. SELECT
    const selections: string[] = [];
    ast.columns.forEach(col => {
       const key = col.alias || col.name;
       let val = '';
       if (col.type === 'Column') {
           val = `${capitalize(col.table)}.${col.name}`;
       } else if (col.type === 'Function') {
           const args = col.args.map(a => this.printOperand(a)).join(', ');
           val = `${col.name.toLowerCase()}(${args})`;
       }
       
       if (key === col.name && col.type === 'Column') {
           selections.push(`${key}: ${val}`);
       } else {
           selections.push(`${key}: ${val}`);
       }
    });
    
    lines.push(`const query = db.select({`);
    selections.forEach((s, i) => {
        lines.push(`  ${s}${i < selections.length - 1 ? ',' : ''}`);
    });
    lines.push(`})`);

    // 2. FROM
    lines.push(`.from(${capitalize(ast.from.name)})`);

    // 3. JOINS
    ast.joins.forEach(join => {
        if (join.relationName) {
            lines.push(`.joinRelation('${join.relationName}')`);
        } else {
             const table = capitalize(join.table.name);
             const cond = this.printExpression(join.condition);
             const method = join.kind === 'INNER' ? 'innerJoin' : 'leftJoin';
             lines.push(`.${method}(${table}, ${cond})`);
        }
    });

    // 4. WHERE
    if (ast.where) {
        lines.push(`.where(${this.printExpression(ast.where)})`);
    }

    // 5. GROUP BY
    if (ast.groupBy && ast.groupBy.length) {
         const cols = ast.groupBy.map(c => `${capitalize(c.table)}.${c.name}`).join(', ');
         lines.push(`.groupBy(${cols})`);
    }

    // 6. ORDER BY
    if (ast.orderBy && ast.orderBy.length) {
        ast.orderBy.forEach(o => {
            lines.push(`.orderBy(${capitalize(o.column.table)}.${o.column.name}, '${o.direction}')`);
        });
    }

    // 7. LIMIT/OFFSET
    if (ast.limit) lines.push(`.limit(${ast.limit})`);
    if (ast.offset) lines.push(`.offset(${ast.offset})`);

    lines.push(';');
    lines.push('');
    lines.push('await query.execute();');

    return lines.join('\n');
  }

  private printExpression(expr: ExpressionNode): string {
      if (expr.type === 'BinaryExpression') {
          const bin = expr as BinaryExpressionNode;
          return `${this.mapOp(bin.operator)}(${this.printOperand(bin.left)}, ${this.printOperand(bin.right)})`;
      }
      if (expr.type === 'LogicalExpression') {
          const log = expr as LogicalExpressionNode;
          const ops = log.operands.map(o => this.printExpression(o)).join(',\n    ');
          return `${this.mapOp(log.operator)}(\n    ${ops}\n  )`;
      }
      if (expr.type === 'InExpression') {
          const inExpr = expr as InExpressionNode;
          const left = this.printOperand(inExpr.left);
          const values = inExpr.right.map(r => this.printOperand(r)).join(', ');
          return `${this.mapOp(inExpr.operator)}(${left}, [${values}])`;
      }
      if (expr.type === 'NullExpression') {
          const nullExpr = expr as NullExpressionNode;
          return `${this.mapOp(nullExpr.operator)}(${this.printOperand(nullExpr.left)})`;
      }
      return '';
  }

  private printOperand(node: OperandNode): string {
      if (node.type === 'Column') {
          return `${capitalize(node.table)}.${node.name}`;
      }
      if (node.type === 'Literal') {
          if (node.value === null) return 'null';
          return typeof node.value === 'string' ? `'${node.value}'` : String(node.value);
      }
      if (node.type === 'Function') {
           const args = node.args.map(a => this.printOperand(a)).join(', ');
           return `${node.name.toLowerCase()}(${args})`;
      }
      if (node.type === 'JsonPath') {
          const json = node as JsonPathNode;
          return `jsonPath(${capitalize(json.column.table)}.${json.column.name}, '${json.path}')`;
      }
      return '';
  }

  private mapOp(op: string): string {
      switch(op) {
          case '=': return 'eq';
          case '>': return 'gt';
          case '<': return 'lt';
          case 'LIKE': return 'like';
          case 'IN': return 'inList';
          case 'NOT IN': return 'notInList';
          case 'IS NULL': return 'isNull';
          case 'IS NOT NULL': return 'isNotNull';
          case 'AND': return 'and';
          case 'OR': return 'or';
          default: return 'eq';
      }
  }
}