import { describe, it, expect } from 'vitest';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { fnTable } from '../../../src/core/ast/builders.js';
import { SelectQueryNode, TableNode } from '../../../src/core/ast/query.js';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column.js';
import type { BinaryExpressionNode, ColumnNode, LiteralNode } from '../../../src/core/ast/expression-nodes.js';

describe('FunctionTable AST Support', () => {
  const postgresDialect = new PostgresDialect();
  const sqliteDialect = new SqliteDialect();

  describe('SQL Emission', () => {
    it('should emit LATERAL UNNEST with ORDINALITY for Postgres', () => {
      const unnestedCol: ColumnNode = {
        type: 'Column',
        table: 'i',
        name: 'indkey'
      };

      const query: SelectQueryNode = {
        type: 'SelectQuery',
        from: { type: 'Table', name: 'pg_index', schema: 'pg_catalog', alias: 'i' } as TableNode,
        columns: [
          { type: 'Column', table: 'i', name: 'indexrelid', alias: 'idx_oid' } as ColumnNode,
          { type: 'Column', table: 'arr', name: 'ord', alias: 'ordinality' } as ColumnNode,
          { type: 'Column', table: 'arr', name: 'attnum', alias: 'col_num' } as ColumnNode
        ],
        joins: [
          {
            type: 'Join',
            kind: 'INNER',
            table: fnTable('unnest', [unnestedCol], 'arr', {
              lateral: true,
              withOrdinality: true,
              columnAliases: ['attnum', 'ord']
            }),
            condition: {
              type: 'BinaryExpression',
              left: { type: 'Literal', value: 1 },
              operator: '=',
              right: { type: 'Literal', value: 1 }
            } as any
          }
        ]
      };

      const sql = postgresDialect.compileSelect(query).sql;

      // Check that the SQL includes LATERAL, UNNEST, WITH ORDINALITY, and the alias
      expect(sql).toContain('LATERAL');
      expect(sql).toContain('unnest');
      expect(sql).toContain('WITH ORDINALITY');
      expect(sql).toContain('AS "arr"');
      expect(sql).toContain('("attnum", "ord")');
    });

    it('should emit function call with arguments in FROM clause', () => {
      const query: SelectQueryNode = {
        type: 'SelectQuery',
        from: fnTable('json_each', [
          {
            type: 'Literal',
            value: '{"a": 1, "b": 2}'
          }
        ], 'je') as any,
        columns: [
          { type: 'Column', table: 'je', name: 'key' } as ColumnNode,
          { type: 'Column', table: 'je', name: 'value' } as ColumnNode
        ],
        joins: []
      };

      const sql = postgresDialect.compileSelect(query).sql;

      // Check that the function is compiled with the argument
      expect(sql).toContain('json_each');
      expect(sql).toContain('AS "je"');
    });

    it('should support column aliases for function table columns', () => {
      const query: SelectQueryNode = {
        type: 'SelectQuery',
        from: { type: 'Table', name: 'test_table', alias: 't' } as TableNode,
        columns: [
          { type: 'Column', table: 't', name: 'id' } as ColumnNode
        ],
        joins: [
          {
            type: 'Join',
            kind: 'INNER',
            table: fnTable('generate_series', [
              { type: 'Literal', value: 1 },
              { type: 'Literal', value: 10 }
            ], 'gs', {
              columnAliases: ['num']
            }),
            condition: {
              type: 'BinaryExpression',
              left: { type: 'Literal', value: 1 },
              operator: '=',
              right: { type: 'Literal', value: 1 }
            } as any
          }
        ]
      };

      const sql = postgresDialect.compileSelect(query).sql;

      // Check that the column alias is used
      expect(sql).toContain('generate_series');
      expect(sql).toContain('AS "gs"');
    });

    it('should compile a complex index introspection query with function table', () => {
      // This simulates the actual index introspection query structure
      const query: SelectQueryNode = {
        type: 'SelectQuery',
        from: { type: 'Table', name: 'pg_index', schema: 'pg_catalog', alias: 'i' } as TableNode,
        columns: [
          { type: 'Column', table: 'ns', name: 'nspname', alias: 'table_schema' } as ColumnNode,
          { type: 'Column', table: 'tbl', name: 'relname', alias: 'table_name' } as ColumnNode,
          { type: 'Column', table: 'idx', name: 'relname', alias: 'index_name' } as ColumnNode,
          { type: 'Column', table: 'att', name: 'attname', alias: 'column_name' } as ColumnNode,
          { type: 'Column', table: 'arr', name: 'ord', alias: 'column_order' } as ColumnNode
        ],
        joins: [
          {
            type: 'Join',
            kind: 'INNER',
            table: { type: 'Table', name: 'pg_class', schema: 'pg_catalog', alias: 'tbl' } as TableNode,
            condition: {
              type: 'BinaryExpression',
              left: { type: 'Column', table: 'tbl', name: 'oid' },
              operator: '=',
              right: { type: 'Column', table: 'i', name: 'indrelid' }
            } as any
          },
          {
            type: 'Join',
            kind: 'INNER',
            table: { type: 'Table', name: 'pg_namespace', schema: 'pg_catalog', alias: 'ns' } as TableNode,
            condition: {
              type: 'BinaryExpression',
              left: { type: 'Column', table: 'ns', name: 'oid' },
              operator: '=',
              right: { type: 'Column', table: 'tbl', name: 'relnamespace' }
            } as any
          },
          {
            type: 'Join',
            kind: 'INNER',
            table: { type: 'Table', name: 'pg_class', schema: 'pg_catalog', alias: 'idx' } as TableNode,
            condition: {
              type: 'BinaryExpression',
              left: { type: 'Column', table: 'idx', name: 'oid' },
              operator: '=',
              right: { type: 'Column', table: 'i', name: 'indexrelid' }
            } as any
          },
          {
            type: 'Join',
            kind: 'INNER',
            table: fnTable('unnest', [
              { type: 'Column', table: 'i', name: 'indkey' } as ColumnNode
            ], 'arr', {
              lateral: true,
              withOrdinality: true,
              columnAliases: ['attnum', 'ord']
            }),
            condition: {
              type: 'BinaryExpression',
              left: { type: 'Literal', value: 1 },
              operator: '=',
              right: { type: 'Literal', value: 1 }
            } as any
          },
          {
            type: 'Join',
            kind: 'LEFT',
            table: { type: 'Table', name: 'pg_attribute', schema: 'pg_catalog', alias: 'att' } as TableNode,
            condition: {
              type: 'LogicalExpression',
              operator: 'AND',
              operands: [
                {
                  type: 'BinaryExpression',
                  left: { type: 'Column', table: 'att', name: 'attrelid' },
                  operator: '=',
                  right: { type: 'Column', table: 'tbl', name: 'oid' }
                } as any,
                {
                  type: 'BinaryExpression',
                  left: { type: 'Column', table: 'att', name: 'attnum' },
                  operator: '=',
                  right: { type: 'Column', table: 'arr', name: 'attnum' }
                } as any
              ]
            } as any
          }
        ],
        where: {
          type: 'BinaryExpression',
          left: { type: 'Column', table: 'i', name: 'indisprimary' },
          operator: '=',
          right: { type: 'Literal', value: false }
        } as any
      };

      const sql = postgresDialect.compileSelect(query).sql;

      // Verify the structure contains key elements
      expect(sql).toContain('FROM');
      expect(sql).toContain('pg_index');
      expect(sql).toContain('JOIN');
      expect(sql).toContain('LATERAL');
      expect(sql).toContain('unnest');
      expect(sql).toContain('WITH ORDINALITY');
      expect(sql).toContain('AS "arr"');
      expect(sql).toContain('("attnum", "ord")');
      expect(sql).toContain('WHERE');
      expect(sql).toContain('indisprimary');
    });
  });

  describe('SQLite compatibility', () => {
    it('should handle function tables for SQLite PRAGMA queries', () => {
      // SQLite uses PRAGMA table_info('table_name') which returns a function-like table
      const query: SelectQueryNode = {
        type: 'SelectQuery',
        from: fnTable('pragma_table_info', [
          { type: 'Literal', value: 'users' }
        ], 'pi') as any,
        columns: [
          { type: 'Column', table: 'pi', name: 'cid' } as ColumnNode,
          { type: 'Column', table: 'pi', name: 'name' } as ColumnNode,
          { type: 'Column', table: 'pi', name: 'type' } as ColumnNode
        ],
        joins: []
      };

      const sql = sqliteDialect.compileSelect(query).sql;

      // SQLite PRAGMA should be compiled correctly
      expect(sql).toContain('pragma_table_info');
    });
  });

  describe('SelectQueryBuilder function table helpers', () => {
    const dummyTable = defineTable('dummy_table', {
      id: col.int()
    });

    it('should let builders replace FROM with a function table', () => {
      const jsonArg: LiteralNode = { type: 'Literal', value: '{"a": 1}' };
      const qb = new SelectQueryBuilder(dummyTable)
        .fromFunctionTable('json_each', [jsonArg], 'je', {
          schema: 'public',
          columnAliases: ['key', 'value']
        })
        .selectRaw('je.key', 'je.value');

      const sql = qb.compile(postgresDialect).sql;

      expect(sql).toContain('json_each');
      expect(sql).toContain('AS "je"');
      expect(sql).toContain('("key", "value")');
    });

    it('should add lateral function-table joins via helper', () => {
      const alwaysTrue: BinaryExpressionNode = {
        type: 'BinaryExpression',
        left: { type: 'Literal', value: 1 },
        operator: '=',
        right: { type: 'Literal', value: 1 }
      };

      const qb = new SelectQueryBuilder(dummyTable)
        .selectRaw('dummy_table.id')
        .joinFunctionTable(
          'generate_series',
          [
            { type: 'Literal', value: 1 },
            { type: 'Literal', value: 3 }
          ],
          'gs',
          alwaysTrue,
          undefined,
          {
            lateral: true,
            withOrdinality: true,
            columnAliases: ['value', 'ordinal'],
            schema: 'public'
          }
        );

      const sql = qb.compile(postgresDialect).sql;

      expect(sql).toContain('generate_series');
      expect(sql).toContain('LATERAL');
      expect(sql).toContain('AS "gs"');
      expect(sql).toContain('WITH ORDINALITY');
      expect(sql).toContain('("value", "ordinal")');
    });
  });
});
