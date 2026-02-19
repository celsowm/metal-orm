import { TableHooks } from '../schema/table.js';
import { RelationKinds } from '../schema/relation.js';
import {
  addColumnMetadata,
  addRelationMetadata,
  EntityConstructor,
  ensureEntityMetadata,
  setEntityTableName
} from '../orm/entity-metadata.js';
import { readMetadataBag } from './decorator-metadata.js';
import { syncTreeEntityMetadata } from '../tree/tree-decorator.js';

/**
 * Options for defining an entity.
 */
export interface EntityOptions {
  tableName?: string;
  hooks?: TableHooks;
  /** Entity type: 'table' (default) or 'view'. Views are read-only. */
  type?: 'table' | 'view';
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

/**
 * Class decorator to mark a class as an entity and configure its table mapping.
 * @param options - Configuration options for the entity.
 * @returns A class decorator that registers the entity metadata.
 */
export function Entity(options: EntityOptions = {}) {
  return function <T extends EntityConstructor>(value: T, context: ClassDecoratorContext): T {
    const ctor = value;
    const tableName = options.tableName ?? deriveTableNameFromConstructor(ctor);
    setEntityTableName(ctor, tableName, options.hooks, options.type);

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

    // Supports both decorator orders:
    // @Entity() above @Tree() and @Tree() above @Entity().
    syncTreeEntityMetadata(ctor, bag?.tree);

    return ctor;
  };
}
