import { SchemaIntrospector, IntrospectOptions } from './types.js';
import { shouldIncludeTable } from './utils.js';
import { DatabaseSchema, DatabaseTable, DatabaseIndex } from '../schema-types.js';
import { DbExecutor } from '../../../orm/db-executor.js';
import { SelectQueryBuilder } from '../../../query-builder/select.js';
import { defineTable } from '../../../schema/table.js';
import { col } from '../../../schema/column.js';
import { eq, and, notLike } from '../../../core/ast/expression.js';
import { SqliteDialect } from '../../dialect/sqlite/index.js';

const sqliteMaster = defineTable('sqlite_master', {
    type: col.string(),
    name: col.string(),
});

const pragmaTableInfo = (tableName: string) => defineTable(`pragma_table_info('${tableName}')`, {
    name: col.string(),
    type: col.string(),
    notnull: col.boolean(),
    dflt_value: col.string(),
    pk: col.boolean(),
});

const pragmaForeignKeyList = (tableName: string) => defineTable(`pragma_foreign_key_list('${tableName}')`, {
    from: col.string(),
    table: col.string(),
    to: col.string(),
});

const pragmaIndexList = (tableName: string) => defineTable(`pragma_index_list('${tableName}')`, {
    name: col.string(),
    unique: col.boolean(),
});

const pragmaIndexInfo = (indexName: string) => defineTable(`pragma_index_info('${indexName}')`, {
    name: col.string(),
});


export const sqliteIntrospector: SchemaIntrospector = {
  async introspect(executor: DbExecutor, options: IntrospectOptions): Promise<DatabaseSchema> {
    const tables: DatabaseTable[] = [];
    const tableRows = await new SelectQueryBuilder(sqliteMaster)
        .select({ name: sqliteMaster.columns.name })
        .where(and(
            eq(sqliteMaster.columns.type, 'table'),
            notLike(sqliteMaster.columns.name, 'sqlite_%')
        ))
        .execute(executor, new SqliteDialect());

    for (const row of tableRows) {
      const name = row.name as string;
      if (!shouldIncludeTable(name, options)) continue;
      const table: DatabaseTable = { name, columns: [], primaryKey: [], indexes: [], foreignKeys: [] };
      const tableInfoTable = pragmaTableInfo(name);
      const cols = await new SelectQueryBuilder(tableInfoTable)
          .select({
              name: tableInfoTable.columns.name,
              type: tableInfoTable.columns.type,
              notnull: tableInfoTable.columns.notnull,
              dflt_value: tableInfoTable.columns.dflt_value,
              pk: tableInfoTable.columns.pk,
          })
          .execute(executor, new SqliteDialect());
      cols.forEach(c => {
        table.columns.push({
          name: c.name,
          type: c.type,
          notNull: c.notnull,
          default: c.dflt_value ?? undefined,
          autoIncrement: false
        });
        if (c.pk) {
          table.primaryKey = table.primaryKey || [];
          table.primaryKey.push(c.name);
        }
      });
      const fkTable = pragmaForeignKeyList(name);
      const fkRows = await new SelectQueryBuilder(fkTable)
          .select({
              from: fkTable.columns.from,
              table: fkTable.columns.table,
              to: fkTable.columns.to,
          })
          .execute(executor, new SqliteDialect());
      fkRows.forEach(fk => {
        table.foreignKeys.push({
          column: fk.from,
          referencesTable: fk.table,
          referencesColumn: fk.to,
        });
      });
      const indexListTable = pragmaIndexList(name);
      const idxList = await new SelectQueryBuilder(indexListTable)
            .select({
                name: indexListTable.columns.name,
                unique: indexListTable.columns.unique,
            })
            .execute(executor, new SqliteDialect());
      for (const idx of idxList) {
        const idxName = idx.name as string;
        const indexInfoTable = pragmaIndexInfo(idxName);
        const columnsInfo = await new SelectQueryBuilder(indexInfoTable)
            .select({ name: indexInfoTable.columns.name })
            .execute(executor, new SqliteDialect());
        const idxEntry: DatabaseIndex = {
          name: idxName,
          columns: columnsInfo.map(ci => ({ column: ci.name as string })),
          unique: idx.unique
        };
        table.indexes!.push(idxEntry);
      }

      tables.push(table);
    }

    return { tables };
  }
};
