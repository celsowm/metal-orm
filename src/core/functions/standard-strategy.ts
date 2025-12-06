import { FunctionStrategy, FunctionRenderer, FunctionRenderContext } from './types.js';

export class StandardFunctionStrategy implements FunctionStrategy {
    protected renderers: Map<string, FunctionRenderer> = new Map();

    constructor() {
        this.registerStandard();
    }

    protected registerStandard() {
        // Register ANSI standard implementations
        this.add('ABS', ({ compiledArgs }) => `ABS(${compiledArgs[0]})`);
        this.add('UPPER', ({ compiledArgs }) => `UPPER(${compiledArgs[0]})`);
        this.add('LOWER', ({ compiledArgs }) => `LOWER(${compiledArgs[0]})`);
        this.add('LENGTH', ({ compiledArgs }) => `LENGTH(${compiledArgs[0]})`);
        this.add('TRIM', ({ compiledArgs }) => `TRIM(${compiledArgs[0]})`);
        this.add('LTRIM', ({ compiledArgs }) => `LTRIM(${compiledArgs[0]})`);
        this.add('RTRIM', ({ compiledArgs }) => `RTRIM(${compiledArgs[0]})`);
        this.add('SUBSTRING', ({ compiledArgs }) => `SUBSTRING(${compiledArgs.join(', ')})`);
        this.add('CONCAT', ({ compiledArgs }) => `CONCAT(${compiledArgs.join(', ')})`);
        this.add('NOW', () => `NOW()`);
        this.add('CURRENT_DATE', () => `CURRENT_DATE`);
        this.add('CURRENT_TIME', () => `CURRENT_TIME`);
        this.add('EXTRACT', ({ compiledArgs }) => `EXTRACT(${compiledArgs[0]} FROM ${compiledArgs[1]})`);
        this.add('YEAR', ({ compiledArgs }) => `EXTRACT(YEAR FROM ${compiledArgs[0]})`);
        this.add('MONTH', ({ compiledArgs }) => `EXTRACT(MONTH FROM ${compiledArgs[0]})`);
        this.add('DAY', ({ compiledArgs }) => `EXTRACT(DAY FROM ${compiledArgs[0]})`);
        this.add('DATE_ADD', ({ compiledArgs }) => `(${compiledArgs[0]} + INTERVAL ${compiledArgs[1]} ${compiledArgs[2]})`);
        this.add('DATE_SUB', ({ compiledArgs }) => `(${compiledArgs[0]} - INTERVAL ${compiledArgs[1]} ${compiledArgs[2]})`);
        this.add('DATE_DIFF', ({ compiledArgs }) => `DATEDIFF(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('DATE_FORMAT', ({ compiledArgs }) => `DATE_FORMAT(${compiledArgs[0]}, ${compiledArgs[1]})`);
        this.add('UNIX_TIMESTAMP', () => `UNIX_TIMESTAMP()`);
        this.add('FROM_UNIXTIME', ({ compiledArgs }) => `FROM_UNIXTIME(${compiledArgs[0]})`);
        this.add('END_OF_MONTH', ({ compiledArgs }) => `LAST_DAY(${compiledArgs[0]})`);
        this.add('DAY_OF_WEEK', ({ compiledArgs }) => `DAYOFWEEK(${compiledArgs[0]})`);
        this.add('WEEK_OF_YEAR', ({ compiledArgs }) => `WEEKOFYEAR(${compiledArgs[0]})`);
        this.add('DATE_TRUNC', ({ compiledArgs }) => `DATE_TRUNC(${compiledArgs[0]}, ${compiledArgs[1]})`);
    }

    protected add(name: string, renderer: FunctionRenderer) {
        this.renderers.set(name, renderer);
    }

    getRenderer(name: string): FunctionRenderer | undefined {
        return this.renderers.get(name);
    }
}
