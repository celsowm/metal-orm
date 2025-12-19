import { ColumnDefLike, RelationMetadata } from '../orm/entity-metadata.js';

/**
 * Context object provided by standard decorators in newer TypeScript versions.
 */
export interface StandardDecoratorContext {
  kind: string;
  name?: string | symbol;
  metadata?: Record<PropertyKey, unknown>;
  static?: boolean;
  private?: boolean;
}

/**
 * Dual-mode property decorator that supports both legacy and standard decorator syntax.
 */
export interface DualModePropertyDecorator {
  (target: object, propertyKey: string | symbol): void;
  (value: unknown, context: StandardDecoratorContext): void;
}

/**
 * Dual-mode class decorator that supports both legacy and standard decorator syntax.
 */
export interface DualModeClassDecorator {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  <TFunction extends Function>(value: TFunction): void | TFunction;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  <TFunction extends Function>(value: TFunction, context: StandardDecoratorContext): void | TFunction;
}

/**
 * Bag for storing decorator metadata during the decoration phase.
 */
export interface DecoratorMetadataBag {
  columns: Array<{ propertyName: string; column: ColumnDefLike }>;
  relations: Array<{ propertyName: string; relation: RelationMetadata }>;
}

const METADATA_KEY = 'metal-orm:decorators';

/**
 * Checks if a value is a StandardDecoratorContext.
 * @param value - The value to check.
 * @returns True if the value is a StandardDecoratorContext.
 */
export const isStandardDecoratorContext = (value: unknown): value is StandardDecoratorContext => {
  return typeof value === 'object' && value !== null && 'kind' in (value as object);
};

/**
 * Gets or creates a metadata bag for the given decorator context.
 * @param context - The decorator context.
 * @returns The metadata bag.
 */
export const getOrCreateMetadataBag = (context: StandardDecoratorContext): DecoratorMetadataBag => {
  const metadata = context.metadata || (context.metadata = {} as Record<PropertyKey, unknown>);
  const existing = metadata[METADATA_KEY] as DecoratorMetadataBag | undefined;
  if (existing) {
    return existing;
  }
  const bag: DecoratorMetadataBag = { columns: [], relations: [] };
  metadata[METADATA_KEY] = bag;
  return bag;
};

/**
 * Reads the metadata bag from the given decorator context.
 * @param context - The decorator context.
 * @returns The metadata bag if present.
 */
export const readMetadataBag = (context: StandardDecoratorContext): DecoratorMetadataBag | undefined => {
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
 * Standard decorators only; legacy metadata is intentionally ignored.
 * @param ctor - The entity constructor.
 * @returns The metadata bag if present.
 */
export const getDecoratorMetadata = (ctor: object): DecoratorMetadataBag | undefined =>
  readMetadataBagFromConstructor(ctor);
