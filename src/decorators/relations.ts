import { CascadeMode, RelationKinds } from '../schema/relation.js';
import {
  addRelationMetadata,
  EntityConstructor,
  EntityOrTableTargetResolver,
  RelationMetadata
} from '../orm/entity-metadata.js';

interface BaseRelationOptions {
  target: EntityOrTableTargetResolver;
  cascade?: CascadeMode;
  localKey?: string;
}

export interface HasManyOptions extends BaseRelationOptions {
  foreignKey: string;
}

export interface BelongsToOptions extends BaseRelationOptions {
  foreignKey: string;
}

export interface BelongsToManyOptions {
  target: EntityOrTableTargetResolver;
  pivotTable: EntityOrTableTargetResolver;
  pivotForeignKeyToRoot: string;
  pivotForeignKeyToTarget: string;
  localKey?: string;
  targetKey?: string;
  pivotPrimaryKey?: string;
  defaultPivotColumns?: string[];
  cascade?: CascadeMode;
}

const normalizePropertyName = (name: string | symbol): string => {
  if (typeof name === 'symbol') {
    return name.description ?? name.toString();
  }
  return name;
};

const resolveConstructor = (instanceOrCtor: unknown): EntityConstructor | undefined => {
  if (typeof instanceOrCtor === 'function') {
    return instanceOrCtor as EntityConstructor;
  }
  if (instanceOrCtor && typeof (instanceOrCtor as any).constructor === 'function') {
    return (instanceOrCtor as any).constructor as EntityConstructor;
  }
  return undefined;
};

const registerRelation = (ctor: EntityConstructor, propertyName: string, metadata: RelationMetadata): void => {
  addRelationMetadata(ctor, propertyName, metadata);
};

const createFieldDecorator = (
  metadataFactory: (propertyName: string) => RelationMetadata
) => {
  const decorator = (target: object, propertyKey: string | symbol) => {
    const propertyName = normalizePropertyName(propertyKey);
    const ctor = resolveConstructor(target);
    if (!ctor) {
      throw new Error('Unable to resolve constructor when registering relation metadata');
    }
    registerRelation(ctor, propertyName, metadataFactory(propertyName));
  };

  return decorator as PropertyDecorator;
};

export function HasMany(options: HasManyOptions) {
  return createFieldDecorator(propertyName => ({
    kind: RelationKinds.HasMany,
    propertyKey: propertyName,
    target: options.target,
    foreignKey: options.foreignKey,
    localKey: options.localKey,
    cascade: options.cascade
  }));
}

export function BelongsTo(options: BelongsToOptions) {
  return createFieldDecorator(propertyName => ({
    kind: RelationKinds.BelongsTo,
    propertyKey: propertyName,
    target: options.target,
    foreignKey: options.foreignKey,
    localKey: options.localKey,
    cascade: options.cascade
  }));
}

export function BelongsToMany(options: BelongsToManyOptions) {
  return createFieldDecorator(propertyName => ({
    kind: RelationKinds.BelongsToMany,
    propertyKey: propertyName,
    target: options.target,
    pivotTable: options.pivotTable,
    pivotForeignKeyToRoot: options.pivotForeignKeyToRoot,
    pivotForeignKeyToTarget: options.pivotForeignKeyToTarget,
    localKey: options.localKey,
    targetKey: options.targetKey,
    pivotPrimaryKey: options.pivotPrimaryKey,
    defaultPivotColumns: options.defaultPivotColumns,
    cascade: options.cascade
  }));
}
