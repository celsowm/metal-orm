import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { queryRows, shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex } from '../schema-types.js';
import { ReferentialAction } from '../../../schema/column.js';
import { DbExecutor } from '../../execution/db-executor.js';

/** Row type for SQLite table list from sqlite_master. */
type SqliteTableRow = {
  name: string;
};

/** Row type for SQLite table column information from PRAGMA table_info. */
type SqliteTableInfoRow = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

/** Row type for SQLite foreign key information from PRAGMA foreign_key_list. */
type SqliteForeignKeyRow = {
  table: string;
  from: string;
  to: string;
  on_delete: string | null;
  on_update: string | null;
};

/** Row type for SQLite index list from PRAGMA index_list. */
type SqliteIndexListRow = {
  name: string;
  unique: number;
};

/** Row type for SQLite index column information from PRAGMA index_info. */
type SqliteIndexInfoRow = {
  name: string;
};

/**
 * Converts a SQLite referential action string to a ReferentialAction enum value.
 * @param value - The string value from SQLite pragma (e.g., 'CASCADE', 'SET NULL').
 * @returns The corresponding ReferentialAction enum value, or undefined if the value is invalid or null.
 */
const toReferentialAction = (value: string | null | undefined): ReferentialAction | undefined => {
  if (!value) return undefined;
  const normalized = value.toUpperCase();
  if (
    normalized === 'NO ACTION' ||
    normalized === 'RESTRICT' ||
    normalized === 'CASCADE' ||
    normalized === 'SET NULL' ||
    normalized === 'SET DEFAULT'
  ) {
    return normalized as ReferentialAction;
  }
  return undefined;
};

/**
 * Escapes single quotes in a string for safe inclusion in SQL queries.
 * @param name - The string to escape.
 * @returns The escaped string with single quotes doubled.
 */
const escapeSingleQuotes = (name: string) => name.replace(/'/g, "''");

/** SQLite schema introspector. */
export const sqliteIntrospector: SchemaIntrospector = {
  /**
   * Introspects the SQLite database schema by querying sqlite_master and various PRAGMAs.
   * @param ctx - The database execution context containing the DbExecutor.
   * @param options - Options controlling which tables and schemas to include.
   * @returns A promise that resolves to the introspected DatabaseSchema.
   */
  async introspect(ctx: { executor: DbExecutor }, options: IntrospectOptions): Promise<DatabaseSchema> {
    const tables: DatabaseTable[] = [];
    const tableRows = (await queryRows(
      ctx.executor,
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`
    )) as SqliteTableRow[];

    for (const row of tableRows) {
      const name = row.name;
      if (!shouldIncludeTable(name, options)) continue;
      const table: DatabaseTable = { name, columns: [], primaryKey: [], indexes: [] };

      const cols = (await queryRows(ctx.executor, `PRAGMA table_info('${escapeSingleQuotes(name)}');`)) as SqliteTableInfoRow[];
      cols.forEach(c => {
        table.columns.push({
          name: c.name,
          type: c.type,
          notNull: c.notnull === 1,
          default: c.dflt_value ?? undefined,
          autoIncrement: false
        });
        if (c.pk && c.pk > 0) {
          table.primaryKey = table.primaryKey || [];
          table.primaryKey.push(c.name);
        }
      });

      const fkRows = (await queryRows(ctx.executor, `PRAGMA foreign_key_list('${escapeSingleQuotes(name)}');`)) as SqliteForeignKeyRow[];
      fkRows.forEach(fk => {
        const col = table.columns.find(c => c.name === fk.from);
        if (col) {
          col.references = {
            table: fk.table,
            column: fk.to,
            onDelete: toReferentialAction(fk.on_delete),
            onUpdate: toReferentialAction(fk.on_update)
          };
        }
      });

      const idxList = (await queryRows(ctx.executor, `PRAGMA index_list('${escapeSingleQuotes(name)}');`)) as SqliteIndexListRow[];
      for (const idx of idxList) {
        const idxName = idx.name;
        const columnsInfo = (await queryRows(ctx.executor, `PRAGMA index_info('${escapeSingleQuotes(idxName)}');`)) as SqliteIndexInfoRow[];
        const idxEntry: DatabaseIndex = {
          name: idxName,
          columns: columnsInfo.map(ci => ({ column: ci.name })),
          unique: idx.unique === 1
        };
        table.indexes!.push(idxEntry);
      }

      tables.push(table);
    }

    return { tables };
  }
};
