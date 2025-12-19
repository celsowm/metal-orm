# Function Strategies & Customization

MetalORM uses a Strategy pattern to handle SQL function rendering across different dialects. This architecture ensures that standard functions work consistently while allowing each dialect to override behavior where necessary.

## The Strategy Pattern

Instead of a global registry, each `Dialect` implementation (like `PostgresDialect` or `SqlServerDialect`) manages its own `FunctionStrategy`.

### FunctionRegistry & modular definitions

Behind the scenes `StandardFunctionStrategy` now seeds a shared `FunctionRegistry` with ANSI renderers that are grouped into purpose-built definition modules, for example:
- `src/core/functions/definitions/aggregate.ts`
- `src/core/functions/definitions/string.ts`
- `src/core/functions/definitions/datetime.ts`
- `src/core/functions/definitions/numeric.ts`
- `src/core/functions/definitions/control-flow.ts`
- `src/core/functions/definitions/json.ts`

The strategy just wires those modules together, so you can also compose your own registry and reuse the helper definitions or inject custom renderers before handing it off to a dialect:

```ts
import { FunctionRegistry } from 'metal-orm/dist/core/functions/function-registry.js';
import { StandardFunctionStrategy } from 'metal-orm/dist/core/functions/standard-strategy.js';

const registry = new FunctionRegistry();
registry.add('MY_VENDOR_FN', () => 'MY_VENDOR_FN()');

const strategy = new StandardFunctionStrategy(registry);
```

You can also call `registry.merge(...)` to layer overrides on top of other renderer sets.

### StandardFunctionStrategy

The `StandardFunctionStrategy` provides ANSI-compliant implementations for most common functions:
- Aggregates: `COUNT`, `SUM`, `AVG`, `MIN`, `MAX`.
- Math: `ABS`, `ROUND`, `SQRT`, `POW`, etc.
- Text: `LOWER`, `UPPER`, `LENGTH`, `CONCAT`, `POSITION`.
- DateTime: `NOW`, `DAY`, `MONTH`, `YEAR`, `EXTRACT`.

### Dialect Overrides

Each dialect extends the standard strategy to handle its own syntax:
- **SQL Server**: Mapped `LENGTH` and `CHAR_LENGTH` to `LEN()`. Replaced `POSITION` with `CHARINDEX()`.
- **PostgreSQL**: Uses `CHR()` for character conversion and `STRING_AGG` for aggregate concatenation.
- **SQLite**: Polyfills `HOUR()`, `MINUTE()`, and `QUARTER()` using `strftime` modifiers.
- **MySQL**: Uses optimized built-in functions like `DATE_FORMAT` and `QUARTER()`.

## Customizing Functions

If you need to add a custom SQL function or override an existing one, you can extend the `StandardFunctionStrategy` or a dialect-specific strategy.

### 1. Define a Custom Strategy

```ts
import { StandardFunctionStrategy, FunctionRenderContext } from 'metal-orm/dist/core/functions/standard-strategy.js';

export class MyCustomStrategy extends StandardFunctionStrategy {
    constructor() {
        super();
        // Add a new function
        this.add('MY_CUSTOM_FN', ({ compiledArgs }) => `MY_CUSTOM_FN(${compiledArgs.join(', ')})`);
        
        // Override an existing one
        this.add('UPPER', ({ compiledArgs }) => `CUSTOM_UPPER_WRAPPER(${compiledArgs[0]})`);
    }
}
```

### 2. Use it with a Dialect

You can pass your custom strategy when instantiating a dialect:

```ts
import { PostgresDialect, SelectQueryBuilder } from 'metal-orm';

const myDialect = new PostgresDialect();
// Note: In current architecture, you'd likely need to modify the 
// Dialect class or provide a way to inject common strategies.
```

> [!NOTE]
> Most users will find that the built-in functions cover 99% of use cases. MetalORM's `POSITION` and `LOCATE` helpers already automatically normalize parameter orders (e.g., `substr, str` vs `str, substr`) across all 4 dialects.

## How it works internally

1.  **AST Builder**: A helper like `lower('abc')` creates a `FunctionNode` with name `'LOWER'`.
2.  **Compilation**: The `SelectQueryBuilder` calls `dialect.compile(ast)`.
3.  **Dispatch**: The dialect's `compileFunctionOperand` method looks up the renderer for `'LOWER'` in its `FunctionStrategy`.
4.  **Rendering**: The renderer produces the final SQL string (e.g., `LOWER(?)`).
5.  **Fallback**: If no renderer is found, it falls back to a generic `NAME(args...)` format.
