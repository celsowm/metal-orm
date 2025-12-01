import { SelectQueryNode } from '../ast/query';
import { ExpressionNode, BinaryExpressionNode, LogicalExpressionNode, NullExpressionNode, InExpressionNode, LiteralNode, ColumnNode, OperandNode, FunctionNode, JsonPathNode } from '../ast/expression';

export abstract class Dialect {
  abstract compileSelect(ast: SelectQueryNode): string;
  abstract quoteIdentifier(id: string): string;
  
  protected compileWhere(where?: ExpressionNode): string {
    if (!where) return '';
    return ` WHERE ${this.compileExpression(where)}`;
  }

  protected compileExpression(node: ExpressionNode): string {
    if (node.type === 'BinaryExpression') {
        const bin = node as BinaryExpressionNode;
        const left = this.compileOperand(bin.left);
        const right = this.compileOperand(bin.right);
        return `${left} ${bin.operator} ${right}`;
    }
    
    if (node.type === 'LogicalExpression') {
        const logical = node as LogicalExpressionNode;
        if (logical.operands.length === 0) return '';
        
        // Wrap nested logical expressions in parentheses for safety
        const parts = logical.operands.map(op => {
             const str = this.compileExpression(op);
             return op.type === 'LogicalExpression' ? `(${str})` : str;
        });
        
        return parts.join(` ${logical.operator} `);
    }

    if (node.type === 'NullExpression') {
        const nullExpr = node as NullExpressionNode;
        const left = this.compileOperand(nullExpr.left);
        return `${left} ${nullExpr.operator}`;
    }

    if (node.type === 'InExpression') {
        const inExpr = node as InExpressionNode;
        const left = this.compileOperand(inExpr.left);
        const values = inExpr.right.map(v => this.compileOperand(v)).join(', ');
        return `${left} ${inExpr.operator} (${values})`;
    }

    return '';
  }

  protected compileOperand(node: OperandNode): string {
    if (node.type === 'Literal') {
      if (node.value === null) return 'NULL';
      return typeof node.value === 'string' ? `'${node.value}'` : String(node.value);
    }
    if (node.type === 'Column') {
      return `${this.quoteIdentifier(node.table)}.${this.quoteIdentifier(node.name)}`;
    }
    if (node.type === 'Function') {
        const fn = node as FunctionNode;
        const args = fn.args.map(a => this.compileOperand(a)).join(', ');
        return `${fn.name}(${args})`;
    }
    if (node.type === 'JsonPath') {
        return this.compileJsonPath(node as JsonPathNode);
    }
    return '';
  }

  // Default fallback, should be overridden by dialects if supported
  protected compileJsonPath(node: JsonPathNode): string {
      throw new Error("JSON Path not supported by this dialect");
  }
}