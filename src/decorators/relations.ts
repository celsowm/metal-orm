import { CascadeMode, RelationKinds } from '../schema/relation.js';
import {
  addRelationMetadata,
  EntityConstructor,
  EntityOrTableTargetResolver,
  RelationMetadata
} from '../orm/entity-metadata.js';
import {
  DualModePropertyDecorator,
  getOrCreateMetadataBag,
  isStandardDecoratorContext,
  StandardDecoratorContext
} from './decorator-metadata.js';

interface BaseRelationOptions {
  target: EntityOrTableTargetResolver;
  cascade?: CascadeMode;
  localKey?: string;
}

export interface HasManyOptions extends BaseRelationOptions {
  foreignKey: string;
}

export interface HasOneOptions extends BaseRelationOptions {
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
  if (instanceOrCtor && typeof (instanceOrCtor as { constructor: new (...args: unknown[]) => unknown }).constructor === 'function') {
    return (instanceOrCtor as { constructor: new (...args: unknown[]) => unknown }).constructor as EntityConstructor;
  }
  return undefined;
};

const registerRelation = (ctor: EntityConstructor, propertyName: string, metadata: RelationMetadata): void => {
  addRelationMetadata(ctor, propertyName, metadata);
};

const createFieldDecorator = (
  metadataFactory: (propertyName: string) => RelationMetadata
) => {
  const decorator: DualModePropertyDecorator = (targetOrValue, propertyKeyOrContext) => {
    if (isStandardDecoratorContext(propertyKeyOrContext)) {
      const ctx = propertyKeyOrContext as StandardDecoratorContext;
      if (!ctx.name) {
        throw new Error('Relation decorator requires a property name');
      }
      const propertyName = normalizePropertyName(ctx.name);
      const bag = getOrCreateMetadataBag(ctx);
      const relationMetadata = metadataFactory(propertyName);

      if (!bag.relations.some(entry => entry.propertyName === propertyName)) {
        bag.relations.push({ propertyName, relation: relationMetadata });
      }
      return;
    }

    const propertyName = normalizePropertyName(propertyKeyOrContext);
    const ctor = resolveConstructor(targetOrValue);
    if (!ctor) {
      throw new Error('Unable to resolve constructor when registering relation metadata');
    }
    registerRelation(ctor, propertyName, metadataFactory(propertyName));
  };

  return decorator;
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

export function HasOne(options: HasOneOptions) {
  return createFieldDecorator(propertyName => ({
    kind: RelationKinds.HasOne,
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
