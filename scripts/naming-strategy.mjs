import { resolveInflector } from './inflection/index.mjs';

export class BaseNamingStrategy {
  constructor(irregulars = {}, inflector = resolveInflector('en')) {
    this.irregulars = new Map();
    this.inverseIrregulars = new Map();
    this.inflector = inflector;
    for (const [singular, plural] of Object.entries(irregulars)) {
      if (!singular || !plural) continue;
      const normalize = this.inflector.normalizeForIrregularKey || (value => String(value).toLowerCase());
      const singularKey = normalize(singular);
      const pluralValue = normalize(plural);
      this.irregulars.set(singularKey, pluralValue);
      this.inverseIrregulars.set(pluralValue, singularKey);
    }
  }

  applyIrregular(word, direction) {
    const normalize = this.inflector.normalizeForIrregularKey || (value => String(value).toLowerCase());
    const lower = normalize(word);
    if (direction === 'plural' && this.irregulars.has(lower)) {
      return this.irregulars.get(lower);
    }
    if (direction === 'singular' && this.inverseIrregulars.has(lower)) {
      return this.inverseIrregulars.get(lower);
    }
    return undefined;
  }

  toPascalCase(value) {
    return (
      value
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('') || 'Entity'
    );
  }

  toCamelCase(value) {
    const pascal = this.toPascalCase(value);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }

  toSnakeCase(value) {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^a-z0-9_]+/gi, '_')
      .replace(/__+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
  }

  pluralize(word) {
    const irregular = this.applyIrregular(word, 'plural');
    if (irregular) return irregular;
    return this.inflector.pluralizeWord(word);
  }

  singularize(word) {
    const irregular = this.applyIrregular(word, 'singular');
    if (irregular) return irregular;
    return this.inflector.singularizeWord(word);
  }

  classNameFromTable(tableName) {
    return this.toPascalCase(this.singularize(tableName));
  }

  belongsToProperty(foreignKeyName, targetTable) {
    const trimmed = foreignKeyName.replace(/_?id$/i, '');
    const base = trimmed && trimmed !== foreignKeyName ? trimmed : this.singularize(targetTable);
    return this.toCamelCase(base);
  }

  hasManyProperty(targetTable) {
    const base = this.singularize(targetTable);
    const plural = this.inflector.pluralizeRelationProperty
      ? this.inflector.pluralizeRelationProperty(base, { pluralizeWord: word => this.pluralize(word) })
      : this.pluralize(base);
    return this.toCamelCase(plural);
  }

  hasOneProperty(targetTable) {
    return this.toCamelCase(this.singularize(targetTable));
  }

  belongsToManyProperty(targetTable) {
    return this.hasManyProperty(targetTable);
  }

  defaultTableNameFromClass(className) {
    const normalized = this.toSnakeCase(className);
    if (!normalized) return 'unknown';
    return this.pluralize(normalized);
  }
}

export class EnglishNamingStrategy extends BaseNamingStrategy {
  constructor(irregulars = {}) {
    super(irregulars, resolveInflector('en'));
  }
}

export class PortugueseNamingStrategy extends BaseNamingStrategy {
  constructor(irregulars = {}) {
    const inflector = resolveInflector('pt-BR');
    super({ ...inflector.defaultIrregulars, ...irregulars }, inflector);
  }
}

export const createNamingStrategy = (locale = 'en', irregulars) => {
  const inflector = resolveInflector(locale);
  const mergedIrregulars = { ...(inflector.defaultIrregulars || {}), ...(irregulars || {}) };
  return new BaseNamingStrategy(mergedIrregulars, inflector);
};
