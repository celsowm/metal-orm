import { createEnglishInflector } from './en.mjs';
import { createPtBrInflector } from './pt-br.mjs';

const INFLECTOR_FACTORIES = new Map();

export const registerInflector = (localePrefix, factory) => {
  const key = String(localePrefix || '').toLowerCase();
  if (!key) throw new Error('localePrefix is required');
  if (typeof factory !== 'function') throw new Error('factory must be a function that returns an inflector');
  INFLECTOR_FACTORIES.set(key, factory);
};

registerInflector('en', createEnglishInflector);
registerInflector('pt', createPtBrInflector);

export const resolveInflector = locale => {
  const normalized = String(locale || 'en').toLowerCase();
  let bestFactory = undefined;
  let bestPrefixLength = 0;
  for (const [prefix, factory] of INFLECTOR_FACTORIES) {
    if (!normalized.startsWith(prefix)) continue;
    if (prefix.length > bestPrefixLength) {
      bestPrefixLength = prefix.length;
      bestFactory = factory;
    }
  }
  if (bestFactory) return bestFactory();
  return createEnglishInflector();
};
