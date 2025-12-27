/**
 * Decorators for defining entities, columns, and relations in Metal ORM.
 */
export * from './entity.js';
export * from './column-decorator.js';
export * from './relations.js';
export * from './bootstrap.js';
export { getDecoratorMetadata } from './decorator-metadata.js';

// Entity Materialization - convert query results to real class instances
export { materializeAs, DefaultEntityMaterializer, PrototypeMaterializationStrategy, ConstructorMaterializationStrategy } from '../orm/entity-materializer.js';
export type { EntityMaterializer, EntityMaterializationStrategy } from '../orm/entity-materializer.js';
