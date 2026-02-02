# Plan: Include Views in Entity Generation Script

**STATUS: ✅ IMPLEMENTED**

## Overview

Add support for generating TypeScript entities from database views, alongside the existing table entity generation. Views are read-only database objects that can be represented as entities for querying purposes.

---

## Key Decision: `@Entity` with `type: 'view'` vs `@View` Decorator

### Recommendation: Extend `@Entity` with `type: 'view'`

Using a separate `@View` decorator would **break compatibility** with existing entity-based functions:

| Function | Impact if `@View` is separate |
|----------|-------------------------------|
| `selectFromEntity()` | ❌ Won't work - expects `@Entity` metadata |
| `getTableDefFromEntity()` | ❌ Won't find view metadata |
| `entityRef()` | ❌ Won't resolve view |
| `bootstrapEntities()` | ❌ Won't include views |
| `OrmSession.find()` | ❌ Won't work with views |

**Solution:** Add `type?: 'table' | 'view'` to `EntityOptions`:

```typescript
@Entity({ tableName: 'active_users', type: 'view' })
export class ActiveUser { ... }
```

This ensures:
- ✅ `selectFromEntity(ActiveUser)` works
- ✅ All existing query builders work
- ✅ Metadata stored in same registry
- ✅ Only write operations are blocked for views

---

## 1. Schema Types Changes

**File:** `src/core/ddl/schema-types.ts`

### Changes:
- Add `DatabaseView` interface similar to `DatabaseTable`
- Extend `DatabaseSchema` to include `views` array

```typescript
/** Represents a view in the database schema. */
export interface DatabaseView {
  name: string;
  schema?: string;
  columns: DatabaseColumn[];
  definition?: string;  // Optional: the SQL definition of the view
  comment?: string;
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
  views?: DatabaseView[];  // New field
}
```

---

## 2. Introspect Options Changes

**File:** `src/core/ddl/introspect/types.ts`

### Changes:
- Add `includeViews` option to `IntrospectOptions`
- Add `includeViewDefinitions` option (optional, for capturing view SQL)

```typescript
export interface IntrospectOptions {
  schema?: string;
  includeTables?: string[];
  excludeTables?: string[];
  includeViews?: boolean;          // NEW: include views in introspection
  excludeViews?: string[];         // NEW: views to exclude
  includeViewDefinitions?: boolean; // NEW: capture view SQL definition
}
```

---

## 3. Dialect-Specific Introspectors

Each dialect needs to query the system catalog for views:

### 3.1 PostgreSQL (`src/core/ddl/introspect/postgres.ts`)

Query `information_schema.views` and `pg_catalog` for view metadata:
```sql
-- Get views from information_schema
SELECT table_schema, table_name 
FROM information_schema.views 
WHERE table_schema = $1;

-- Get view columns (reuse column query with views)
-- Get view definition
SELECT pg_get_viewdef(c.oid) as definition
FROM pg_catalog.pg_class c
WHERE c.relkind = 'v' AND c.relname = $1;
```

### 3.2 MySQL (`src/core/ddl/introspect/mysql.ts`)

Query `information_schema.VIEWS`:
```sql
SELECT TABLE_SCHEMA, TABLE_NAME, VIEW_DEFINITION
FROM information_schema.VIEWS
WHERE TABLE_SCHEMA = ?;
```

### 3.3 SQLite (`src/core/ddl/introspect/sqlite.ts`)

Query `sqlite_master`:
```sql
SELECT name, sql 
FROM sqlite_master 
WHERE type = 'view';
```

### 3.4 MSSQL (`src/core/ddl/introspect/mssql.ts`)

Query `sys.views` and `sys.sql_modules`:
```sql
SELECT v.name, s.name as schema_name, m.definition
FROM sys.views v
JOIN sys.schemas s ON v.schema_id = s.schema_id
LEFT JOIN sys.sql_modules m ON v.object_id = m.object_id
WHERE s.name = @schema;
```

---

## 4. Entity Decorator Extension

**File:** `src/decorators/entity.ts`

Extend `EntityOptions` to support views:

```typescript
export interface EntityOptions {
  tableName?: string;
  hooks?: TableHooks;
  type?: 'table' | 'view';  // NEW: default 'table'
}
```

**File:** `src/orm/entity-metadata.ts`

Add `type` to `EntityMetadata`:

```typescript
export interface EntityMetadata {
  target: EntityConstructor;
  tableName: string;
  type: 'table' | 'view';  // NEW
  columns: Record<string, ColumnMetadata>;
  relations: Record<string, RelationMetadata>;
  table?: TableDef;
}
```

### Runtime Write Protection

**File:** `src/orm/orm-session.ts`

Block write operations on views:

```typescript
// In saveGraph, updateGraph, patchGraph, delete methods:
const meta = getEntityMetadata(entityClass);
if (meta?.type === 'view') {
  throw new Error(`Cannot perform write operations on view '${meta.tableName}'`);
}
```

---

## 5. CLI Changes

**File:** `scripts/generate-entities/cli.mjs`

### New Flags:
| Flag | Description |
|------|-------------|
| `--include-views` | Include views in generation (default: false) |
| `--views-only` | Generate only views, skip tables |
| `--exclude-views=v1,v2` | Exclude specific views |
| `--view-decorator` | Use `@View` instead of `@Entity` for views |

```javascript
// Add to parser.options:
'include-views': { type: 'boolean' },
'views-only': { type: 'boolean' },
'exclude-views': { type: 'string' },
'view-decorator': { type: 'boolean' }
```

---

## 6. Generation Script Changes

### 6.1 Schema Metadata (`scripts/generate-entities/schema.mjs`)

- Add `buildViewMetadata()` function (simpler than tables - no relations needed)
- Modify `buildSchemaMetadata()` to include views

```javascript
export const buildSchemaMetadata = (schema, naming, options = {}) => {
  // ... existing table logic ...
  
  const views = options.includeViews && schema.views
    ? schema.views.map(v => ({
        name: v.name,
        schema: v.schema,
        columns: v.columns,
        isView: true
      }))
    : [];

  return { tables, views, classNames, relations, resolveClassName };
};
```

### 6.2 Renderer (`scripts/generate-entities/render.mjs`)

- Add `renderViewClassLines()` function
- No relations for views (they are read-only projections)
- Add `@View` or `@Entity({ type: 'view' })` decorator
- Consider adding `readonly` TypeScript modifiers to properties

```javascript
const renderViewClassLines = ({ view, className, naming, options }) => {
  const lines = [];
  
  // JSDoc comment if available
  if (view.comment) appendJsDoc(lines, view.comment);
  
  // Decorator
  const decorator = options.viewDecorator ? 'View' : 'Entity';
  const opts = { viewName: view.name };
  if (!options.viewDecorator) opts.type = 'view';
  lines.push(`@${decorator}(${JSON.stringify(opts)})`);
  
  lines.push(`export class ${className} {`);
  
  // Columns (all readonly since views are read-only)
  for (const col of view.columns) {
    // ... column rendering (no PK decorator for views)
  }
  
  lines.push('}', '');
  return lines;
};
```

### 6.3 Generator (`scripts/generate-entities/generate.mjs`)

- Pass `includeViews` option to `introspectSchema()`
- Process views in rendering phase

---

## 7. Import Statement Updates

**File:** `scripts/generate-entities/render.mjs`

Add to `METAL_ORM_IMPORT_ORDER`:
```javascript
const METAL_ORM_IMPORT_ORDER = [
  'col',
  'Entity',
  'View',  // NEW
  'Column',
  // ...
];
```

Update `getMetalOrmImportNamesFromUsage()` to track `needsViewDecorator`.

---

## 8. Documentation Updates

**File:** `docs/generate-entities.md`

Add section documenting:
- New view-related CLI flags
- How views are generated
- Limitations (read-only, no relations)
- Example output

---

## 9. Test Coverage

### Test Files to Create/Update:
1. `tests/introspect/views.test.ts` - View introspection for each dialect
2. `tests/generate-entities/views.test.ts` - View entity generation
3. Update existing integration tests

### Test Cases:
- [ ] Introspect views from PostgreSQL
- [ ] Introspect views from MySQL
- [ ] Introspect views from SQLite
- [ ] Introspect views from MSSQL
- [ ] Generate view entities with `@View` decorator
- [ ] Generate view entities with `@Entity({ type: 'view' })`
- [ ] Exclude specific views
- [ ] Views-only generation mode
- [ ] View comments are preserved
- [ ] Column types are correctly inferred from view columns

---

## 10. Implementation Order

1. **Schema Types** - Add `DatabaseView` interface
2. **Introspect Types** - Add view options
3. **PostgreSQL Introspector** - Implement view introspection
4. **View Decorator** - Create `@View` decorator (or extend `@Entity`)
5. **CLI** - Add view-related flags
6. **Renderer** - Add view rendering logic
7. **Generator** - Wire view processing
8. **Other Dialects** - MySQL, SQLite, MSSQL
9. **Tests** - Comprehensive test coverage
10. **Documentation** - Update docs

---

## 11. Considerations

### Naming Conventions:
- Use same naming strategy for views as tables
- Option to prefix view class names (e.g., `VwActiveUsers`)

### Read-Only Enforcement:
- Views are inherently read-only
- Consider adding runtime checks to prevent insert/update/delete on view entities
- TypeScript readonly modifiers on properties (optional)

### Materialized Views Support

| Database | Regular Views | Materialized Views | Notes |
|----------|--------------|-------------------|-------|
| **PostgreSQL** | ✅ `pg_class.relkind = 'v'` | ✅ `pg_class.relkind = 'm'` | Full support, `REFRESH MATERIALIZED VIEW` |
| **MySQL** | ✅ `information_schema.VIEWS` | ❌ Not supported | No native materialized views |
| **SQLite** | ✅ `sqlite_master.type = 'view'` | ❌ Not supported | No native materialized views |
| **MSSQL** | ✅ `sys.views` | ⚠️ Indexed Views | `WITH SCHEMABINDING` + unique clustered index |

#### Implementation for Materialized Views:

```typescript
export interface DatabaseView {
  name: string;
  schema?: string;
  columns: DatabaseColumn[];
  definition?: string;
  comment?: string;
  isMaterialized?: boolean;  // NEW
}

export interface EntityOptions {
  tableName?: string;
  type?: 'table' | 'view' | 'materialized_view';  // Extended
}
```

#### Refresh Support (future):

```typescript
// For materialized views only
await session.refreshView(ActiveUsersView);
// Generates: REFRESH MATERIALIZED VIEW active_users;
```

### Complex Views:
- Views with aggregations, joins may have inferred column types
- Need robust column type detection from view definitions

---

## 12. Example Output

### Input View:
```sql
CREATE VIEW active_users AS
SELECT id, name, email, created_at
FROM users
WHERE is_active = true;
```

### Generated Entity (with readonly properties):
```typescript
import { Entity, Column, col } from 'metal-orm';

/**
 * Active users view
 */
@Entity({ tableName: 'active_users', type: 'view' })
export class ActiveUser {
  @Column(col.int())
  readonly id!: number;

  @Column(col.varchar(255))
  readonly name!: string;

  @Column(col.varchar(255))
  readonly email!: string;

  @Column(col.datetime<Date>())
  readonly createdAt?: Date;
}

// Usage - works with existing APIs:
const activeUsers = await selectFromEntity(ActiveUser)
  .where(eq(ActiveUser.columns.name, 'John'))
  .execute(session);

// This would throw at runtime:
// await session.saveGraph(ActiveUser, { ... }); // Error: Cannot write to view
```

---

## Summary

This plan adds view support to the entity generation pipeline with:
- New `DatabaseView` type in schema
- View introspection for all 4 dialects
- Optional `@View` decorator
- CLI flags for view control
- Read-only semantics for view entities
