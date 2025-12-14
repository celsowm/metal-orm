import { TableHooks } from '../schema/table.js';
import { RelationKinds } from '../schema/relation.js';
import {
  addColumnMetadata,
  addRelationMetadata,
  EntityConstructor,
  ensureEntityMetadata,
  setEntityTableName
} from '../orm/entity-metadata.js';
import { DualModeClassDecorator, isStandardDecoratorContext, readMetadataBag } from './decorator-metadata.js';

export interface EntityOptions {
  tableName?: string;
  hooks?: TableHooks;
}

const toSnakeCase = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-z0-9_]+/gi, '_')
    .replace(/__+/g, '_')
    .replace(/^_|_$/g, '')
    .toLowerCase();
};

const deriveTableNameFromConstructor = (ctor: EntityConstructor<unknown>): string => {
  const fallback = 'unknown';
  const rawName = ctor.name || fallback;
  const strippedName = rawName.replace(/Entity$/i, '');
  const normalized = toSnakeCase(strippedName || rawName);
  if (!normalized) {
    return fallback;
  }
  return normalized.endsWith('s') ? normalized : `${normalized}s`;
};

export function Entity(options: EntityOptions = {}) {
  const decorator: DualModeClassDecorator = value => {
    const tableName = options.tableName ?? deriveTableNameFromConstructor(value);
    setEntityTableName(value as EntityConstructor, tableName, options.hooks);

    return value;
  };

  const decoratorWithContext: DualModeClassDecorator = (value, context?) => {
    const ctor = value as EntityConstructor;
    decorator(ctor);

    if (context && isStandardDecoratorContext(context)) {
      const bag = readMetadataBag(context);
      if (bag) {
        const meta = ensureEntityMetadata(ctor);
        for (const entry of bag.columns) {
          if (meta.columns[entry.propertyName]) {
            throw new Error(
              `Column '${entry.propertyName}' is already defined on entity '${ctor.name}'.`
            );
          }
          addColumnMetadata(ctor, entry.propertyName, { ...entry.column });
        }
        for (const entry of bag.relations) {
          if (meta.relations[entry.propertyName]) {
            throw new Error(
              `Relation '${entry.propertyName}' is already defined on entity '${ctor.name}'.`
            );
          }
          const relationCopy =
            entry.relation.kind === RelationKinds.BelongsToMany
              ? {
                ...entry.relation,
                defaultPivotColumns: entry.relation.defaultPivotColumns
                  ? [...entry.relation.defaultPivotColumns]
                  : undefined
              }
              : { ...entry.relation };
          addRelationMetadata(ctor, entry.propertyName, relationCopy);
        }
      }
    }

    return ctor;
  };

  return decoratorWithContext;
}
