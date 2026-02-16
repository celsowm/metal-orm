import { CompilerContext, CompiledProcedureCall } from '../abstract.js';
import { JsonPathNode, ColumnNode, BitwiseExpressionNode } from '../../ast/expression.js';
import { InsertQueryNode, TableNode } from '../../ast/query.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { SqliteFunctionStrategy } from './functions.js';
import { ProcedureCallNode } from '../../ast/procedure.js';

/**
 * SQLite dialect implementation
 */
export class SqliteDialect extends SqlDialectBase {
  protected readonly dialect = 'sqlite';
  /**
   * Creates a new SqliteDialect instance
   */
  public constructor() {
    super(new SqliteFunctionStrategy());
    this.registerExpressionCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      if (node.operator === '^') {
        return `(${left} | ${right}) & ~(${left} & ${right})`;
      }
      return `${left} ${node.operator} ${right}`;
    });
    this.registerOperandCompiler('BitwiseExpression', (node: BitwiseExpressionNode, ctx) => {
      const left = this.compileOperand(node.left, ctx);
      const right = this.compileOperand(node.right, ctx);
      if (node.operator === '^') {
        return `((${left} | ${right}) & ~(${left} & ${right}))`;
      }
      return `(${left} ${node.operator} ${right})`;
    });
  }

  /**
   * Quotes an identifier using SQLite double-quote syntax
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(id: string): string {
    return `"${id}"`;
  }

  /**
   * Compiles JSON path expression using SQLite syntax
   * @param node - JSON path node
   * @returns SQLite JSON path expression
   */
  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // SQLite uses json_extract(col, '$.path')
    return `json_extract(${col}, '${node.path}')`;
  }

  protected compileQualifiedColumn(column: ColumnNode, _table: TableNode): string {
    void _table;
    return this.quoteIdentifier(column.name);
  }

  protected compileReturning(returning: ColumnNode[] | undefined, ctx: CompilerContext): string {
    void ctx;
    if (!returning || returning.length === 0) return '';
    const columns = this.formatReturningColumns(returning);
    return ` RETURNING ${columns}`;
  }

  protected formatReturningColumns(returning: ColumnNode[]): string {
    return returning
      .map(column => {
        const alias = column.alias ? ` AS ${this.quoteIdentifier(column.alias)}` : '';
        return `${this.quoteIdentifier(column.name)}${alias}`;
      })
      .join(', ');
  }

  protected compileUpsertClause(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (!ast.onConflict) return '';

    const clause = ast.onConflict;
    if (clause.target.constraint) {
      throw new Error('SQLite ON CONFLICT does not support named constraints.');
    }
    this.ensureConflictColumns(clause, 'SQLite ON CONFLICT requires conflict columns.');

    const cols = clause.target.columns.map(col => this.quoteIdentifier(col.name)).join(', ');
    const target = ` ON CONFLICT (${cols})`;

    if (clause.action.type === 'DoNothing') {
      return `${target} DO NOTHING`;
    }

    if (!clause.action.set.length) {
      throw new Error('SQLite ON CONFLICT DO UPDATE requires at least one assignment.');
    }

    const assignments = this.compileUpdateAssignments(clause.action.set, ast.into, ctx);
    const where = clause.action.where
      ? ` WHERE ${this.compileExpression(clause.action.where, ctx)}`
      : '';
    return `${target} DO UPDATE SET ${assignments}${where}`;
  }

  supportsDmlReturningClause(): boolean {
    return true;
  }

  compileProcedureCall(_ast: ProcedureCallNode): CompiledProcedureCall {
    void _ast;
    throw new Error('Stored procedures are not supported by the SQLite dialect.');
  }
}
