import { CompilerContext, CompiledProcedureCall } from '../abstract.js';
import {
  SelectQueryNode,
  InsertQueryNode,
  UpdateQueryNode,
  DeleteQueryNode
} from '../../ast/query.js';
import { JsonPathNode, ColumnNode } from '../../ast/expression.js';
import { MssqlFunctionStrategy } from './functions.js';
import { OrderByCompiler } from '../base/orderby-compiler.js';
import { JoinCompiler } from '../base/join-compiler.js';
import { SqlDialectBase } from '../base/sql-dialect.js';
import { ProcedureCallNode } from '../../ast/procedure.js';

const sanitizeVariableSuffix = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_]/g, '_');

const toProcedureParamReference = (value: string): string =>
  value.startsWith('@') ? value : `@${value}`;

/**
 * Microsoft SQL Server dialect implementation
 */
export class SqlServerDialect extends SqlDialectBase {
  protected readonly dialect = 'mssql';
  /**
   * Creates a new SqlServerDialect instance
   */
  public constructor() {
    super(new MssqlFunctionStrategy());
  }

  /**
   * Quotes an identifier using SQL Server bracket syntax
   * @param id - Identifier to quote
   * @returns Quoted identifier
   */
  quoteIdentifier(id: string): string {
    return `[${id}]`;
  }

  /**
   * Compiles JSON path expression using SQL Server syntax
   * @param node - JSON path node
   * @returns SQL Server JSON path expression
   */
  protected compileJsonPath(node: JsonPathNode): string {
    const col = `${this.quoteIdentifier(node.column.table)}.${this.quoteIdentifier(node.column.name)}`;
    // SQL Server uses JSON_VALUE(col, '$.path')
    return `JSON_VALUE(${col}, '${node.path}')`;
  }

  /**
   * Formats parameter placeholders using SQL Server named parameter syntax
   * @param index - Parameter index
   * @returns Named parameter placeholder
   */
  protected formatPlaceholder(index: number): string {
    return `@p${index}`;
  }

  /**
   * Compiles SELECT query AST to SQL Server SQL
   * @param ast - Query AST
   * @param ctx - Compiler context
   * @returns SQL Server SQL string
   */
  protected compileSelectAst(ast: SelectQueryNode, ctx: CompilerContext): string {
    const hasSetOps = !!(ast.setOps && ast.setOps.length);
    const ctes = this.compileCtes(ast, ctx);

    const baseAst: SelectQueryNode = hasSetOps
      ? { ...ast, setOps: undefined, orderBy: undefined, limit: undefined, offset: undefined }
      : ast;

    const baseSelect = this.compileSelectCoreForMssql(baseAst, ctx);

    if (!hasSetOps) {
      return `${ctes}${baseSelect}`;
    }

    const compound = ast.setOps!
      .map(op => `${op.operator} ${this.wrapSetOperand(this.compileSelectAst(op.query, ctx))}`)
      .join(' ');

    const orderBy = this.compileOrderBy(ast, ctx);
    const pagination = this.compilePagination(ast, orderBy);
    const combined = `${this.wrapSetOperand(baseSelect)} ${compound}`;
    const tail = pagination || orderBy;
    return `${ctes}${combined}${tail}`;
  }

  protected compileDeleteAst(ast: DeleteQueryNode, ctx: CompilerContext): string {
    if (ast.using) {
      throw new Error('DELETE ... USING is not supported in the MSSQL dialect; use join() instead.');
    }

    if (ast.from.type !== 'Table') {
      throw new Error('DELETE only supports base tables in the MSSQL dialect.');
    }

    const alias = ast.from.alias ?? ast.from.name;
    const target = this.compileTableReference(ast.from);
    const joins = JoinCompiler.compileJoins(
      ast.joins,
      ctx,
      this.compileFrom.bind(this),
      this.compileExpression.bind(this)
    );
    const whereClause = this.compileWhere(ast.where, ctx);
    const returning = this.compileOutputClause(ast.returning, 'deleted');
    return `DELETE ${this.quoteIdentifier(alias)}${returning} FROM ${target}${joins}${whereClause}`;
  }

  protected compileUpdateAst(ast: UpdateQueryNode, ctx: CompilerContext): string {
    const target = this.compileTableReference(ast.table);
    const assignments = this.compileUpdateAssignments(ast.set, ast.table, ctx);
    const output = this.compileReturning(ast.returning, ctx);
    const fromClause = ast.from ? ` FROM ${this.compileFrom(ast.from, ctx)}` : '';
    const joins = ast.joins
      ? ast.joins.map(j => {
          const table = this.compileFrom(j.table, ctx);
          const cond = this.compileExpression(j.condition, ctx);
          return ` ${j.kind} JOIN ${table} ON ${cond}`;
        }).join('')
      : '';
    const whereClause = this.compileWhere(ast.where, ctx);
    return `UPDATE ${target} SET ${assignments}${output}${fromClause}${joins}${whereClause}`;
  }

  private compileSelectCoreForMssql(ast: SelectQueryNode, ctx: CompilerContext): string {
    const columns = ast.columns.map(c => {
      // Default to full operand compilation for all projection node types (Function, Column, Cast, Case, Window, etc)
      const expr = c.type === 'Column'
        ? `${this.quoteIdentifier(c.table)}.${this.quoteIdentifier(c.name)}`
        : this.compileOperand(c as unknown as import('../../ast/expression.js').OperandNode, ctx);

      if (c.alias) {
        if (c.alias.includes('(')) return c.alias;
        return `${expr} AS ${this.quoteIdentifier(c.alias)}`;
      }
      return expr;
    }).join(', ');

    const distinct = ast.distinct ? 'DISTINCT ' : '';
    const from = this.compileFrom(ast.from, ctx);

    const joins = ast.joins.map(j => {
      const table = this.compileFrom(j.table, ctx);
      const cond = this.compileExpression(j.condition, ctx);
      return `${j.kind} JOIN ${table} ON ${cond}`;
    }).join(' ');
    const whereClause = this.compileWhere(ast.where, ctx);

    const groupBy = ast.groupBy && ast.groupBy.length > 0
      ? ' GROUP BY ' + ast.groupBy.map(term => this.compileOrderingTerm(term, ctx)).join(', ')
      : '';

    const having = ast.having
      ? ` HAVING ${this.compileExpression(ast.having, ctx)}`
      : '';

    const orderBy = this.compileOrderBy(ast, ctx);
    const pagination = this.compilePagination(ast, orderBy);

    if (pagination) {
      return `SELECT ${distinct}${columns} FROM ${from}${joins ? ' ' + joins : ''}${whereClause}${groupBy}${having}${pagination}`;
    }

    return `SELECT ${distinct}${columns} FROM ${from}${joins ? ' ' + joins : ''}${whereClause}${groupBy}${having}${orderBy}`;
  }

  private compileOrderBy(ast: SelectQueryNode, ctx: CompilerContext): string {
    return OrderByCompiler.compileOrderBy(
      ast,
      term => this.compileOrderingTerm(term, ctx),
      this.renderOrderByNulls.bind(this),
      this.renderOrderByCollation.bind(this)
    );
  }

  private compilePagination(ast: SelectQueryNode, orderBy: string): string {
    const hasLimit = ast.limit !== undefined;
    const hasOffset = ast.offset !== undefined;
    if (!hasLimit && !hasOffset) return '';

    const off = ast.offset ?? 0;
    let orderClause = orderBy;
    if (!orderClause) {
      // SQL Server requires ORDER BY items to appear in the SELECT list when DISTINCT is used.
      // For paginated DISTINCT queries without explicit ORDER BY, use ORDER BY 1 (first projection).
      orderClause = ast.distinct && ast.distinct.length > 0
        ? ' ORDER BY 1'
        : ' ORDER BY (SELECT NULL)';
    }
    let pagination = `${orderClause} OFFSET ${off} ROWS`;
    if (hasLimit) {
      pagination += ` FETCH NEXT ${ast.limit} ROWS ONLY`;
    }
    return pagination;
  }

  supportsDmlReturningClause(): boolean {
    return true;
  }

  protected compileReturning(returning: ColumnNode[] | undefined, _ctx: CompilerContext): string {
    void _ctx;
    return this.compileOutputClause(returning, 'inserted');
  }

  private compileOutputClause(returning: ColumnNode[] | undefined, prefix: 'inserted' | 'deleted'): string {
    if (!returning || returning.length === 0) return '';
    const columns = returning
      .map(column => {
        const colName = this.quoteIdentifier(column.name);
        const alias = column.alias ? ` AS ${this.quoteIdentifier(column.alias)}` : '';
        return `${prefix}.${colName}${alias}`;
      })
      .join(', ');
    return ` OUTPUT ${columns}`;
  }

  protected compileInsertAst(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (!ast.columns.length) {
      throw new Error('INSERT queries must specify columns.');
    }

    if (ast.onConflict) {
      return this.compileMergeInsert(ast, ctx);
    }

    const table = this.compileTableName(ast.into);
    const columnList = ast.columns.map(column => this.quoteIdentifier(column.name)).join(', ');
    const output = this.compileReturning(ast.returning, ctx);
    const source = this.compileInsertValues(ast, ctx);
    return `INSERT INTO ${table} (${columnList})${output} ${source}`;
  }

  private compileMergeInsert(ast: InsertQueryNode, ctx: CompilerContext): string {
    const clause = ast.onConflict!;
    if (clause.target.constraint) {
      throw new Error('MSSQL MERGE does not support conflict target by constraint name.');
    }
    this.ensureConflictColumns(clause, 'MSSQL MERGE requires conflict columns for the ON clause.');

    const table = this.compileTableName(ast.into);
    const targetRef = this.quoteIdentifier(ast.into.alias ?? ast.into.name);
    const sourceAlias = this.quoteIdentifier('src');
    const sourceColumns = ast.columns.map(column => this.quoteIdentifier(column.name)).join(', ');
    const usingSource = this.compileMergeUsingSource(ast, ctx);
    const onClause = clause.target.columns
      .map(column => `${targetRef}.${this.quoteIdentifier(column.name)} = ${sourceAlias}.${this.quoteIdentifier(column.name)}`)
      .join(' AND ');

    const branches: string[] = [];
    if (clause.action.type === 'DoUpdate') {
      if (!clause.action.set.length) {
        throw new Error('MSSQL MERGE WHEN MATCHED UPDATE requires at least one assignment.');
      }
      const assignments = clause.action.set
        .map(assignment => {
          const target = `${targetRef}.${this.quoteIdentifier(assignment.column.name)}`;
          const value = this.compileOperand(assignment.value, ctx);
          return `${target} = ${value}`;
        })
        .join(', ');
      const guard = clause.action.where
        ? ` AND ${this.compileExpression(clause.action.where, ctx)}`
        : '';
      branches.push(`WHEN MATCHED${guard} THEN UPDATE SET ${assignments}`);
    }

    const insertColumns = ast.columns.map(column => this.quoteIdentifier(column.name)).join(', ');
    const insertValues = ast.columns
      .map(column => `${sourceAlias}.${this.quoteIdentifier(column.name)}`)
      .join(', ');
    branches.push(`WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues})`);

    const output = this.compileReturning(ast.returning, ctx);
    return `MERGE INTO ${table} USING ${usingSource} AS ${sourceAlias} (${sourceColumns}) ON ${onClause} ${branches.join(' ')}${output}`;
  }

  private compileMergeUsingSource(ast: InsertQueryNode, ctx: CompilerContext): string {
    if (ast.source.type === 'InsertValues') {
      if (!ast.source.rows.length) {
        throw new Error('INSERT ... VALUES requires at least one row.');
      }
      const rows = ast.source.rows
        .map(row => `(${row.map(value => this.compileOperand(value, ctx)).join(', ')})`)
        .join(', ');
      return `(VALUES ${rows})`;
    }

    const normalized = this.normalizeSelectAst(ast.source.query);
    const selectSql = this.compileSelectAst(normalized, ctx).trim().replace(/;$/, '');
    return `(${selectSql})`;
  }

  private compileInsertValues(ast: InsertQueryNode, ctx: CompilerContext): string {
    const source = ast.source;
    if (source.type === 'InsertValues') {
      if (!source.rows.length) {
        throw new Error('INSERT ... VALUES requires at least one row.');
      }
      const values = source.rows
        .map(row => `(${row.map(value => this.compileOperand(value, ctx)).join(', ')})`)
        .join(', ');
      return `VALUES ${values}`;
    }
    const normalized = this.normalizeSelectAst(source.query);
    return this.compileSelectAst(normalized, ctx).trim();
  }

  private compileCtes(ast: SelectQueryNode, ctx: CompilerContext): string {
    if (!ast.ctes || ast.ctes.length === 0) return '';
    // MSSQL does not use RECURSIVE keyword, but supports recursion when CTE references itself.
    const defs = ast.ctes.map(cte => {
      const name = this.quoteIdentifier(cte.name);
      const cols = cte.columns ? `(${cte.columns.map(c => this.quoteIdentifier(c)).join(', ')})` : '';
      const query = this.compileSelectAst(this.normalizeSelectAst(cte.query), ctx).trim().replace(/;$/, '');
      return `${name}${cols} AS (${query})`;
    }).join(', ');
    return `WITH ${defs} `;
  }

  compileProcedureCall(ast: ProcedureCallNode): CompiledProcedureCall {
    const ctx = this.createCompilerContext();
    const qualifiedName = ast.ref.schema
      ? `${this.quoteIdentifier(ast.ref.schema)}.${this.quoteIdentifier(ast.ref.name)}`
      : this.quoteIdentifier(ast.ref.name);

    const declarations: string[] = [];
    const assignments: string[] = [];
    const execArgs: string[] = [];
    const outVars: Array<{ variable: string; name: string }> = [];

    ast.params.forEach((param, index) => {
      const targetParam = toProcedureParamReference(param.name);
      if (param.direction === 'in') {
        if (!param.value) {
          throw new Error(`Procedure parameter "${param.name}" requires a value for direction "in".`);
        }
        execArgs.push(`${targetParam} = ${this.compileOperand(param.value, ctx)}`);
        return;
      }

      if (!param.dbType) {
        throw new Error(
          `MSSQL procedure parameter "${param.name}" requires "dbType" for direction "${param.direction}".`
        );
      }

      const suffix = sanitizeVariableSuffix(param.name || `p${index + 1}`);
      const variable = `@__metal_${suffix}_${index + 1}`;
      declarations.push(`DECLARE ${variable} ${param.dbType};`);

      if (param.direction === 'inout') {
        if (!param.value) {
          throw new Error(`Procedure parameter "${param.name}" requires a value for direction "inout".`);
        }
        assignments.push(`SET ${variable} = ${this.compileOperand(param.value, ctx)};`);
      }

      execArgs.push(`${targetParam} = ${variable} OUTPUT`);
      outVars.push({ variable, name: param.name });
    });

    const statements: string[] = [];
    if (declarations.length) statements.push(...declarations);
    if (assignments.length) statements.push(...assignments);
    const argsSql = execArgs.length ? ` ${execArgs.join(', ')}` : '';
    statements.push(`EXEC ${qualifiedName}${argsSql};`);

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
