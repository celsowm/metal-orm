import { CompilerContext, CompiledProcedureCall } from '../abstract.js';
import { JsonPathNode } from '../../ast/expression.js';
import { InsertQueryNode } from '../../ast/query.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { MysqlFunctionStrategy } from './functions.js';
import { ProcedureCallNode } from '../../ast/procedure.js';

const sanitizeVariableSuffix = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, '_');

/**
 * MySQL dialect implementation
 */
export class MySqlDialect extends SqlDialectBase {
  protected readonly dialect = 'mysql';
  /**
   * Creates a new MySqlDialect instance
   */
  public constructor() {
    super(new MysqlFunctionStrategy());
  }

  /**
   * Quotes an identifier using MySQL backtick syntax
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(id: string): string {
    return `\`${id}\``;
  }

  /**
   * Compiles JSON path expression using MySQL syntax
   * @param node - JSON path node
   * @returns MySQL JSON path expression
   */
  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // MySQL 5.7+ uses col->'$.path'
    return `${col}->'${node.path}'`;
  }

  protected compileUpsertClause(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (!ast.onConflict) return '';

    const clause = ast.onConflict;
    if (clause.action.type === 'DoNothing') {
      const noOpColumn = clause.target.columns[0] ?? ast.columns[0];
      if (!noOpColumn) {
        throw new Error('MySQL ON DUPLICATE KEY UPDATE requires at least one target column.');
      }
      const col = this.quoteIdentifier(noOpColumn.name);
      return ` ON DUPLICATE KEY UPDATE ${col} = ${col}`;
    }

    if (clause.action.where) {
      throw new Error('MySQL ON DUPLICATE KEY UPDATE does not support a WHERE clause.');
    }
    if (!clause.action.set.length) {
      throw new Error('MySQL ON DUPLICATE KEY UPDATE requires at least one assignment.');
    }

    const assignments = clause.action.set
      .map(assignment => {
        const target = this.quoteIdentifier(assignment.column.name);
        const value = this.compileOperand(assignment.value, ctx);
        return `${target} = ${value}`;
      })
      .join(', ');
    return ` ON DUPLICATE KEY UPDATE ${assignments}`;
  }

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    const ctx = this.createCompilerContext();
    const qualifiedName = ast.ref.schema
      ? `${this.quoteIdentifier(ast.ref.schema)}.${this.quoteIdentifier(ast.ref.name)}`
      : this.quoteIdentifier(ast.ref.name);

    const prelude: string[] = [];
    const callArgs: string[] = [];
    const outVars: Array<{ variable: string; name: string }> = [];

    ast.params.forEach((param, index) => {
      const suffix = sanitizeVariableSuffix(param.name || `p${index + 1}`);
      const variable = `@__metal_${suffix}_${index + 1}`;

      if (param.direction === 'in') {
        if (!param.value) {
          throw new Error(`Procedure parameter "${param.name}" requires a value for direction "in".`);
        }
        callArgs.push(this.compileOperand(param.value, ctx));
        return;
      }

      if (param.direction === 'inout') {
        if (!param.value) {
          throw new Error(`Procedure parameter "${param.name}" requires a value for direction "inout".`);
        }
        prelude.push(`SET ${variable} = ${this.compileOperand(param.value, ctx)};`);
      }

      callArgs.push(variable);
      outVars.push({ variable, name: param.name });
    });

    const statements: string[] = [];
    if (prelude.length) {
      statements.push(...prelude);
    }
    statements.push(`CALL ${qualifiedName}(${callArgs.join(', ')});`);

    if (outVars.length) {
      const selectOut = outVars
        .map(({ variable, name }) => `${variable} AS ${this.quoteIdentifier(name)}`)
        .join(', ');
      statements.push(`SELECT ${selectOut};`);
    }

    return {
      sql: statements.join(' '),
      params: [...ctx.params],
      outParams: {
        source: outVars.length ? 'lastResultSet' : 'none',
        names: outVars.map(item => item.name)
      }
    };
  }
}
