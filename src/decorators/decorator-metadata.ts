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
const LEGACY_METADATA_KEY = Symbol.for('metal-orm:decorators:legacy');

type MetadataCarrier = {
  metadata?: Record<PropertyKey, unknown>;
};

type LegacyMetadataCarrier = {
  constructor?: object;
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

const getOrCreateMetadataBagOnConstructor = (ctor: object): DecoratorMetadataBag => {
  const carrier = ctor as Record<PropertyKey, unknown>;
  let bag = carrier[LEGACY_METADATA_KEY] as DecoratorMetadataBag | undefined;
  if (!bag) {
    bag = { columns: [], relations: [], transformers: [] };
    carrier[LEGACY_METADATA_KEY] = bag;
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
  if (metadataSymbol) {
    const metadata = Reflect.get(ctor, metadataSymbol) as Record<PropertyKey, unknown> | undefined;
    const stage3Bag = metadata?.[METADATA_KEY] as DecoratorMetadataBag | undefined;
    if (stage3Bag) {
      return stage3Bag;
    }
  }
  return (ctor as Record<PropertyKey, unknown>)[LEGACY_METADATA_KEY] as DecoratorMetadataBag | undefined;
};

/**
 * Public helper to read decorator metadata from a class constructor.
 * @param ctor - The entity constructor.
 * @returns The metadata bag if present.
 */
export const getDecoratorMetadata = (ctor: object): DecoratorMetadataBag | undefined =>
  readMetadataBagFromConstructor(ctor);

const normalizePropertyName = (name: string | symbol): string => {
  if (typeof name === 'symbol') {
    return name.description ?? name.toString();
  }
  return name;
};

const isStage3FieldContext = (value: unknown): value is ClassFieldDecoratorContext => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'private' in value &&
    'metadata' in value
  );
};

export interface ResolvedFieldDecoratorInfo {
  bag: DecoratorMetadataBag;
  propertyName: string;
}

export const resolveFieldDecoratorInfo = (
  targetOrValue: unknown,
  contextOrProperty: unknown,
  decoratorName: string
): ResolvedFieldDecoratorInfo => {
  if (isStage3FieldContext(contextOrProperty)) {
    if (!contextOrProperty.name) {
      throw new Error(`${decoratorName} decorator requires a property name`);
    }
    if (contextOrProperty.private) {
      throw new Error(`${decoratorName} decorator does not support private fields`);
    }
    return {
      propertyName: normalizePropertyName(contextOrProperty.name),
      bag: getOrCreateMetadataBag(contextOrProperty)
    };
  }

  if (typeof contextOrProperty === 'string' || typeof contextOrProperty === 'symbol') {
    const legacyTarget = targetOrValue as LegacyMetadataCarrier | undefined;
    const ctor =
      typeof legacyTarget === 'function' ? legacyTarget : legacyTarget?.constructor;
    if (!ctor || (typeof ctor !== 'function' && typeof ctor !== 'object')) {
      throw new Error(`${decoratorName} decorator requires a class field target`);
    }
    return {
      propertyName: normalizePropertyName(contextOrProperty),
      bag: getOrCreateMetadataBagOnConstructor(ctor)
    };
  }

  throw new Error(`${decoratorName} decorator received an unsupported decorator context`);
};
