export class BaseNamingStrategy {
  constructor(irregulars = {}) {
    this.irregulars = new Map();
    this.inverseIrregulars = new Map();
    for (const [singular, plural] of Object.entries(irregulars)) {
      if (!singular || !plural) continue;
      const singularKey = singular.toLowerCase();
      const pluralValue = plural.toLowerCase();
      this.irregulars.set(singularKey, pluralValue);
      this.inverseIrregulars.set(pluralValue, singularKey);
    }
  }

  applyIrregular(word, direction) {
    const lower = word.toLowerCase();
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
    const lower = word.toLowerCase();
    if (lower.endsWith('y')) return `${lower.slice(0, -1)}ies`;
    if (lower.endsWith('s')) return `${lower}es`;
    return `${lower}s`;
  }

  singularize(word) {
    const irregular = this.applyIrregular(word, 'singular');
    if (irregular) return irregular;
    const lower = word.toLowerCase();
    if (lower.endsWith('ies')) return `${lower.slice(0, -3)}y`;
    if (lower.endsWith('ses')) return lower.slice(0, -2);
    if (lower.endsWith('s')) return lower.slice(0, -1);
    return lower;
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
    return this.toCamelCase(this.pluralize(targetTable));
  }

  belongsToManyProperty(targetTable) {
    return this.toCamelCase(this.pluralize(targetTable));
  }

  defaultTableNameFromClass(className) {
    const normalized = this.toSnakeCase(className);
    if (!normalized) return 'unknown';
    return this.pluralize(normalized);
  }
}

export class EnglishNamingStrategy extends BaseNamingStrategy {}

const DEFAULT_PT_IRREGULARS = {
  mao: 'maos',
  pao: 'paes',
  cao: 'caes',
  mal: 'males',
  consul: 'consules'
};

export class PortugueseNamingStrategy extends BaseNamingStrategy {
  constructor(irregulars = {}) {
    super({ ...DEFAULT_PT_IRREGULARS, ...irregulars });
  }

  pluralize(word) {
    const irregular = this.applyIrregular(word, 'plural');
    if (irregular) return irregular;
    const lower = word.toLowerCase();
    if (lower.endsWith('cao')) return `${lower.slice(0, -3)}coes`;
    if (lower.endsWith('ao')) return `${lower.slice(0, -2)}oes`;
    if (lower.endsWith('m')) return `${lower.slice(0, -1)}ns`;
    if (lower.endsWith('al')) return `${lower.slice(0, -2)}ais`;
    if (lower.endsWith('el')) return `${lower.slice(0, -2)}eis`;
    if (lower.endsWith('ol')) return `${lower.slice(0, -2)}ois`;
    if (lower.endsWith('ul')) return `${lower.slice(0, -2)}uis`;
    if (lower.endsWith('il')) return `${lower.slice(0, -2)}is`;
    if (/[rznsx]$/.test(lower)) return `${lower}es`;
    if (lower.endsWith('s')) return lower;
    return `${lower}s`;
  }

  singularize(word) {
    const irregular = this.applyIrregular(word, 'singular');
    if (irregular) return irregular;
    const lower = word.toLowerCase();
    if (lower.endsWith('coes')) return `${lower.slice(0, -4)}cao`;
    if (lower.endsWith('oes')) return `${lower.slice(0, -3)}ao`;
    if (lower.endsWith('ns')) return `${lower.slice(0, -2)}m`;
    if (lower.endsWith('ais')) return `${lower.slice(0, -3)}al`;
    if (lower.endsWith('eis')) return `${lower.slice(0, -3)}el`;
    if (lower.endsWith('ois')) return `${lower.slice(0, -3)}ol`;
    if (lower.endsWith('uis')) return `${lower.slice(0, -3)}ul`;
    if (lower.endsWith('is')) return `${lower.slice(0, -2)}il`;
    if (/[rznsx]es$/.test(lower)) return lower.replace(/es$/, '');
    if (lower.endsWith('s')) return lower.slice(0, -1);
    return lower;
  }
}

export const createNamingStrategy = (locale = 'en', irregulars) => {
  const normalized = (locale || 'en').toLowerCase();
  if (normalized.startsWith('pt')) return new PortugueseNamingStrategy(irregulars);
  if (normalized.startsWith('en')) return new EnglishNamingStrategy(irregulars);
  return new EnglishNamingStrategy(irregulars);
};
