/**
 * Decorators for defining entities, columns, and relations in Metal ORM.
 */
export * from './entity.js';
export * from './column-decorator.js';
export * from './relations.js';
export * from './bootstrap.js';
export { getDecoratorMetadata } from './decorator-metadata.js';

// Transformer Decorators
export * from './transformers/transformer-decorators.js';
export type { 
  PropertyTransformer, 
  PropertyValidator, 
  PropertySanitizer, 
  CompositeTransformer, 
  AutoTransformableValidator, 
  TransformContext, 
  AutoTransformResult, 
  ValidationResult, 
  TransformerMetadata, 
  TransformerConfig 
} from './transformers/transformer-metadata.js';

// Country Identifier Validators
export * from './validators/country-validators-decorators.js';
export { registerValidator, resolveValidator, getRegisteredValidators, hasValidator } from './validators/country-validator-registry.js';
export type { 
  CountryValidator, 
  CountryValidatorFactory, 
  ValidationOptions, 
  ValidationResult as CountryValidationResult, 
  AutoCorrectionResult, 
  ValidatorFactoryOptions 
} from './validators/country-validators.js';

// Entity Materialization - convert query results to real class instances
export { materializeAs, DefaultEntityMaterializer, PrototypeMaterializationStrategy, ConstructorMaterializationStrategy } from '../orm/entity-materializer.js';
export type { EntityMaterializer, EntityMaterializationStrategy } from '../orm/entity-materializer.js';
