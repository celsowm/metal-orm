import { defineTable } from '../../../../schema/table.js';
import { col } from '../../../../schema/column-types.js';

// SQLite catalogs are limited; most metadata comes from PRAGMAs, but these tables are queryable.

/** Table definition for the `sqlite_master` system table. */
export const SqliteMaster = defineTable(
  'sqlite_master',
  {
    type: col.varchar(255),      // 'table', 'index', 'view', 'trigger'
    name: col.varchar(255),      // Object name
    tbl_name: col.varchar(255),  // Table the object belongs to
    rootpage: col.int(),         // B-tree root page
    sql: col.varchar(4096)       // Original DDL
  },
  {},
  undefined,
  { schema: undefined }
);

/** Table definition for the `sqlite_sequence` system table, used for autoincrement tracking. */
export const SqliteSequence = defineTable(
  'sqlite_sequence',
  {
    name: col.varchar(255),  // Table name
    seq: col.int()           // Last autoincrement value
  },
  {},
  undefined,
  { schema: undefined }
);

/** Table definition for the `sqlite_stat1` system table, used for query planner statistics. */
export const SqliteStat1 = defineTable(
  'sqlite_stat1',
  {
    tbl: col.varchar(255),   // Table name
    idx: col.varchar(255),   // Index name
    stat: col.varchar(255)   // Statistics string
  },
  {},
  undefined,
  { schema: undefined }
);

export default {
  SqliteMaster,
  SqliteSequence,
  SqliteStat1
};
