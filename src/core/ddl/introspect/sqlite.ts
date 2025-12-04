import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { queryRows, shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex } from '../schema-types.js';
import { DbExecutor } from '../../orm/db-executor.js';

const escapeSingleQuotes = (name: string) => name.replace(/'/g, "''");

export const sqliteIntrospector: SchemaIntrospector = {
  async introspect(executor: DbExecutor, options: IntrospectOptions): Promise<DatabaseSchema> {
    const tables: DatabaseTable[] = [];
    const tableRows = await queryRows(
      executor,
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%';`
    );

    for (const row of tableRows) {
      const name = row.name as string;
      if (!shouldIncludeTable(name, options)) continue;
      const table: DatabaseTable = { name, columns: [], primaryKey: [], indexes: [] };

      const cols = await queryRows(executor, `PRAGMA table_info('${escapeSingleQuotes(name)}');`);
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

      const fkRows = await queryRows(executor, `PRAGMA foreign_key_list('${escapeSingleQuotes(name)}');`);
      fkRows.forEach(fk => {
        const col = table.columns.find(c => c.name === fk.from);
        if (col) {
          col.references = {
            table: fk.table,
            column: fk.to,
            onDelete: fk.on_delete?.toUpperCase(),
            onUpdate: fk.on_update?.toUpperCase()
          };
        }
      });

      const idxList = await queryRows(executor, `PRAGMA index_list('${escapeSingleQuotes(name)}');`);
      for (const idx of idxList) {
        const idxName = idx.name as string;
        const columnsInfo = await queryRows(executor, `PRAGMA index_info('${escapeSingleQuotes(idxName)}');`);
        const idxEntry: DatabaseIndex = {
          name: idxName,
          columns: columnsInfo.map(ci => ({ column: ci.name as string })),
          unique: idx.unique === 1
        };
        table.indexes!.push(idxEntry);
      }

      tables.push(table);
    }

    return { tables };
  }
};
