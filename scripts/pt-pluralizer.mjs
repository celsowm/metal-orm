export {
  stripDiacritics,
  normalizeLookup,
  detectTextFormat,
  splitIntoWords,
  rebuildFromWords,
  applyToCompoundHead
} from './inflection/compound.mjs';

import {
  PT_BR_CONNECTORS as DEFAULT_CONNECTORS,
  pluralizeWordPtBr,
  pluralizeRelationPropertyPtBr as pluralizeCompoundHead
} from './inflection/pt-br.mjs';

export { DEFAULT_CONNECTORS, pluralizeWordPtBr, pluralizeCompoundHead };

export const pluralizeTerm = pluralizeCompoundHead;
export default pluralizeTerm;
