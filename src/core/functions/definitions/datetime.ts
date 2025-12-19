import type { FunctionDefinition } from '../function-registry.js';
import { noArgsRenderer } from './helpers.js';

export const dateTimeFunctionDefinitions: FunctionDefinition[] = [
  { name: 'NOW', renderer: noArgsRenderer('NOW') },
  { name: 'CURRENT_DATE', renderer: () => 'CURRENT_DATE' },
  { name: 'CURRENT_TIME', renderer: () => 'CURRENT_TIME' },
  {
    name: 'EXTRACT',
    renderer: ({ compiledArgs }) => `EXTRACT(${compiledArgs[0]} FROM ${compiledArgs[1]})`
  },
  { name: 'YEAR', renderer: ({ compiledArgs }) => `EXTRACT(YEAR FROM ${compiledArgs[0]})` },
  { name: 'MONTH', renderer: ({ compiledArgs }) => `EXTRACT(MONTH FROM ${compiledArgs[0]})` },
  { name: 'DAY', renderer: ({ compiledArgs }) => `EXTRACT(DAY FROM ${compiledArgs[0]})` },
  { name: 'HOUR', renderer: ({ compiledArgs }) => `EXTRACT(HOUR FROM ${compiledArgs[0]})` },
  { name: 'MINUTE', renderer: ({ compiledArgs }) => `EXTRACT(MINUTE FROM ${compiledArgs[0]})` },
  { name: 'SECOND', renderer: ({ compiledArgs }) => `EXTRACT(SECOND FROM ${compiledArgs[0]})` },
  { name: 'QUARTER', renderer: ({ compiledArgs }) => `EXTRACT(QUARTER FROM ${compiledArgs[0]})` },
  { name: 'DATE_ADD', renderer: ({ compiledArgs }) => `(${compiledArgs[0]} + INTERVAL ${compiledArgs[1]} ${compiledArgs[2]})` },
  { name: 'DATE_SUB', renderer: ({ compiledArgs }) => `(${compiledArgs[0]} - INTERVAL ${compiledArgs[1]} ${compiledArgs[2]})` },
  { name: 'DATE_DIFF', renderer: ({ compiledArgs }) => `DATEDIFF(${compiledArgs[0]}, ${compiledArgs[1]})` },
  { name: 'DATE_FORMAT', renderer: ({ compiledArgs }) => `DATE_FORMAT(${compiledArgs[0]}, ${compiledArgs[1]})` },
  { name: 'UNIX_TIMESTAMP', renderer: noArgsRenderer('UNIX_TIMESTAMP') },
  { name: 'FROM_UNIXTIME', renderer: ({ compiledArgs }) => `FROM_UNIXTIME(${compiledArgs[0]})` },
  { name: 'END_OF_MONTH', renderer: ({ compiledArgs }) => `LAST_DAY(${compiledArgs[0]})` },
  { name: 'DAY_OF_WEEK', renderer: ({ compiledArgs }) => `DAYOFWEEK(${compiledArgs[0]})` },
  { name: 'WEEK_OF_YEAR', renderer: ({ compiledArgs }) => `WEEKOFYEAR(${compiledArgs[0]})` },
  { name: 'DATE_TRUNC', renderer: ({ compiledArgs }) => `DATE_TRUNC(${compiledArgs[0]}, ${compiledArgs[1]})` },
  {
    name: 'AGE',
    renderer: ({ compiledArgs }) =>
      compiledArgs.length === 1 ? `AGE(${compiledArgs[0]})` : `AGE(${compiledArgs[0]}, ${compiledArgs[1]})`
  },
  { name: 'LOCALTIME', renderer: () => 'LOCALTIME' },
  { name: 'LOCALTIMESTAMP', renderer: () => 'LOCALTIMESTAMP' }
];
