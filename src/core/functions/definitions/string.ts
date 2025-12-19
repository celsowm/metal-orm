import type { FunctionDefinition } from '../function-registry.js';
import { binaryRenderer, unaryRenderer, variadicRenderer } from './helpers.js';

export const stringFunctionDefinitions: FunctionDefinition[] = [
  { name: 'UPPER', renderer: unaryRenderer('UPPER') },
  { name: 'LOWER', renderer: unaryRenderer('LOWER') },
  { name: 'LENGTH', renderer: unaryRenderer('LENGTH') },
  { name: 'CHAR_LENGTH', renderer: unaryRenderer('CHAR_LENGTH') },
  { name: 'CHARACTER_LENGTH', renderer: unaryRenderer('CHARACTER_LENGTH') },
  { name: 'TRIM', renderer: unaryRenderer('TRIM') },
  { name: 'LTRIM', renderer: unaryRenderer('LTRIM') },
  { name: 'RTRIM', renderer: unaryRenderer('RTRIM') },
  { name: 'SUBSTRING', renderer: variadicRenderer('SUBSTRING') },
  { name: 'SUBSTR', renderer: variadicRenderer('SUBSTR') },
  { name: 'CONCAT', renderer: variadicRenderer('CONCAT') },
  { name: 'CONCAT_WS', renderer: variadicRenderer('CONCAT_WS') },
  { name: 'ASCII', renderer: unaryRenderer('ASCII') },
  { name: 'CHAR', renderer: variadicRenderer('CHAR') },
  {
    name: 'POSITION',
    renderer: ({ compiledArgs }) => `POSITION(${compiledArgs[0]} IN ${compiledArgs[1]})`
  },
  { name: 'REPLACE', renderer: ({ compiledArgs }) => `REPLACE(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})` },
  { name: 'REPEAT', renderer: binaryRenderer('REPEAT') },
  { name: 'LPAD', renderer: ({ compiledArgs }) => `LPAD(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})` },
  { name: 'RPAD', renderer: ({ compiledArgs }) => `RPAD(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})` },
  { name: 'LEFT', renderer: binaryRenderer('LEFT') },
  { name: 'RIGHT', renderer: binaryRenderer('RIGHT') },
  { name: 'INSTR', renderer: binaryRenderer('INSTR') },
  {
    name: 'LOCATE',
    renderer: ({ compiledArgs }) =>
      compiledArgs.length === 3
        ? `LOCATE(${compiledArgs[0]}, ${compiledArgs[1]}, ${compiledArgs[2]})`
        : `LOCATE(${compiledArgs[0]}, ${compiledArgs[1]})`
  },
  { name: 'SPACE', renderer: unaryRenderer('SPACE') },
  { name: 'REVERSE', renderer: unaryRenderer('REVERSE') },
  { name: 'INITCAP', renderer: unaryRenderer('INITCAP') },
  { name: 'MD5', renderer: unaryRenderer('MD5') },
  { name: 'SHA1', renderer: unaryRenderer('SHA1') },
  { name: 'SHA2', renderer: ({ compiledArgs }) => `SHA2(${compiledArgs[0]}, ${compiledArgs[1]})` }
];
