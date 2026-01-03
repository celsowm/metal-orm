export const stripDiacritics = value =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const normalizeLookup = value => stripDiacritics(value).toLowerCase().trim();

export const detectTextFormat = text => {
  if (/^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(text)) return 'SCREAMING_SNAKE';
  if (/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(text)) return 'snake_case';
  if (/^[A-Z][a-zA-Z0-9]*$/.test(text) && /[a-z]/.test(text)) return 'PascalCase';
  if (/^[a-z][a-zA-Z0-9]*$/.test(text) && /[A-Z]/.test(text)) return 'camelCase';
  return 'normal';
};

export const splitIntoWords = (text, format) => {
  switch (format) {
    case 'camelCase':
    case 'PascalCase':
      return text
        .replace(/([a-z])([A-Z])/g, '$1\0$2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1\0$2')
        .split('\0')
        .map(p => p.toLowerCase());
    case 'snake_case':
      return text.toLowerCase().split('_');
    case 'SCREAMING_SNAKE':
      return text.toLowerCase().split('_');
    default:
      return text.toLowerCase().split(/\s+/);
  }
};

const capitalize = value => (value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : '');

export const rebuildFromWords = (words, format, originalText) => {
  switch (format) {
    case 'camelCase':
      return words.map((w, i) => (i === 0 ? w : capitalize(w))).join('');
    case 'PascalCase':
      return words.map(capitalize).join('');
    case 'snake_case':
      return words.join('_');
    case 'SCREAMING_SNAKE':
      return words.map(w => w.toUpperCase()).join('_');
    default: {
      const result = words.join(' ');
      return originalText && originalText[0] === originalText[0].toUpperCase() ? capitalize(result) : result;
    }
  }
};

export const applyToCompoundHead = (term, { connectors, transformWord } = {}) => {
  if (!term || !String(term).trim()) return '';
  const original = String(term).trim();
  const format = detectTextFormat(original);
  const words = splitIntoWords(original, format);

  let transformed = false;
  const out = words.map(word => {
    const normalized = normalizeLookup(word);
    if (connectors?.has?.(normalized)) return word;
    if (!transformed) {
      transformed = true;
      return transformWord ? transformWord(word) : word;
    }
    return word;
  });

  return rebuildFromWords(out, format, original);
};

export const applyToCompoundWords = (term, { connectors, transformWord } = {}) => {
  if (!term || !String(term).trim()) return '';
  const original = String(term).trim();
  const format = detectTextFormat(original);
  const words = splitIntoWords(original, format);

  const out = words.map(word => {
    const normalized = normalizeLookup(word);
    if (connectors?.has?.(normalized)) return word;
    return transformWord ? transformWord(word) : word;
  });

  return rebuildFromWords(out, format, original);
};
