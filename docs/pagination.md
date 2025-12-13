# Pagination

MetalORM reuses the same fluent query builder you already know to fetch paged result sets.

## Paging the builder

Use `limit()` and `offset()` together with `orderBy()` to define the slice of data that you want to return:

```typescript
const pageSize = 20;
const page = 2;

const builder = new SelectQueryBuilder(users)
  .select({ id: users.columns.id, name: users.columns.name })
  .orderBy(users.columns.createdAt, 'DESC')
  .limit(pageSize)
  .offset((page - 1) * pageSize);

const [rows] = await builder.execute(session);
```

Ordering is important for pagination because it guarantees deterministic results and keeps the limit/offset aligned with a specific sort order.

Generated SQL (SQLite):

```sql
SELECT "users"."id" AS "id", "users"."name" AS "name" FROM "users" ORDER BY "users"."created_at" DESC LIMIT 20 OFFSET 20;
```

## Pagination with eager includes

If you call `include()` together with `limit()`/`offset()` and your query brings back a has-many or belongs-to-many relation, MetalORM automatically rewrites the SQL so that the pagination clause applies to the parent rows instead of the joined detail rows.

The rewrite keeps everything in a single statement:

1. The original query (without `limit`, `offset`, or `orderBy`) becomes a base CTE.
2. A paging CTE selects distinct parent keys from that base CTE with the requested `orderBy`, `limit`, and `offset`.
3. The outer query joins the base CTE back to the paging CTE, bringing in the joined child rows for that page.

The generated SQL names the helper CTEs `__metal_pagination_base` and `__metal_pagination_page`, so you can confirm the rewrite by looking for those identifiers in the compiled SQL.

This guard only runs when ordering values come from the root table. Ordering by child-table columns still uses the original query because those child values can split pages differently. When that happens, rely on lazy includes (`includeLazy`) to page the parents and defer child loading until after the parent page is fixed.

## When pagination rewriting isn't applied

- No multiplying relations are included (only `HasOne`, `BelongsTo`, or `HasMany` with eager includes).
- The query uses a set operator (`UNION`, `INTERSECT`, etc.) because hydration metadata is skipped in that scenario.
- The `orderBy()` clause references columns that aren't projected from the root table (either child columns or computed expressions without stable aliases).

In those cases you can still paginate the query normally, but be mindful that `limit/offset` act on the joined row set, so deduplicate or lazy-load the relation manually if necessary.

For extra visibility, call `builder.getHydrationPlan()` after configuring the query. When pagination rewriting is in effect, the plan still includes each relation plus the information needed to hydrate the results despite the CTE injection.

## Level 2 (ORM runtime) notes

When you execute a paginated builder via `Orm`/`OrmSession`, the same pagination guard applies before the query runs. In Level 2 scenarios the hydrated entities still expose lazy relation helpers and the identity map, so paging doesn't prevent you from calling `user.orders.load()` afterward—each entity simply reflects the trimmed page that the rewritten SQL produced.

If you need to verify pagination behavior inside the runtime, the `tests/orm/pagination-level2-orm.test.ts` vitest covers a page-size + offset scenario, asserts that the query only executes once, and asserts that the compiled SQL still mentions `__metal_pagination_page` along with the requested `LIMIT`/`OFFSET`.

### Example (Level 2 pagination + eager include)

```typescript
import { SqliteDialect } from 'metal-orm/core/dialect/sqlite';
import { Orm, OrmSession } from 'metal-orm/orm';
import { SelectQueryBuilder } from 'metal-orm/query-builder';
import { Users } from './schema';

const { executor } = createMockExecutor([...]); // any DbExecutor works
const orm = new Orm({
  dialect: new SqliteDialect(),
  executorFactory: { createExecutor: () => executor, createTransactionalExecutor: () => executor }
});
const session = new OrmSession({ orm, executor });

const pageSize = 2;
const page = 3;

const users = await new SelectQueryBuilder(Users)
  .select({ id: Users.columns.id, name: Users.columns.name })
  .include('orders', { columns: ['id', 'user_id', 'total', 'status'] }) // eager has-many
  .orderBy(Users.columns.id, 'ASC')
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .execute(session);

// Each entity reflects the paged parents; lazy helpers still work
const orders = await users[0].orders.load();

// Inspect the compiled SQL for the pagination guard if needed:
const { sql } = new SelectQueryBuilder(Users)
  .include('orders', { columns: ['id', 'user_id', 'total', 'status'] })
  .orderBy(Users.columns.id, 'ASC')
  .limit(pageSize)
  .offset((page - 1) * pageSize)
  .compile(new SqliteDialect());
// sql contains "__metal_pagination_page"
```

Generated SQL (SQLite, abbreviated columns):

```sql
WITH "__metal_pagination_base" AS (SELECT "users"."id" AS "id", "users"."name" AS "name", "orders"."id" AS "orders__id", "orders"."user_id" AS "orders__user_id", "orders"."total" AS "orders__total", "orders"."status" AS "orders__status" FROM "users" LEFT JOIN "orders" ON "orders"."user_id" = "users"."id"), "__metal_pagination_page" AS (SELECT DISTINCT "__metal_pagination_base"."id" AS "id" FROM "__metal_pagination_base" ORDER BY "__metal_pagination_base"."id" ASC LIMIT 2 OFFSET 4) SELECT "__metal_pagination_base"."id" AS "id", "__metal_pagination_base"."name" AS "name", "__metal_pagination_base"."orders__id" AS "orders__id", "__metal_pagination_base"."orders__user_id" AS "orders__user_id", "__metal_pagination_base"."orders__total" AS "orders__total", "__metal_pagination_base"."orders__status" AS "orders__status" FROM "__metal_pagination_base" INNER JOIN "__metal_pagination_page" ON "__metal_pagination_base"."id" = "__metal_pagination_page"."id" ORDER BY "__metal_pagination_base"."id" ASC;
```
