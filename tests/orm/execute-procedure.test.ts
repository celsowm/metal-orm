import { describe, expect, it } from 'vitest';
import type { QueryResult } from '../../src/core/execution/db-executor.js';
import type { OrmSession } from '../../src/orm/orm-session.js';
import { executeProcedureAst } from '../../src/orm/execute-procedure.js';
import type { ProcedureCallNode } from '../../src/core/ast/procedure.js';
import type { CompiledProcedureCall } from '../../src/core/dialect/abstract.js';

const sampleAst: ProcedureCallNode = {
  type: 'ProcedureCall',
  ref: { name: 'demo_proc' },
  params: []
};

const createSession = (compiled: CompiledProcedureCall, resultSets: QueryResult[]): OrmSession => {
  const sessionLike = {
    getExecutionContext: () => ({
      dialect: {
        compileProcedureCall: () => compiled
      },
      interceptors: {
        run: async () => resultSets
      },
      executor: {}
    })
  };

  return sessionLike as unknown as OrmSession;
};

describe('executeProcedureAst', () => {
  it('maps OUT values from the first result set', async () => {
    const compiled: CompiledProcedureCall = {
      sql: 'CALL demo_proc();',
      params: [],
      outParams: {
        source: 'firstResultSet',
        names: ['totalRows']
      }
    };
    const resultSets: QueryResult[] = [
      { columns: ['totalRows'], values: [[9]] },
      { columns: ['id'], values: [[1], [2]] }
    ];

    const result = await executeProcedureAst(createSession(compiled, resultSets), sampleAst);

    expect(result.resultSets).toEqual(resultSets);
    expect(result.out).toEqual({ totalRows: 9 });
  });

  it('maps OUT values from the last result set with case-insensitive fallback', async () => {
    const compiled: CompiledProcedureCall = {
      sql: 'EXEC demo_proc;',
      params: [],
      outParams: {
        source: 'lastResultSet',
        names: ['TOTALROWS']
      }
    };
    const resultSets: QueryResult[] = [
      { columns: ['id'], values: [[1], [2]] },
      { columns: ['totalRows'], values: [[12]] }
    ];

    const result = await executeProcedureAst(createSession(compiled, resultSets), sampleAst);
    expect(result.out).toEqual({ TOTALROWS: 12 });
  });

  it('throws a clear error when an expected OUT column is missing', async () => {
    const compiled: CompiledProcedureCall = {
      sql: 'CALL demo_proc();',
      params: [],
      outParams: {
        source: 'firstResultSet',
        names: ['missingOut']
      }
    };
    const resultSets: QueryResult[] = [
      { columns: ['other'], values: [[1]] }
    ];

    await expect(executeProcedureAst(createSession(compiled, resultSets), sampleAst))
      .rejects
      .toThrow('missingOut');
  });

  it('returns empty OUT map when out metadata source is none', async () => {
    const compiled: CompiledProcedureCall = {
      sql: 'CALL demo_proc();',
      params: [],
      outParams: {
        source: 'none',
        names: []
      }
    };
    const resultSets: QueryResult[] = [
      { columns: ['id'], values: [[1]] }
    ];

    const result = await executeProcedureAst(createSession(compiled, resultSets), sampleAst);
    expect(result.out).toEqual({});
  });
});
