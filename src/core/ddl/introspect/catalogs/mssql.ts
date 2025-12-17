import { defineTable } from '../../../../schema/table.js';
import { col } from '../../../../schema/column-types.js';

/** Table definitions for SQL Server catalog views used during introspection. */
export const SysColumns = defineTable(
  'columns',
  {
    object_id: col.int(),
    name: col.varchar(255),
    column_id: col.int(),
    max_length: col.int(),
    precision: col.int(),
    scale: col.int(),
    is_nullable: col.boolean(),
    is_identity: col.boolean(),
    default_object_id: col.int(),
    user_type_id: col.int()
  },
  {},
  undefined,
  { schema: 'sys' }
);

export const SysTables = defineTable(
  'tables',
  {
    object_id: col.int(),
    name: col.varchar(255),
    schema_id: col.int(),
    is_ms_shipped: col.boolean()
  },
  {},
  undefined,
  { schema: 'sys' }
);

export const SysSchemas = defineTable(
  'schemas',
  {
    schema_id: col.int(),
    name: col.varchar(255)
  },
  {},
  undefined,
  { schema: 'sys' }
);

export const SysTypes = defineTable(
  'types',
  {
    user_type_id: col.int(),
    name: col.varchar(255)
  },
  {},
  undefined,
  { schema: 'sys' }
);

export const SysIndexes = defineTable(
  'indexes',
  {
    object_id: col.int(),
    index_id: col.int(),
    name: col.varchar(255),
    is_primary_key: col.boolean(),
    is_unique: col.boolean(),
    has_filter: col.boolean(),
    filter_definition: col.varchar(1024),
    is_hypothetical: col.boolean()
  },
  {},
  undefined,
  { schema: 'sys' }
);

export const SysIndexColumns = defineTable(
  'index_columns',
  {
    object_id: col.int(),
    index_id: col.int(),
    column_id: col.int(),
    key_ordinal: col.int()
  },
  {},
  undefined,
  { schema: 'sys' }
);

export const SysForeignKeys = defineTable(
  'foreign_keys',
  {
    object_id: col.int(),
    name: col.varchar(255),
    delete_referential_action_desc: col.varchar(64),
    update_referential_action_desc: col.varchar(64)
  },
  {},
  undefined,
  { schema: 'sys' }
);

export const SysForeignKeyColumns = defineTable(
  'foreign_key_columns',
  {
    constraint_object_id: col.int(),
    parent_object_id: col.int(),
    parent_column_id: col.int(),
    referenced_object_id: col.int(),
    referenced_column_id: col.int(),
    constraint_column_id: col.int()
  },
  {},
  undefined,
  { schema: 'sys' }
);

export default {
  SysColumns,
  SysTables,
  SysSchemas,
  SysTypes,
  SysIndexes,
  SysIndexColumns,
  SysForeignKeys,
  SysForeignKeyColumns
};
