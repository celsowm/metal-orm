# Function Registry (easy → hard)

MetalORM uses an explicit, instance-based function registry. Here’s a smallest-possible example, then progressively deeper control.

## 1) Smallest: LEN/CHAR_LENGTH and CONCAT out of the box

```ts
import { SelectQueryBuilder } from 'metal-orm';
import { SqlServerDialect } from 'metal-orm';
import { length, concat } from 'metal-orm/dist/core/functions/text.js';
import { Users } from './schema.js';

const query = new SelectQueryBuilder(Users)
  .select({
    nameLen: length(Users.columns.username),          // LEN() on MSSQL, LENGTH/CHAR_LENGTH elsewhere
    fullLabel: concat(Users.columns.firstName, ' ', Users.columns.lastName) // CONCAT or dialect equivalent
  });

const compiled = query.compile(new SqlServerDialect());
// Uses LEN() automatically for MSSQL via the default registry
console.log(compiled.sql);
```

## 2) Use the defaults (still easy)

- Every `Dialect` constructor creates a fresh registry via `createDefaultFunctionRegistry()`, pre-registering built-in text functions (`LOWER`, `CONCAT`, `POSITION`, `LEN` aliasing, etc.).
- No changes needed if you just want the stock functions.

## 3) Extend the defaults with one function

```ts
import { createDefaultFunctionRegistry } from 'metal-orm/dist/core/functions/registry-factory.js';
import { PostgresDialect, SelectQueryBuilder, eq } from 'metal-orm';
import { lower } from 'metal-orm/dist/core/functions/text.js';
import { Users } from './schema.js';

// Start with built-ins, then add one
const registry = createDefaultFunctionRegistry();
registry.register({
  key: 'ILIKE',
  defaultName: 'ILIKE',
  variants: { mysql: { available: false }, sqlite: { available: false } },
  render: ({ compiledArgs, name }) => `${compiledArgs[0]} ${name} ${compiledArgs[1]}`
});

const dialect = new PostgresDialect(registry);
const query = new SelectQueryBuilder(Users)
  .select({ id: Users.columns.id, username: lower(Users.columns.username) })
  .where(eq(Users.columns.username, 'Ada'));

const compiled = query.compile(dialect);
```

## 4) Override/disable per dialect

- Change names: `variants: { sqlite: { name: 'unicode' } }`.
- Block usage: `variants: { mysql: { available: false } }` throws if compiled for that dialect.
- Duplicate keys in the same registry throw to avoid silent overrides.

## 5) Build a minimal registry

If you want only selected functions, start empty and opt in:

```ts
import { InMemoryFunctionRegistry } from 'metal-orm/dist/core/functions/function-registry.js';
import { registerTextFunctions } from 'metal-orm/dist/core/functions/text.js';

const registry = new InMemoryFunctionRegistry();
registerTextFunctions(registry); // or skip to stay minimal
// register your own functions here...
```

## 6) Scope registries (harder)

- **Per connection/tenant:** create a registry per tenant, register tenant-specific functions, and pass that registry into the dialect used for their queries.
- **Testing:** use a fresh registry per test; duplicate-key errors catch accidental reuse across tests.
- **Feature flags:** register optional functions conditionally before instantiating the dialect handed to the query builder.

This progression keeps the simple path simple and lets you add control as you need it—without relying on a global mutable singleton.
