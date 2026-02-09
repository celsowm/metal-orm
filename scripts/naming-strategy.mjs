import { resolveInflector } from './inflection/index.mjs';

export class BaseNamingStrategy {
  constructor(irregulars = {}, inflector = resolveInflector('en'), relationOverrides = {}, classNameOverrides = {}) {
    this.irregulars = new Map();
    this.inverseIrregulars = new Map();
    this.inflector = inflector;
    this.relationOverrides = new Map();
    this.classNameOverrides = new Map();

    for (const [singular, plural] of Object.entries(irregulars)) {
      if (!singular || !plural) continue;
      const normalize = this.inflector.normalizeForIrregularKey || (value => String(value).toLowerCase());
      const singularKey = normalize(singular);
      const pluralValue = normalize(plural);
      this.irregulars.set(singularKey, pluralValue);
      this.inverseIrregulars.set(pluralValue, singularKey);
    }

    // Build relation overrides map: className -> { originalProp -> newProp }
    for (const [className, overrides] of Object.entries(relationOverrides)) {
      if (!overrides || typeof overrides !== 'object') continue;
      this.relationOverrides.set(className, new Map(Object.entries(overrides)));
    }

    // Build class name overrides map: tableName -> className
    for (const [tableName, className] of Object.entries(classNameOverrides)) {
      if (!tableName || !className) continue;
      this.classNameOverrides.set(tableName, className);
    }
  }

  applyRelationOverride(className, propertyName) {
    const classOverrides = this.relationOverrides.get(className);
    if (classOverrides?.has(propertyName)) {
      return classOverrides.get(propertyName);
    }
    return propertyName;
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
    if (this.classNameOverrides.has(tableName)) {
      return this.classNameOverrides.get(tableName);
    }
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
  constructor(irregulars = {}, relationOverrides = {}, classNameOverrides = {}) {
    super(irregulars, resolveInflector('en'), relationOverrides, classNameOverrides);
  }
}

export class PortugueseNamingStrategy extends BaseNamingStrategy {
  constructor(irregulars = {}, relationOverrides = {}, classNameOverrides = {}) {
    const inflector = resolveInflector('pt-BR');
    super({ ...inflector.defaultIrregulars, ...irregulars }, inflector, relationOverrides, classNameOverrides);
  }
}

export const createNamingStrategy = (locale = 'en', irregulars, relationOverrides = {}, classNameOverrides = {}) => {
  const inflector = resolveInflector(locale);
  const mergedIrregulars = { ...(inflector.defaultIrregulars || {}), ...(irregulars || {}) };
  return new BaseNamingStrategy(mergedIrregulars, inflector, relationOverrides, classNameOverrides);
};
