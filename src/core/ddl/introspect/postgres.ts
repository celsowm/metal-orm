import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { queryRows, shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex, DatabaseColumn } from '../schema-types.js';
import { DbExecutor } from '../../../orm/db-executor.js';

export const postgresIntrospector: SchemaIntrospector = {
  async introspect(executor: DbExecutor, options: IntrospectOptions): Promise<DatabaseSchema> {
    const schema = options.schema || 'public';
    const tables: DatabaseTable[] = [];

    const columnRows = await queryRows(
      executor,
      `
      SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = $1
      ORDER BY table_name, ordinal_position
      `,
      [schema]
    );

    const pkRows = await queryRows(
      executor,
      `
      SELECT
        ns.nspname AS table_schema,
        tbl.relname AS table_name,
        array_agg(att.attname ORDER BY arr.idx) AS pk_columns
      FROM pg_index i
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS arr(attnum, idx) ON TRUE
      LEFT JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = arr.attnum
      WHERE i.indisprimary AND ns.nspname = $1
      GROUP BY ns.nspname, tbl.relname
      `,
      [schema]
    );

    const pkMap = new Map<string, string[]>();
    pkRows.forEach(r => {
      pkMap.set(`${r.table_schema}.${r.table_name}`, r.pk_columns || []);
    });

    const fkRows = await queryRows(
      executor,
      `
      SELECT
        tc.table_schema,
        tc.table_name,
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.update_rule AS on_update,
        rc.delete_rule AS on_delete
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1
      `,
      [schema]
    );

    const fkMap = new Map<string, any[]>();
    fkRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}.${r.column_name}`;
      fkMap.set(key, [{
        table: `${r.foreign_table_schema}.${r.foreign_table_name}`,
        column: r.foreign_column_name,
        onDelete: r.on_delete?.toUpperCase(),
        onUpdate: r.on_update?.toUpperCase()
      }]);
    });

    const indexRows = await queryRows(
      executor,
      `
      SELECT
        ns.nspname AS table_schema,
        tbl.relname AS table_name,
        idx.relname AS index_name,
        i.indisunique AS is_unique,
        pg_get_expr(i.indpred, i.indrelid) AS predicate,
        array_agg(att.attname ORDER BY arr.idx) AS column_names
      FROM pg_index i
      JOIN pg_class tbl ON tbl.oid = i.indrelid
      JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
      JOIN pg_class idx ON idx.oid = i.indexrelid
      JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS arr(attnum, idx) ON TRUE
      LEFT JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = arr.attnum
      WHERE ns.nspname = $1 AND NOT i.indisprimary
      GROUP BY ns.nspname, tbl.relname, idx.relname, i.indisunique, i.indpred
      `,
      [schema]
    );

    const tablesByKey = new Map<string, DatabaseTable>();

    columnRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      if (!shouldIncludeTable(r.table_name, options)) {
        return;
      }
      if (!tablesByKey.has(key)) {
        tablesByKey.set(key, {
          name: r.table_name,
          schema: r.table_schema,
          columns: [],
          primaryKey: pkMap.get(key) || [],
          indexes: []
        });
      }
      const cols = tablesByKey.get(key)!;
      const fk = fkMap.get(`${r.table_schema}.${r.table_name}.${r.column_name}`)?.[0];
      const column: DatabaseColumn = {
        name: r.column_name,
        type: r.data_type,
        notNull: r.is_nullable === 'NO',
        default: r.column_default ?? undefined,
        references: fk
          ? {
              table: fk.table,
              column: fk.column,
              onDelete: fk.onDelete,
              onUpdate: fk.onUpdate
            }
          : undefined
      };
      cols.columns.push(column);
    });

    indexRows.forEach(r => {
      const key = `${r.table_schema}.${r.table_name}`;
      const table = tablesByKey.get(key);
      if (!table) return;
      const idx: DatabaseIndex = {
        name: r.index_name,
        columns: (r.column_names || []).map((c: string) => ({ column: c })),
        unique: !!r.is_unique,
        where: r.predicate || undefined
      };
      table.indexes = table.indexes || [];
      table.indexes.push(idx);
    });

    tables.push(...tablesByKey.values());
    return { tables };
  }
};
