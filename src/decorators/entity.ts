import { TableHooks } from '../schema/table.js';
import { setEntityTableName } from '../orm/entity-metadata.js';

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

const deriveTableNameFromConstructor = (ctor: Function): string => {
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
  const decorator = <T extends new (...args: any[]) => any>(value: T) => {
    const tableName = options.tableName ?? deriveTableNameFromConstructor(value);
    setEntityTableName(value, tableName, options.hooks);
    return value;
  };
  return decorator as unknown as ClassDecorator;
}
