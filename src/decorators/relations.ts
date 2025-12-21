import { CascadeMode, RelationKinds } from '../schema/relation.js';
import {
  EntityOrTableTarget,
  EntityOrTableTargetResolver,
  RelationMetadata
} from '../orm/entity-metadata.js';
import { getOrCreateMetadataBag } from './decorator-metadata.js';

interface BaseRelationOptions {
  target: EntityOrTableTargetResolver;
  cascade?: CascadeMode;
  localKey?: string;
}

/**
 * Options for HasMany relation.
 */
export interface HasManyOptions extends BaseRelationOptions {
  foreignKey: string;
}

/**
 * Options for HasOne relation.
 */
export interface HasOneOptions extends BaseRelationOptions {
  foreignKey: string;
}

/**
 * Options for BelongsTo relation.
 */
export interface BelongsToOptions extends BaseRelationOptions {
  foreignKey: string;
}

/**
 * Options for BelongsToMany relation.
 */
export interface BelongsToManyOptions<
  TTarget extends EntityOrTableTarget = EntityOrTableTarget,
  TPivot extends EntityOrTableTarget = EntityOrTableTarget
> {
  target: EntityOrTableTargetResolver<TTarget>;
  pivotTable: EntityOrTableTargetResolver<TPivot>;
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

const createFieldDecorator = (metadataFactory: (propertyName: string) => RelationMetadata) => {
  return function (_value: unknown, context: ClassFieldDecoratorContext) {
    if (!context.name) {
      throw new Error('Relation decorator requires a property name');
    }
    if (context.private) {
      throw new Error('Relation decorator does not support private fields');
    }
    const propertyName = normalizePropertyName(context.name);
    const bag = getOrCreateMetadataBag(context);
    const relationMetadata = metadataFactory(propertyName);

    if (!bag.relations.some(entry => entry.propertyName === propertyName)) {
      bag.relations.push({ propertyName, relation: relationMetadata });
    }
  };
};

/**
 * Decorator to define a HasMany relation on an entity property.
 * @param options - The relation options.
 * @returns A property decorator that registers the relation metadata.
 */
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

/**
 * Decorator to define a HasOne relation on an entity property.
 * @param options - The relation options.
 * @returns A property decorator that registers the relation metadata.
 */
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

/**
 * Decorator to define a BelongsTo relation on an entity property.
 * @param options - The relation options.
 * @returns A property decorator that registers the relation metadata.
 */
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

/**
 * Decorator to define a BelongsToMany relation on an entity property.
 * @param options - The relation options.
 * @returns A property decorator that registers the relation metadata.
 */
export function BelongsToMany<
  TTarget extends EntityOrTableTarget = EntityOrTableTarget,
  TPivot extends EntityOrTableTarget = EntityOrTableTarget
>(options: BelongsToManyOptions<TTarget, TPivot>) {
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
