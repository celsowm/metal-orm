import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { queryRows, shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex } from '../schema-types.js';
import { ReferentialAction } from '../../../schema/column.js';
import { DbExecutor } from '../../execution/db-executor.js';

type SqliteTableRow = {
  name: string;
};

type SqliteTableInfoRow = {
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type SqliteForeignKeyRow = {
  table: string;
  from: string;
  to: string;
  on_delete: string | null;
  on_update: string | null;
};

type SqliteIndexListRow = {
  name: string;
  unique: number;
};

type SqliteIndexInfoRow = {
  name: string;
};

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

const escapeSingleQuotes = (name: string) => name.replace(/'/g, "''");

export const sqliteIntrospector: SchemaIntrospector = {
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
