import { ColumnDefLike, RelationMetadata } from '../orm/entity-metadata.js';
import type { TransformerMetadata } from './transformers/transformer-metadata.js';

/**
 * Bag for storing decorator metadata during the decoration phase.
 */
export interface DecoratorTreeMetadata {
  parentProperty?: string;
  childrenProperty?: string;
}

export interface DecoratorMetadataBag {
  columns: Array<{ propertyName: string; column: ColumnDefLike }>;
  relations: Array<{ propertyName: string; relation: RelationMetadata }>;
  transformers: Array<{ propertyName: string; metadata: TransformerMetadata }>;
  tree?: DecoratorTreeMetadata;
}

const METADATA_KEY = 'metal-orm:decorators';

type MetadataCarrier = {
  metadata?: Record<PropertyKey, unknown>;
};

/**
 * Gets or creates a metadata bag for the given decorator context.
 * @param context - The decorator context with metadata support.
 * @returns The metadata bag.
 */
export const getOrCreateMetadataBag = (context: MetadataCarrier): DecoratorMetadataBag => {
  const metadata = context.metadata || (context.metadata = {} as Record<PropertyKey, unknown>);
  let bag = metadata[METADATA_KEY] as DecoratorMetadataBag | undefined;
  if (!bag) {
    bag = { columns: [], relations: [], transformers: [] };
    metadata[METADATA_KEY] = bag;
  }
  return bag;
};

/**
 * Reads the metadata bag from the given decorator context.
 * @param context - The decorator context with metadata support.
 * @returns The metadata bag if present.
 */
export const readMetadataBag = (context: MetadataCarrier): DecoratorMetadataBag | undefined => {
  return context.metadata?.[METADATA_KEY] as DecoratorMetadataBag | undefined;
};

/**
 * Reads the metadata bag from a decorated constructor when using standard decorators.
 * @param ctor - The entity constructor.
 * @returns The metadata bag if present.
 */
export const readMetadataBagFromConstructor = (ctor: object): DecoratorMetadataBag | undefined => {
  const metadataSymbol = (Symbol as { metadata?: symbol }).metadata;
  if (!metadataSymbol) return undefined;
  const metadata = Reflect.get(ctor, metadataSymbol) as Record<PropertyKey, unknown> | undefined;
  return metadata?.[METADATA_KEY] as DecoratorMetadataBag | undefined;
};

/**
 * Public helper to read decorator metadata from a class constructor.
 * @param ctor - The entity constructor.
 * @returns The metadata bag if present.
 */
export const getDecoratorMetadata = (ctor: object): DecoratorMetadataBag | undefined =>
  readMetadataBagFromConstructor(ctor);
