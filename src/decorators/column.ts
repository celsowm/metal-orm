import { ColumnDef, ColumnType } from '../schema/column.js';
import {
  addColumnMetadata,
  EntityConstructor,
  ColumnDefLike,
  ensureEntityMetadata
} from '../orm/entity-metadata.js';

export interface ColumnOptions {
  type: ColumnType;
  args?: ColumnDef['args'];
  notNull?: boolean;
  primary?: boolean;
}

export type ColumnInput = ColumnOptions | ColumnDef;

const normalizeColumnInput = (input: ColumnInput): ColumnDefLike => {
  const asOptions = input as ColumnOptions;
  const asDefinition = input as ColumnDef;
  const column: ColumnDefLike = {
    type: asOptions.type ?? asDefinition.type,
    args: asOptions.args ?? asDefinition.args,
    notNull: asOptions.notNull ?? asDefinition.notNull,
    primary: asOptions.primary ?? asDefinition.primary,
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

const resolveConstructor = (target: unknown): EntityConstructor | undefined => {
  if (typeof target === 'function') {
    return target as EntityConstructor;
  }

  if (target && typeof (target as any).constructor === 'function') {
    return (target as any).constructor as EntityConstructor;
  }

  return undefined;
};

const registerColumn = (ctor: EntityConstructor, propertyName: string, column: ColumnDefLike): void => {
  const meta = ensureEntityMetadata(ctor);
  if (meta.columns[propertyName]) {
    return;
  }
  addColumnMetadata(ctor, propertyName, column);
};

export function Column(definition: ColumnInput) {
  const normalized = normalizeColumnInput(definition);
  const decorator = (target: object, propertyKey: string | symbol) => {
    const propertyName = normalizePropertyName(propertyKey);
    const ctor = resolveConstructor(target);
    if (!ctor) {
      throw new Error('Unable to resolve constructor when registering column metadata');
    }
    registerColumn(ctor, propertyName, { ...normalized });
  };

  return decorator as PropertyDecorator;
}

export function PrimaryKey(definition: ColumnInput) {
  const normalized = normalizeColumnInput(definition);
  normalized.primary = true;
  return Column(normalized);
}
