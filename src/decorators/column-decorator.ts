import { ColumnDef, ColumnType } from '../schema/column-types.js';
import { ColumnDefLike } from '../orm/entity-metadata.js';
import { getOrCreateMetadataBag } from './decorator-metadata.js';

/**
 * Options for defining a column in an entity.
 */
export interface ColumnOptions {
  type: ColumnType;
  args?: ColumnDef['args'];
  dialectTypes?: ColumnDef['dialectTypes'];
  notNull?: boolean;
  primary?: boolean;
  tsType?: ColumnDef['tsType'];
}

/**
 * Input type for column definitions, either as options object or direct ColumnDef.
 */
export type ColumnInput = ColumnOptions | ColumnDef;

const normalizeColumnInput = (input: ColumnInput): ColumnDefLike => {
  const asOptions = input as ColumnOptions;
  const asDefinition = input as ColumnDef;
  const column: ColumnDefLike = {
    type: asOptions.type ?? asDefinition.type,
    args: asOptions.args ?? asDefinition.args,
    dialectTypes: asOptions.dialectTypes ?? asDefinition.dialectTypes,
    notNull: asOptions.notNull ?? asDefinition.notNull,
    primary: asOptions.primary ?? asDefinition.primary,
    tsType: asDefinition.tsType ?? asOptions.tsType,
    unique: asDefinition.unique,
    default: asDefinition.default,
    autoIncrement: asDefinition.autoIncrement,
    generated: asDefinition.generated,
    check: asDefinition.check,
    references: asDefinition.references,
    comment: asDefinition.comment
  };

  if (!column.type) {
    throw new Error('Column decorator requires a column type');
  }

  return column;
};

const normalizePropertyName = (name: string | symbol): string => {
  if (typeof name === 'symbol') {
    return name.description ?? name.toString();
  }
  return name;
};

const registerColumnFromContext = (
  context: ClassFieldDecoratorContext,
  column: ColumnDefLike
): void => {
  if (!context.name) {
    throw new Error('Column decorator requires a property name');
  }
  if (context.private) {
    throw new Error('Column decorator does not support private fields');
  }
  const propertyName = normalizePropertyName(context.name);
  const bag = getOrCreateMetadataBag(context);
  if (!bag.columns.some(entry => entry.propertyName === propertyName)) {
    bag.columns.push({ propertyName, column: { ...column } });
  }
};

/**
 * Decorator to define a column on an entity property.
 * @param definition - The column definition or options.
 * @returns A property decorator that registers the column metadata.
 */
export function Column(definition: ColumnInput) {
  const normalized = normalizeColumnInput(definition);
  return function (_value: unknown, context: ClassFieldDecoratorContext) {
    registerColumnFromContext(context, normalized);
  };
}

/**
 * Decorator to define a primary key column on an entity property.
 * Sets the primary flag to true and delegates to Column decorator.
 * @param definition - The column definition or options.
 * @returns A property decorator that registers the primary key column metadata.
 */
export function PrimaryKey(definition: ColumnInput) {
  const normalized = normalizeColumnInput(definition);
  normalized.primary = true;
  return Column(normalized);
}
