import { ColumnDefLike, RelationMetadata } from '../orm/entity-metadata.js';

export interface StandardDecoratorContext {
  kind: string;
  name?: string | symbol;
  metadata?: Record<PropertyKey, unknown>;
  addInitializer?(initializer: (this: unknown) => void): void;
  static?: boolean;
  private?: boolean;
}

export interface DualModePropertyDecorator {
  (target: object, propertyKey: string | symbol): void;
  (value: unknown, context: StandardDecoratorContext): void;
}

export interface DualModeClassDecorator {
  <TFunction extends Function>(value: TFunction): void | TFunction;
  <TFunction extends Function>(value: TFunction, context: StandardDecoratorContext): void | TFunction;
}

export interface DecoratorMetadataBag {
  columns: Array<{ propertyName: string; column: ColumnDefLike }>;
  relations: Array<{ propertyName: string; relation: RelationMetadata }>;
}

const METADATA_KEY = 'metal-orm:decorators';

export const isStandardDecoratorContext = (value: unknown): value is StandardDecoratorContext => {
  return typeof value === 'object' && value !== null && 'kind' in (value as any);
};

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

export const readMetadataBag = (context: StandardDecoratorContext): DecoratorMetadataBag | undefined => {
  return context.metadata?.[METADATA_KEY] as DecoratorMetadataBag | undefined;
};

export const registerInitializer = (
  context: StandardDecoratorContext,
  initializer: (this: unknown) => void
): void => {
  context.addInitializer?.(initializer);
};
