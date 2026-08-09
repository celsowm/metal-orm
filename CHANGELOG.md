# Changelog

## Unreleased

- **Fix:** `TreeManager.removeFromTree()` now promotes direct children, compacts descendant `lft`/`rght`/`depth` values, and repositions the retained node as a valid standalone root instead of leaving stale overlapping boundaries; tree mutation helpers and `MAX(rght)`/insert-ID lookups now honor configured tree scopes so one tenant cannot shift another tenant's nested-set boundaries.
- **Tests:** Added a real SQLite in-memory Tree regression covering child promotion, exact post-removal boundaries/depths, retained-root semantics, and cross-tenant scope isolation.
- **Fix:** `SelectQueryBuilder.count()` now counts distinct root entities even when includes (`hasMany`/`belongsToMany`) inflate the joined result, while the new `countRows()` helper preserves the legacy joined-row total; SQL Server pagination on distinct queries now emits `ORDER BY 1` instead of `ORDER BY (SELECT NULL)` so MSSQL no longer throws when the ORDER BY clause is implicit.
- **Docs:** Clarified the pagination helpers (`count`, `countRows`, `executePaged`) in `docs/query-builder.md`.
- **Tests:** Added focused coverage for the MSSQL pagination SQL and full end-to-end count/pagination flows across SQLite, Pglite (Postgres), MySQL, and real MSSQL environments to prove `count()` vs `countRows()` and `executePaged()` behavior.