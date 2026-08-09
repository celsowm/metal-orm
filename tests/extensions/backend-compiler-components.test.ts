import { describe, expect, it } from 'vitest';
import type { CompilerContext } from '../../src/core/dialect/abstract.js';
import type { OperandNode } from '../../src/core/ast/expression.js';
import type { SelectQueryNode } from '../../src/core/ast/query.js';
import type { ProcedureCallNode } from '../../src/core/ast/procedure.js';
import { StandardLimitOffsetPagination } from '../../src/core/dialect/base/pagination-strategy.js';
import type { StandardSqlCompilerServices } from '../../src/core/dialect/base/standard-sql-services.js';
import { StandardSqlSourceCompiler } from '../../src/core/dialect/base/standard-sql-source-compiler.js';
import { StandardTableFunctionStrategy } from '../../src/core/functions/standard-table-strategy.js';
import { MssqlSelectCompiler } from '../../src/core/dialect/mssql/select-compiler.js';
import { MssqlProcedureCompiler } from '../../src/core/dialect/mssql/procedure-compiler.js';

const createContext = (): CompilerContext => {
  const params: unknown[] = [];
  return {
    params,
    addParameter(value: unknown): string {
      params.push(value);
      return `@p${params.length}`;
    }
  };
};

const quoteIdentifier = (id: string): string => `[${id}]`;

const compileOperand = (node: OperandNode, ctx: CompilerContext): string => {
  if (node.type === 'Literal') return ctx.addParameter(node.value);
  if (node.type === 'Column') {
    return `${quoteIdentifier(node.table)}.${quoteIdentifier(node.name)}`;
  }
  throw new Error(`Unsupported test operand: ${node.type}`);
};

describe('backend compiler components', () => {
  it('uses the MSSQL SELECT compiler without SqlServerDialect inheritance', () => {
    let selectCompiler!: MssqlSelectCompiler;
    const services: StandardSqlCompilerServices = {
      getDialectName: () => 'mssql',
      getPaginationStrategy: () => new StandardLimitOffsetPagination(),
      getTableFunctionStrategy: () => new StandardTableFunctionStrategy(),
      quoteIdentifier,
      compileOperand,
      compileExpression: () => {
        throw new Error('Expression compilation is not needed by this test');
      },
      compileOrderingTerm: (term, ctx) => compileOperand(term as OperandNode, ctx),
      normalizeSelectAst: ast => ast,
      compileSelectAst: (ast, ctx) => selectCompiler.compile(ast, ctx),
      compileReturning: () => '',
      compileUpsertClause: () => '',
      compileSetTarget: column => quoteIdentifier(column.name),
      renderOrderByNulls: order => order.nulls ? ` NULLS ${order.nulls}` : '',
      renderOrderByCollation: order => order.collation ? ` COLLATE ${order.collation}` : ''
    };
    const sources = new StandardSqlSourceCompiler(services);
    selectCompiler = new MssqlSelectCompiler(services, sources);

    const ast: SelectQueryNode = {
      type: 'SelectQuery',
      from: { type: 'Table', name: 'users' },
      columns: [{ type: 'Column', table: 'users', name: 'id' }],
      joins: [],
      limit: 5
    };

    expect(selectCompiler.compile(ast, createContext()))
      .toBe('SELECT [users].[id] FROM [users] ORDER BY (SELECT NULL) OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY');
  });

  it('uses the MSSQL procedure compiler without SqlServerDialect inheritance', () => {
    const compiler = new MssqlProcedureCompiler({
      quoteIdentifier,
      createCompilerContext: createContext,
      compileOperand
    });
    const ast: ProcedureCallNode = {
      type: 'ProcedureCall',
      ref: { name: 'sync_totals' },
      params: [
        {
          name: 'tenantId',
          direction: 'in',
          value: { type: 'Literal', value: 10 }
        },
        {
          name: 'totalRows',
          direction: 'out',
          dbType: 'INT'
        }
      ]
    };

    const compiled = compiler.compileProcedureCall(ast);

    expect(compiled.sql).toBe(
      'DECLARE @__metal_totalRows_2 INT; EXEC [sync_totals] @tenantId = @p1, @totalRows = @__metal_totalRows_2 OUTPUT; SELECT @__metal_totalRows_2 AS [totalRows];'
    );
    expect(compiled.params).toEqual([10]);
    expect(compiled.outParams).toEqual({
      source: 'lastResultSet',
      names: ['totalRows']
    });
  });
});
