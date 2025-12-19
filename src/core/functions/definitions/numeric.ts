import type { FunctionDefinition } from '../function-registry.js';
import { binaryRenderer, noArgsRenderer, unaryRenderer } from './helpers.js';

export const numericFunctionDefinitions: FunctionDefinition[] = [
  { name: 'ABS', renderer: unaryRenderer('ABS') },
  { name: 'BIT_LENGTH', renderer: unaryRenderer('BIT_LENGTH') },
  { name: 'OCTET_LENGTH', renderer: unaryRenderer('OCTET_LENGTH') },
  { name: 'CHR', renderer: unaryRenderer('CHR') },
  { name: 'LOG2', renderer: unaryRenderer('LOG2') },
  { name: 'CBRT', renderer: unaryRenderer('CBRT') },
  { name: 'ACOS', renderer: unaryRenderer('ACOS') },
  { name: 'ASIN', renderer: unaryRenderer('ASIN') },
  { name: 'ATAN', renderer: unaryRenderer('ATAN') },
  { name: 'ATAN2', renderer: binaryRenderer('ATAN2') },
  { name: 'CEIL', renderer: unaryRenderer('CEIL') },
  { name: 'CEILING', renderer: unaryRenderer('CEILING') },
  { name: 'COS', renderer: unaryRenderer('COS') },
  { name: 'COT', renderer: unaryRenderer('COT') },
  { name: 'DEGREES', renderer: unaryRenderer('DEGREES') },
  { name: 'EXP', renderer: unaryRenderer('EXP') },
  { name: 'FLOOR', renderer: unaryRenderer('FLOOR') },
  { name: 'LN', renderer: unaryRenderer('LN') },
  {
    name: 'LOG',
    renderer: ({ compiledArgs }) =>
      compiledArgs.length === 2 ? `LOG(${compiledArgs[0]}, ${compiledArgs[1]})` : `LOG(${compiledArgs[0]})`
  },
  { name: 'LOG10', renderer: unaryRenderer('LOG10') },
  { name: 'LOG_BASE', renderer: binaryRenderer('LOG') },
  { name: 'MOD', renderer: binaryRenderer('MOD') },
  { name: 'PI', renderer: noArgsRenderer('PI') },
  { name: 'POWER', renderer: binaryRenderer('POWER') },
  { name: 'POW', renderer: binaryRenderer('POW') },
  { name: 'RADIANS', renderer: unaryRenderer('RADIANS') },
  { name: 'RANDOM', renderer: noArgsRenderer('RANDOM') },
  { name: 'RAND', renderer: noArgsRenderer('RAND') },
  {
    name: 'ROUND',
    renderer: ({ compiledArgs }) =>
      compiledArgs.length === 2 ? `ROUND(${compiledArgs[0]}, ${compiledArgs[1]})` : `ROUND(${compiledArgs[0]})`
  },
  { name: 'SIGN', renderer: unaryRenderer('SIGN') },
  { name: 'SIN', renderer: unaryRenderer('SIN') },
  { name: 'SQRT', renderer: unaryRenderer('SQRT') },
  { name: 'TAN', renderer: unaryRenderer('TAN') },
  {
    name: 'TRUNC',
    renderer: ({ compiledArgs }) =>
      compiledArgs.length === 2 ? `TRUNC(${compiledArgs[0]}, ${compiledArgs[1]})` : `TRUNC(${compiledArgs[0]})`
  },
  {
    name: 'TRUNCATE',
    renderer: ({ compiledArgs }) => `TRUNCATE(${compiledArgs[0]}, ${compiledArgs[1]})`
  }
];
