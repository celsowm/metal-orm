import { defineTable } from '../../../../schema/table.js';
import { col } from '../../../../schema/column-types.js';

const INFORMATION_SCHEMA = 'information_schema';

export const InformationSchemaTables = defineTable(
  'tables',
  {
    table_schema: col.varchar(255),
    table_name: col.varchar(255),
    table_comment: col.varchar(1024)
  },
  {},
  undefined,
  { schema: INFORMATION_SCHEMA }
);

export const InformationSchemaColumns = defineTable(
  'columns',
  {
    table_schema: col.varchar(255),
    table_name: col.varchar(255),
    column_name: col.varchar(255),
    column_type: col.varchar(255),
    data_type: col.varchar(255),
    is_nullable: col.varchar(3),
    column_default: col.varchar(1024),
    extra: col.varchar(255),
    column_comment: col.varchar(1024),
    ordinal_position: col.int()
  },
  {},
  undefined,
  { schema: INFORMATION_SCHEMA }
);

export const InformationSchemaKeyColumnUsage = defineTable(
  'key_column_usage',
  {
    constraint_schema: col.varchar(255),
    constraint_name: col.varchar(255),
    table_schema: col.varchar(255),
    table_name: col.varchar(255),
    column_name: col.varchar(255),
    ordinal_position: col.int(),
    referenced_table_schema: col.varchar(255),
    referenced_table_name: col.varchar(255),
    referenced_column_name: col.varchar(255)
  },
  {},
  undefined,
  { schema: INFORMATION_SCHEMA }
);

export const InformationSchemaReferentialConstraints = defineTable(
  'referential_constraints',
  {
    constraint_schema: col.varchar(255),
    constraint_name: col.varchar(255),
    delete_rule: col.varchar(255),
    update_rule: col.varchar(255)
  },
  {},
  undefined,
  { schema: INFORMATION_SCHEMA }
);

export const InformationSchemaStatistics = defineTable(
  'statistics',
  {
    table_schema: col.varchar(255),
    table_name: col.varchar(255),
    index_name: col.varchar(255),
    non_unique: col.int(),
    column_name: col.varchar(255),
    seq_in_index: col.int()
  },
  {},
  undefined,
  { schema: INFORMATION_SCHEMA }
);

export default {
  InformationSchemaTables,
  InformationSchemaColumns,
  InformationSchemaKeyColumnUsage,
  InformationSchemaReferentialConstraints,
  InformationSchemaStatistics
};
