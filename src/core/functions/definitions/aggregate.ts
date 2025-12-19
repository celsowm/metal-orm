import type { FunctionDefinition } from '../function-registry.js';
import { unaryRenderer } from './helpers.js';

export const aggregateFunctionDefinitions: FunctionDefinition[] = [
  {
    name: 'COUNT',
    renderer: ({ compiledArgs }) =>
      compiledArgs.length ? `COUNT(${compiledArgs.join(', ')})` : 'COUNT(*)'
  },
  { name: 'SUM', renderer: unaryRenderer('SUM') },
  { name: 'AVG', renderer: unaryRenderer('AVG') },
  { name: 'MIN', renderer: unaryRenderer('MIN') },
  { name: 'MAX', renderer: unaryRenderer('MAX') },
  { name: 'STDDEV', renderer: unaryRenderer('STDDEV') },
  { name: 'VARIANCE', renderer: unaryRenderer('VARIANCE') }
];
