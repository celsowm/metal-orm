import {
  applyToCompoundHead,
  applyToCompoundWords,
  detectTextFormat,
  normalizeLookup,
  splitIntoWords,
  stripDiacritics
} from './compound.mjs';

// ═══════════════════════════════════════════════════════════════════════════
// PATTERNS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Precompiled regex patterns for performance.
 * @type {Readonly<Record<string, RegExp>>}
 */
const PATTERNS = Object.freeze({
  consonantEnding: /[rzn]$/,
  consonantEsEnding: /[rzn]es$/,
  endsInX: /x$/,
  vowelBeforeS: /[aeiou]s$/,
});

// ═══════════════════════════════════════════════════════════════════════════
// IRREGULAR DICTIONARIES (all normalized - no diacritics)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Default irregular plurals for Brazilian Portuguese.
 * Keys AND values are normalized (no diacritics, lowercase).
 * @type {Readonly<Record<string, string>>}
 */
export const PT_BR_DEFAULT_IRREGULARS = Object.freeze({
  // ─────────────────────────────────────────────────────────────────────────
  // -ão → -ães (irregular, must memorize)
  // ─────────────────────────────────────────────────────────────────────────
  'pao': 'paes',
  'cao': 'caes',
  'alemao': 'alemaes',
  'capitao': 'capitaes',
  'charlatao': 'charlataes',
  'escrivao': 'escrivaes',
  'tabeliao': 'tabeliaes',
  'guardiao': 'guardiaes',
  'sacristao': 'sacristaes',

  // ─────────────────────────────────────────────────────────────────────────
  // -ão → -ãos (irregular, must memorize)
  // ─────────────────────────────────────────────────────────────────────────
  'mao': 'maos',
  'cidadao': 'cidadaos',
  'cristao': 'cristaos',
  'irmao': 'irmaos',
  'orgao': 'orgaos',
  'bencao': 'bencaos',
  'grao': 'graos',
  'orfao': 'orfaos',
  'sotao': 'sotaos',
  'acordao': 'acordaos',
  'cortesao': 'cortesaos',
  'pagao': 'pagaos',
  'chao': 'chaos',
  'vao': 'vaos',

  // ─────────────────────────────────────────────────────────────────────────
  // -l special cases
  // ─────────────────────────────────────────────────────────────────────────
  'mal': 'males',
  'consul': 'consules',

  // ─────────────────────────────────────────────────────────────────────────
  // Unstressed -il → -eis (paroxytones)
  // ─────────────────────────────────────────────────────────────────────────
  'fossil': 'fosseis',
  'reptil': 'repteis',
  'facil': 'faceis',
  'dificil': 'dificeis',
  'util': 'uteis',
  'inutil': 'inuteis',
  'agil': 'ageis',
  'fragil': 'frageis',
  'projetil': 'projeteis',
  'volatil': 'volateis',
  'docil': 'doceis',
  'portatil': 'portateis',
  'textil': 'texteis',

  // ─────────────────────────────────────────────────────────────────────────
  // Invariable words (paroxytone/proparoxytone ending in -s/-x)
  // ─────────────────────────────────────────────────────────────────────────
  'onibus': 'onibus',
  'lapis': 'lapis',
  'virus': 'virus',
  'atlas': 'atlas',
  'pires': 'pires',
  'cais': 'cais',
  'torax': 'torax',
  'fenix': 'fenix',
  'xerox': 'xerox',
  'latex': 'latex',
  'index': 'index',
  'duplex': 'duplex',
  'telex': 'telex',
  'climax': 'climax',
  'simples': 'simples',
  'oasis': 'oasis',
  'tenis': 'tenis',

  // ─────────────────────────────────────────────────────────────────────────
  // -ês → -eses (nationalities, months, etc.)
  // ─────────────────────────────────────────────────────────────────────────
  'portugues': 'portugueses',
  'ingles': 'ingleses',
  'frances': 'franceses',
  'holandes': 'holandeses',
  'japones': 'japoneses',
  'chines': 'chineses',
  'irlandes': 'irlandeses',
  'escoces': 'escoceses',
  'mes': 'meses',
  'burges': 'burgueses',
  'fregues': 'fregueses',
  'marques': 'marqueses',

  // ─────────────────────────────────────────────────────────────────────────
  // Other irregulars
  // ─────────────────────────────────────────────────────────────────────────
  'qualquer': 'quaisquer',
  'carater': 'caracteres',
  'junior': 'juniores',
  'senior': 'seniores',
});

/**
 * Builds reverse irregular mapping (plural → singular).
 * @param {Record<string, string>} irregulars
 * @returns {Record<string, string>}
 */
const buildSingularIrregulars = (irregulars) => {
  const result = {};
  for (const [singular, plural] of Object.entries(irregulars)) {
    if (plural !== singular) {
      result[plural] = singular;
    }
  }
  return result;
};

/**
 * Default irregular singulars (auto-generated reverse mapping).
 * @type {Readonly<Record<string, string>>}
 */
export const PT_BR_DEFAULT_SINGULAR_IRREGULARS = Object.freeze(
  buildSingularIrregulars(PT_BR_DEFAULT_IRREGULARS)
);

// ═══════════════════════════════════════════════════════════════════════════
// CONNECTORS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Portuguese connector words used in compound expressions.
 * @type {ReadonlySet<string>}
 */
export const PT_BR_CONNECTORS = Object.freeze(new Set(
  [
    'de', 'da', 'do', 'das', 'dos',
    'em', 'na', 'no', 'nas', 'nos',
    'a', 'ao', 'as', 'aos',
    'com', 'sem', 'sob', 'sobre',
    'para', 'por', 'pela', 'pelo', 'pelas', 'pelos',
    'entre', 'contra', 'perante',
    'e', 'ou'
  ].map(normalizeLookup)
));

const hasConnectorWord = (term, connectors) => {
  if (!term || !String(term).trim()) return false;
  const original = String(term).trim();
  const format = detectTextFormat(original);
  const words = splitIntoWords(original, format);
  return words.some(word => connectors?.has?.(normalizeLookup(word)));
};

// ═══════════════════════════════════════════════════════════════════════════
// INFLECTION RULES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pluralization rules for Portuguese words.
 * Format: [suffix, replacement, suffixLength]
 * @type {ReadonlyArray<Readonly<[string, string, number]>>}
 */
const PLURAL_RULES = Object.freeze([
  // -ão → -ões (default; -ães and -ãos handled via irregulars)
  ['ao', 'oes', 2],
  // -m → -ns
  ['m', 'ns', 1],
  // -l endings
  ['al', 'ais', 2],
  ['el', 'eis', 2],
  ['ol', 'ois', 2],
  ['ul', 'uis', 2],
  ['il', 'is', 2], // Stressed -il; unstressed in irregulars
]);

/**
 * Singularization rules for Portuguese words.
 * Format: [suffix, replacement, suffixLength]
 * @type {ReadonlyArray<Readonly<[string, string, number]>>}
 */
const SINGULAR_RULES = Object.freeze([
  // -ões/-ães/-ãos → -ão
  ['oes', 'ao', 3],
  ['aes', 'ao', 3],
  ['aos', 'ao', 3],
  // -ns → -m
  ['ns', 'm', 2],
  // -l endings reverse
  ['ais', 'al', 3],
  ['eis', 'el', 3],
  ['ois', 'ol', 3],
  ['uis', 'ul', 3],
  ['is', 'il', 2],
  // -eses → -es
  ['eses', 'es', 4],
]);

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalizes a word for rule matching and irregular lookup.
 * @param {string} word - The word to normalize
 * @returns {string} Normalized word (lowercase, no diacritics)
 */
const normalizeWord = (word) =>
  stripDiacritics((word ?? '').toString()).toLowerCase().trim();

/**
 * Applies suffix rules to a word.
 * @param {string} word - Normalized word
 * @param {ReadonlyArray<Readonly<[string, string, number]>>} rules
 * @returns {string|null} Transformed word or null if no rule matched
 */
const applyRules = (word, rules) => {
  for (const [suffix, replacement, length] of rules) {
    if (word.endsWith(suffix)) {
      return word.slice(0, -length) + replacement;
    }
  }
  return null;
};

// ═══════════════════════════════════════════════════════════════════════════
// PLURALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Converts a Portuguese word to its plural form.
 * Output is normalized (no diacritics, lowercase).
 *
 * @param {string} word - The word to pluralize
 * @param {Record<string, string>} [irregulars=PT_BR_DEFAULT_IRREGULARS]
 * @returns {string} The pluralized word (normalized)
 */
export const pluralizeWordPtBr = (
  word,
  irregulars = PT_BR_DEFAULT_IRREGULARS
) => {
  const normalized = normalizeWord(word);
  if (!normalized) return '';

  // 1. Check irregulars first
  const irregular = irregulars[normalized];
  if (irregular !== undefined) {
    return irregular;
  }

  // 2. Apply suffix-based rules
  const ruleResult = applyRules(normalized, PLURAL_RULES);
  if (ruleResult !== null) {
    return ruleResult;
  }

  // 3. Words ending in -x are typically invariable
  if (PATTERNS.endsInX.test(normalized)) {
    return normalized;
  }

  // 4. Consonants r, z, n require -es
  if (PATTERNS.consonantEnding.test(normalized)) {
    return normalized + 'es';
  }

  // 5. Words ending in -s (invariable or already plural)
  if (normalized.endsWith('s')) {
    return normalized;
  }

  // 6. Default: add -s
  return normalized + 's';
};

// ═══════════════════════════════════════════════════════════════════════════
// SINGULARIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Converts a Portuguese word to its singular form.
 * Output is normalized (no diacritics, lowercase).
 *
 * @param {string} word - The word to singularize
 * @param {Record<string, string>} [irregulars=PT_BR_DEFAULT_SINGULAR_IRREGULARS]
 * @returns {string} The singularized word (normalized)
 */
export const singularizeWordPtBr = (
  word,
  irregulars = PT_BR_DEFAULT_SINGULAR_IRREGULARS
) => {
  const normalized = normalizeWord(word);
  if (!normalized) return '';

  // 1. Check irregulars first
  const irregular = irregulars[normalized];
  if (irregular !== undefined) {
    return irregular;
  }

  // 2. Apply suffix-based rules
  const ruleResult = applyRules(normalized, SINGULAR_RULES);
  if (ruleResult !== null) {
    return ruleResult;
  }

  // 3. Handle consonant + es pattern
  if (PATTERNS.consonantEsEnding.test(normalized)) {
    return normalized.slice(0, -2);
  }

  // 4. Words ending in vowel+s: remove s
  if (PATTERNS.vowelBeforeS.test(normalized)) {
    return normalized.slice(0, -1);
  }

  // 5. Already singular or invariable
  return normalized;
};

// ═══════════════════════════════════════════════════════════════════════════
// NOUN SPECIFIERS (SUBSTANTIVOS DETERMINANTES)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Portuguese words that act as specifiers/delimiters in compound nouns.
 * When these appear as the second term, only the first term varies.
 * @type {ReadonlySet<string>}
 */
export const PT_BR_NOUN_SPECIFIERS = Object.freeze(new Set(
  [
    'correcao', 'padrao', 'limite', 'chave', 'base', 'chefe',
    'satelite', 'fantasma', 'monstro', 'escola', 'piloto',
    'femea', 'macho', 'geral', 'solicitacao'
  ].map(normalizeLookup)
));

const isCompoundWithSpecifier = (term, specifiers = PT_BR_NOUN_SPECIFIERS) => {
  if (!term || !String(term).trim()) return false;
  const original = String(term).trim();
  const format = detectTextFormat(original);
  const words = splitIntoWords(original, format);

  if (words.length < 2) return false;

  // Check if the last word is a known specifier
  const lastWord = words[words.length - 1];
  return specifiers.has(normalizeLookup(lastWord));
};

// ═══════════════════════════════════════════════════════════════════════════
// COMPOUND TERM HANDLING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pluralizes a compound property/relation name in Portuguese.
 */
export const pluralizeRelationPropertyPtBr = (
  term,
  { pluralizeWord = pluralizeWordPtBr, connectors = PT_BR_CONNECTORS, specifiers = PT_BR_NOUN_SPECIFIERS } = {}
) => {
  if (hasConnectorWord(term, connectors) || isCompoundWithSpecifier(term, specifiers)) {
    return applyToCompoundHead(term, { connectors, transformWord: pluralizeWord });
  }
  return applyToCompoundWords(term, { connectors, transformWord: pluralizeWord });
}

/**
 * Singularizes a compound property/relation name in Portuguese.
 */
export const singularizeRelationPropertyPtBr = (
  term,
  { singularizeWord = singularizeWordPtBr, connectors = PT_BR_CONNECTORS, specifiers = PT_BR_NOUN_SPECIFIERS } = {}
) => {
  if (hasConnectorWord(term, connectors) || isCompoundWithSpecifier(term, specifiers)) {
    return applyToCompoundHead(term, { connectors, transformWord: singularizeWord });
  }
  return applyToCompoundWords(term, { connectors, transformWord: singularizeWord });
}

// ═══════════════════════════════════════════════════════════════════════════
// INFLECTOR FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a Brazilian Portuguese inflector instance.
 */
export const createPtBrInflector = ({ customIrregulars = {} } = {}) => {
  const irregularPlurals = Object.freeze({
    ...PT_BR_DEFAULT_IRREGULARS,
    ...customIrregulars
  });

  const irregularSingulars = Object.freeze({
    ...PT_BR_DEFAULT_SINGULAR_IRREGULARS,
    ...buildSingularIrregulars(customIrregulars)
  });

  const pluralizeWord = (w) => pluralizeWordPtBr(w, irregularPlurals);
  const singularizeWord = (w) => singularizeWordPtBr(w, irregularSingulars);

  return Object.freeze({
    locale: 'pt-BR',
    irregularPlurals,
    irregularSingulars,
    pluralizeWord,
    singularizeWord,
    pluralizeRelationProperty: (term) => pluralizeRelationPropertyPtBr(term, { pluralizeWord }),
    singularizeRelationProperty: (term) => singularizeRelationPropertyPtBr(term, { singularizeWord }),
    normalizeForLookup: normalizeWord
  });
};

export default createPtBrInflector;
