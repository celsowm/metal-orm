import { defineTable } from '../../../../schema/table.js';
import { col } from '../../../../schema/column.js';

export const PgInformationSchemaColumns = defineTable(
  'columns',
  {
    table_schema: col.varchar(255),
    table_name: col.varchar(255),
    column_name: col.varchar(255),
    data_type: col.varchar(255),
    is_nullable: col.varchar(3),
    column_default: col.varchar(1024),
    ordinal_position: col.int()
  },
  {},
  undefined,
  { schema: 'information_schema' }
);

export const PgClass = defineTable(
  'pg_class',
  {
    oid: col.int(),
    relname: col.varchar(255),
    relnamespace: col.int(),
    relkind: col.varchar(1)
  },
  {},
  undefined,
  { schema: 'pg_catalog' }
);

export const PgNamespace = defineTable(
  'pg_namespace',
  {
    oid: col.int(),
    nspname: col.varchar(255)
  },
  {},
  undefined,
  { schema: 'pg_catalog' }
);

export const PgIndex = defineTable(
  'pg_index',
  {
    indrelid: col.int(),
    indexrelid: col.int(),
    indisprimary: col.boolean(),
    indkey: col.varchar(255),
    indpred: col.varchar(1024)
  },
  {},
  undefined,
  { schema: 'pg_catalog' }
);

export const PgAttribute = defineTable(
  'pg_attribute',
  {
    attrelid: col.int(),
    attname: col.varchar(255),
    attnum: col.int()
  },
  {},
  undefined,
  { schema: 'pg_catalog' }
);

export const PgTableConstraints = defineTable(
  'table_constraints',
  {
    constraint_catalog: col.varchar(255),
    constraint_schema: col.varchar(255),
    constraint_name: col.varchar(255),
    table_catalog: col.varchar(255),
    table_schema: col.varchar(255),
    table_name: col.varchar(255),
    constraint_type: col.varchar(255)
  },
  {},
  undefined,
  { schema: 'information_schema' }
);

export const PgKeyColumnUsage = defineTable(
  'key_column_usage',
  {
    constraint_catalog: col.varchar(255),
    constraint_schema: col.varchar(255),
    constraint_name: col.varchar(255),
    table_catalog: col.varchar(255),
    table_schema: col.varchar(255),
    table_name: col.varchar(255),
    column_name: col.varchar(255),
    ordinal_position: col.int()
  },
  {},
  undefined,
  { schema: 'information_schema' }
);

export const PgConstraintColumnUsage = defineTable(
  'constraint_column_usage',
  {
    constraint_catalog: col.varchar(255),
    constraint_schema: col.varchar(255),
    constraint_name: col.varchar(255),
    table_catalog: col.varchar(255),
    table_schema: col.varchar(255),
    table_name: col.varchar(255),
    column_name: col.varchar(255)
  },
  {},
  undefined,
  { schema: 'information_schema' }
);

export const PgReferentialConstraints = defineTable(
  'referential_constraints',
  {
    constraint_catalog: col.varchar(255),
    constraint_schema: col.varchar(255),
    constraint_name: col.varchar(255),
    unique_constraint_catalog: col.varchar(255),
    unique_constraint_schema: col.varchar(255),
    unique_constraint_name: col.varchar(255),
    match_option: col.varchar(64),
    update_rule: col.varchar(64),
    delete_rule: col.varchar(64)
  },
  {},
  undefined,
  { schema: 'information_schema' }
);

export default {
  PgInformationSchemaColumns,
  PgClass,
  PgNamespace,
  PgIndex,
  PgAttribute
};
