# Changelog

## Unreleased

- **Fix:** `SelectQueryBuilder.count()` now counts distinct root entities even when includes (`hasMany`/`belongsToMany`) inflate the joined result, while the new `countRows()` helper preserves the legacy joined-row total; SQL Server pagination on distinct queries now emits `ORDER BY 1` instead of `ORDER BY (SELECT NULL)` so MSSQL no longer throws when the ORDER BY clause is implicit.
- **Docs:** Clarified the pagination helpers (`count`, `countRows`, `executePaged`) in `docs/query-builder.md`.
- **Tests:** Added focused coverage for the MSSQL pagination SQL and full end-to-end count/pagination flows across SQLite, Pglite (Postgres), MySQL, and real MSSQL environments to prove `count()` vs `countRows()` and `executePaged()` behavior.
