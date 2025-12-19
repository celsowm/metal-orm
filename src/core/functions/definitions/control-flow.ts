import type { FunctionDefinition } from '../function-registry.js';

export const controlFlowFunctionDefinitions: FunctionDefinition[] = [
  {
    name: 'COALESCE',
    renderer: ({ compiledArgs }) => `COALESCE(${compiledArgs.join(', ')})`
  },
  {
    name: 'NULLIF',
    renderer: ({ compiledArgs }) => `NULLIF(${compiledArgs[0]}, ${compiledArgs[1]})`
  },
  {
    name: 'GREATEST',
    renderer: ({ compiledArgs }) => `GREATEST(${compiledArgs.join(', ')})`
  },
  {
    name: 'LEAST',
    renderer: ({ compiledArgs }) => `LEAST(${compiledArgs.join(', ')})`
  },
  {
    name: 'IFNULL',
    renderer: ({ compiledArgs }) => `IFNULL(${compiledArgs[0]}, ${compiledArgs[1]})`
  }
];
