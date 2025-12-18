export const EN_DEFAULT_IRREGULARS = {};

export const pluralizeWordEn = word => {
  const lower = String(word || '').toLowerCase();
  if (!lower) return '';
  if (lower.endsWith('y')) return `${lower.slice(0, -1)}ies`;
  if (lower.endsWith('s')) return `${lower}es`;
  return `${lower}s`;
};

export const singularizeWordEn = word => {
  const lower = String(word || '').toLowerCase();
  if (!lower) return '';
  if (lower.endsWith('ies')) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith('ses')) return lower.slice(0, -2);
  if (lower.endsWith('s')) return lower.slice(0, -1);
  return lower;
};

export const createEnglishInflector = () => ({
  locale: 'en',
  defaultIrregulars: EN_DEFAULT_IRREGULARS,
  pluralizeWord: pluralizeWordEn,
  singularizeWord: singularizeWordEn
});

