import { ExpressionNode } from '../core/ast/expression.js';
import { JOIN_KINDS } from '../core/sql/sql.js';
import { TableDef } from '../schema/table.js';
import { BelongsToManyRelation, RelationDef } from '../schema/relation.js';
import { RelationTargetTable } from '../schema/types.js';

/**
 * Join kinds allowed when including a relation using `.include(...)`.
 */
export type RelationIncludeJoinKind = typeof JOIN_KINDS.LEFT | typeof JOIN_KINDS.INNER;

/**
 * Options for including a relation in a query
 */
export interface RelationIncludeOptions {
  columns?: readonly string[];
  aliasPrefix?: string;
  filter?: ExpressionNode;
  joinKind?: RelationIncludeJoinKind;
  pivot?: {
    columns?: readonly string[];
    aliasPrefix?: string;
    merge?: boolean;
  };
}

type ColumnKeys<T> =
  T extends { columns: infer Columns }
    ? keyof Columns & string
    : string;

type PivotColumnKeys<TPivot> = ColumnKeys<TPivot> extends never ? string : ColumnKeys<TPivot>;

export type RelationTargetColumns<TRel extends RelationDef> =
  ColumnKeys<RelationTargetTable<TRel>>;

export type BelongsToManyPivotColumns<TRel extends RelationDef> =
  TRel extends BelongsToManyRelation<TableDef, infer TPivot>
    ? PivotColumnKeys<TPivot>
    : never;

export type TypedRelationIncludeOptions<TRel extends RelationDef> =
  TRel extends BelongsToManyRelation
    ? Omit<RelationIncludeOptions, 'columns' | 'pivot'> & {
        columns?: readonly RelationTargetColumns<TRel>[];
        pivot?: {
          columns?: readonly BelongsToManyPivotColumns<TRel>[];
          aliasPrefix?: string;
          merge?: boolean;
        };
      }
    : Omit<RelationIncludeOptions, 'columns' | 'pivot'> & {
        columns?: readonly RelationTargetColumns<TRel>[];
      };
