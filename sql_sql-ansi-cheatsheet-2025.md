
# SQL Feature Compatibility Cheat Sheet (ANSI vs Major RDBMS vs Metal-ORM, 2025)

This document summarizes a broad set of SQL features and indicates:

- **ANSI?**
  - ✔ = defined in some version of the SQL standard (SQL‑92, SQL:1999, SQL:2003, SQL:2011, SQL:2016, SQL:2023, etc.)
  - (P) = partially standardized / standardized but implemented with significant variation
  - x = purely dialect-specific (non‑ANSI)
- **Database support**
  - **PG** = PostgreSQL 15+/18+
  - **MY** = MySQL 8.0.31+/8.4+
  - **MS** = Microsoft SQL Server 2022 / 2025
  - **OR** = Oracle Database 19c / 23ai
  - **SQ** = SQLite 3.39+
  - **MO** = Metal-ORM (current implementation)

Support legend in the tables:

- ✔ = feature is supported and commonly used
- ~ = partially supported, different semantics, or requires workarounds
- x = not supported

---

## 1. DQL / DML Basics

| Feature / Syntax                            | Category       | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                      |
|--------------------------------------------|----------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|----------------------------------------------------------------------------|
| `SELECT`                                   | DQL            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Basic query                                                                |
| `SELECT DISTINCT`                          | DQL            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Removes duplicates                                                         |
| `FROM`                                     | DQL            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Source tables/views                                                       |
| `WHERE`                                    | Filter         |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Row-level filtering                                                        |
| `GROUP BY`                                 | Aggregation    |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Grouping for aggregates                                                    |
| `HAVING`                                   | Aggregation    |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Filter after grouping                                                      |
| `ORDER BY`                                 | Sorting        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Result ordering                                                            |
| `LIMIT n`                                  | Pagination     |  x  | ✔   | ✔   | x   | ~   | ✔   | ✔   | Non‑standard; standard uses `FETCH FIRST`                                  |
| `OFFSET n`                                 | Pagination     | (P) | ✔   | ✔   | (P) | (P) | ✔   | ✔   | Common in PG/MY/SQ; MS/OR use `FETCH`/`OFFSET`                             |
| `FETCH FIRST n ROWS ONLY`                  | Pagination     |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ~   | Standard way to limit number of rows                                       |
| `INSERT INTO ... VALUES (...)`             | DML            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Literal insert                                                              |
| `INSERT INTO ... SELECT ...`               | DML            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Insert from query                                                          |
| `UPDATE ... SET ...`                       | DML            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Update rows                                                                 |
| `DELETE FROM ...`                          | DML            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Delete rows                                                                 |
| `MERGE INTO ... USING ...`                 | Advanced DML   |  ✔  | ✔   | x   | ✔   | ✔   | x   | x   | Standard UPSERT; MY/SQ rely on non‑standard alternatives                   |
| `RETURNING` (after DML)                    | Advanced DML   | (P) | ✔   | x   | ~   | ~   | x   | ~   | Emitted when the dialect supports it (Postgres, SQLite) |
| `CALL procedure(...)`                      | Procedures     | (P) | ✔   | ✔   | ✔   | ✔   | x   | x   | Standard in SQL/PSM, but syntax details vary                               |

---

## 2. Predicates, Operators, and Expressions

| Feature / Syntax                 | Category         | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                       |
|----------------------------------|------------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-------------------------------------------------------------|
| `=`, `<>`, `<`, `>`, `<=`, `>=` | Comparison       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Standard comparison operators                               |
| `AND`, `OR`, `NOT`              | Boolean          |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Boolean operators                                           |
| `BETWEEN a AND b`               | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Inclusive range                                             |
| `IN (values/subquery)`          | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Membership in a list                                        |
| `LIKE 'pattern'`                | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Pattern matching with `%` and `_`                          |
| `LIKE ... ESCAPE ''`           | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Explicit escape character (Metal-ORM exposes `escape` in `like`/`notLike`) |
| `IS NULL` / `IS NOT NULL`       | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | NULL tests                                                  |
| `EXISTS (subquery)`             | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Tests for row existence                                     |
| `CASE WHEN ... THEN ... END`    | Expression       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Standard conditional expression                             |
| `COALESCE(a,b,...)`             | Scalar function  |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ~   | First non‑NULL                                              |
| `NULLIF(a,b)`                   | Scalar function  |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ~   | Returns NULL if `a = b`                                     |
| `IS DISTINCT FROM`              | NULL‑safe compare| (P) | ✔   | ~   | ~   | ~   | ✔   | x   | Standardized later; implementations differ                  |
| `ILIKE`                         | Text             | x   | ✔   | x   | x   | x   | x   | x   | PostgreSQL case‑insensitive LIKE                            |
| Regex predicates (`~`, `REGEXP`)| Text / Regex     | x   | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Regex support is non‑standard everywhere                    |

---

## 3. Aggregations and GROUP BY

| Feature / Syntax                          | Category      | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                  |
|-------------------------------------------|---------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|------------------------------------------------------------------------|
| `COUNT(*)`                                | Aggregate     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Counts rows                                                            |
| `SUM(expr)`                               | Aggregate     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Sums values                                                            |
| `AVG(expr)`                               | Aggregate     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Average                                                                |
| `MIN(expr)`, `MAX(expr)`                  | Aggregate     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Minimum / maximum                                                      |
| `GROUP BY col,...`                        | Grouping      |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Groups rows for aggregation                                           |
| `HAVING cond`                             | Group filter  |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Filter after `GROUP BY`                                                |
| `GROUPING SETS (...)`                     | Grouping      |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | x   | Explicit grouping sets                                                 |
| `ROLLUP (...)`                            | Grouping      |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | x   | Hierarchical subtotals                                                 |
| `CUBE (...)`                              | Grouping      |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | x   | All dimension combinations                                             |
| `DISTINCT` in aggregates (`COUNT(DISTINCT)`)| Aggregate   |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ~   | Distinct values inside aggregate                                      |

---

## 4. JOINs and Set Operations

| Feature / Syntax                      | Category          | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                               |
|---------------------------------------|-------------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-------------------------------------------------------------------------------------|
| `CROSS JOIN`                          | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Cartesian product                                                                   |
| `[INNER] JOIN ... ON ...`             | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Inner join                                                                          |
| `LEFT [OUTER] JOIN`                   | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Left outer join                                                                     |
| `RIGHT [OUTER] JOIN`                  | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Supported in recent SQLite; older versions lack it                                  |
| `FULL [OUTER] JOIN`                   | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Supported in recent SQLite; older versions use workarounds                          |
| `NATURAL JOIN`                        | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Joins on columns with same name                                                     |
| `JOIN ... USING (col,...)`            | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Shorthand for join on columns with same name                                        |
| `LATERAL` / `CROSS APPLY`             | Advanced join     | (P) | ✔   | x   | ~   | ~   | x   | x   | Standard has `LATERAL`; SQL Server uses `CROSS/OUTER APPLY` (non‑standard)         |
| `UNION`                               | Set operation     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Union with duplicate elimination                                                    |
| `UNION ALL`                           | Set operation     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Union without duplicate elimination                                                 |
| `INTERSECT`                           | Set operation     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | MySQL 8.0.31+ supports `INTERSECT`                                                  |
| `EXCEPT`                              | Set operation     |  ✔  | ✔   | ✔   | ✔   | x   | ✔   | x   | Oracle uses `MINUS` instead of `EXCEPT`                                             |
| `MINUS`                               | Set operation     | x   | x   | x   | x   | ✔   | x   | x   | Oracle‑specific equivalent of `EXCEPT`                                             |

---

## 5. DDL: Tables, Indexes, Schemas

| Feature / Syntax                     | Category  | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                  |
|--------------------------------------|-----------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-------------------------------------------------------------------------|
| `CREATE TABLE`                       | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Table creation                                                         |
| `ALTER TABLE ADD COLUMN`             | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Add column                                                             |
| `ALTER TABLE ALTER/MODIFY COLUMN`    | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Syntax differs by database                                             |
| `ALTER TABLE DROP COLUMN`            | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Drop column                                                            |
| `DROP TABLE`                         | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Drop table                                                             |
| `CREATE SCHEMA`                      | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | ✔   | SQLite does not implement separate schemas                            |
| `DROP SCHEMA`                        | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | ✔   | Same as above                                                          |
| `CREATE DATABASE`                    | DDL       | x   | ✔   | ✔   | ✔   | ✔   | x   | ✔   | Non‑standard; engine‑specific                                          |
| `DROP DATABASE`                      | DDL       | x   | ✔   | ✔   | ✔   | ✔   | x   | ✔   | Same                                                                  |
| `CREATE VIEW`                        | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Logical view                                                           |
| `CREATE MATERIALIZED VIEW`          | DDL       | (P) | ✔   | x   | ~   | ✔   | x   | x   | PG/OR support materialized views; MS uses indexed views (~)           |
| `CREATE INDEX`                       | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Index creation                                                         |
| `DROP INDEX`                         | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Drop index                                                             |
| `CREATE SEQUENCE`                    | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | x   | Sequence object; SQLite has no sequences                              |
| `ALTER SEQUENCE`, `NEXT VALUE FOR`   | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | x   | Syntax differs; concept is standardized                               |

---

## 6. Constraints and Referential Integrity

| Feature / Syntax                                  | Category                 | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                           |
|---------------------------------------------------|--------------------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|----------------------------------------------------------------------------------|
| `PRIMARY KEY`                                     | Constraint               |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Primary key                                                                     |
| `UNIQUE`                                          | Constraint               |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Unique constraint                                                               |
| `NOT NULL`                                        | Constraint               |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Disallow NULL                                                                   |
| `CHECK (condition)`                               | Constraint               |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | SQLite enforces `CHECK` fully only in newer versions                            |
| `FOREIGN KEY (...) REFERENCES t(col,...)`         | Referential integrity    |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | SQ requires foreign_keys pragma in some setups                                  |
| `ON DELETE CASCADE/SET NULL/SET DEFAULT/RESTRICT` | Referential actions      |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | SQLite may not implement all actions in older versions                          |
| `ON UPDATE CASCADE/SET NULL/SET DEFAULT/RESTRICT` | Referential actions      |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | Same as above                                                                   |
| `DEFERRABLE` / `INITIALLY DEFERRED`               | Advanced constraint      |  ✔  | ✔   | x   | ~   | ✔   | x   | x   | Controls when constraint is checked (end of transaction vs row‑by‑row)         |

---

## 7. Transactions, Locking, and Security

| Feature / Syntax                      | Category       | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                              |
|---------------------------------------|----------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|--------------------------------------------------------------------|
| `BEGIN` / `START TRANSACTION`         | Transaction    |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Starts transaction                                                 |
| `COMMIT`                              | Transaction    |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Commit changes                                                     |
| `ROLLBACK`                            | Transaction    |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Roll back changes                                                  |
| `SAVEPOINT name`                      | Transaction    |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Intermediate transaction marker                                    |
| `ROLLBACK TO SAVEPOINT`               | Transaction    |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Roll back to savepoint                                             |
| `SET TRANSACTION ISOLATION LEVEL ...` | Transaction    |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | SQ does not expose standard isolation level syntax                 |
| `GRANT ... ON ... TO ...`             | Security       |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | ✔   | Privilege management                                               |
| `REVOKE ... FROM ...`                 | Security       |  ✔  | ✔   | ✔   | ✔   | ✔   | x   | ✔   | Revoke privileges                                                  |
| `CREATE ROLE` / `CREATE USER`         | Security       | (P) | ✔   | ✔   | ✔   | ✔   | x   | ✔   | User/role model is standardized conceptually but differs in detail |

---

## 8. Data Types (Main Groups)

| Type / Feature                      | Category     | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                 |
|-------------------------------------|--------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-----------------------------------------------------------------------|
| `INTEGER` / `SMALLINT` / `BIGINT`  | Numeric      |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | SQ stores values dynamically (affinity model)                        |
| `DECIMAL(p,s)` / `NUMERIC(p,s)`    | Numeric      |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | Exact precision                                                      |
| `REAL` / `DOUBLE PRECISION` / `FLOAT` | Numeric    |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | Floating‑point                                                       |
| `CHAR(n)`, `VARCHAR(n)`            | Text         |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | Basic text types                                                     |
| `CLOB`, `BLOB`                      | LOB          |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | Large objects; names differ (TEXT, BYTEA, etc.)                      |
| `DATE`                              | Date/Time    |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | Date only                                                            |
| `TIME [WITH/WITHOUT TIME ZONE]`     | Date/Time    |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | Time only                                                            |
| `TIMESTAMP [WITH/WITHOUT TIME ZONE]`| Date/Time    |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | Date+time; names and aliases differ                                  |
| `INTERVAL`                          | Date/Time    |  ✔  | ✔   | x   | x   | ✔   | x   | x   | PG/OR implement rich INTERVAL; MY/MS use functions instead           |
| `BOOLEAN`                           | Boolean      |  ✔  | ✔   | ~   | ✔   | ✔   | ~   | ✔   | MY maps to `TINYINT(1)`; SQ accepts but does not enforce strongly   |
| `ENUM`                              | Text         | x   | ✔   | ✔   | x   | x   | x   | x   | Extension in PG/MY                                                   |
| `JSON` / `JSONB` (native type)      | JSON         | (P) | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | SQL/JSON is standardized; native type details vary                  |
| `XML` (native type)                | XML          | (P) | ✔   | x   | ✔   | ✔   | x   | x   | SQL/XML in standard; strong support in OR/MS/PG                     |
| `ARRAY`                             | Collection   | x   | ✔   | x   | x   | ~   | x   | x   | Powerful extension in PostgreSQL                                    |

---

## 9. CTEs and Window Functions

| Feature / Syntax                                  | Category          | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                 |
|---------------------------------------------------|-------------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-----------------------------------------------------------------------|
| `WITH cte AS (SELECT ...)`                        | Non‑recursive CTE |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Named temporary result set                                            |
| `WITH RECURSIVE cte AS (...)`                     | Recursive CTE     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Hierarchical / recursive queries                                     |
| `func(...) OVER (PARTITION BY ... ORDER BY ...)`  | Window function   |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Window functions standardized in SQL:2003+                           |
| `ROW_NUMBER() OVER (...)`                         | Window function   |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Sequential numbering                                                  |
| `RANK()`, `DENSE_RANK()` OVER (...)               | Window function   |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Ranking with ties                                                     |
| `LAG(expr)`, `LEAD(expr)` OVER (...)              | Window function   |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Access previous/next row                                              |
| `NTILE(n) OVER (...)`                             | Window function   |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Buckets rows into quantiles                                           |
| `WINDOW w AS (PARTITION BY ... ORDER BY ...)`     | Window clause     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Names a window for reuse                                              |

---

## 10. Programmability, Triggers, and Metadata

| Feature / Syntax                           | Category            | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                         |
|--------------------------------------------|---------------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-------------------------------------------------------------------------------|
| `CREATE PROCEDURE`                         | Stored procedure    | (P) | ✔   | ✔   | ✔   | ✔   | x   | x   | SQL/PSM defines it, but each DB has its own procedural language              |
| `CREATE FUNCTION`                          | Stored function     | (P) | ✔   | ✔   | ✔   | ✔   | x   | x   | In PG/OR, can be SQL/PL; in MS/MY, proprietary dialects                      |
| `CREATE TRIGGER`                           | Trigger             |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | x   | `BEFORE`/`AFTER` on DML operations                                           |
| `INSTEAD OF` trigger                       | View trigger        | (P) | ✔   | x   | ✔   | ✔   | x   | x   | Intercepts operations on views                                               |
| Exception / error handling (`SIGNAL`, etc)| Error handling      | (P) | ~   | ✔   | ✔   | ✔   | x   | x   | SQL/PSM defines it; implementations vary greatly                             |
| `INFORMATION_SCHEMA.TABLES`, `COLUMNS`,... | Standard metadata   |  ✔  | ✔   | ✔   | ✔   | ~   | x   | x   | Standard metadata views; Oracle focuses more on `ALL_*/USER_*/DBA_*` views   |
| Native catalogs (`pg_catalog`, `sys`, etc)| Native metadata     | x   | ✔   | ✔   | ✔   | ✔   | ✔   | x   | Engine‑specific catalog views                                                |

---

## 11. Common Non‑ANSI Dialect Extensions

| Feature / Syntax                       | Dialect     | ANSI | PG  | MY  | MS  | OR  | SQ  | Notes                                                          |
|----------------------------------------|------------|:----:|:---:|:---:|:---:|:---:|:---:|-----------------------------------------------------------------|
| `SERIAL` / `BIGSERIAL`                | PostgreSQL | x   | ✔   | x   | x   | x   | x   | Sugar for sequence + default                                   |
| `AUTO_INCREMENT`                      | MySQL      | x   | x   | ✔   | x   | x   | x   | Built‑in auto increment                                        |
| `IDENTITY(1,1)`                       | SQL Server | x   | x   | x   | ✔   | ~   | x   | Identity columns                                               |
| `NVARCHAR`, `NCHAR`                   | Unicode    | x   | ✔   | ✔   | ✔   | ✔   | x   | Unicode‑aware character types                                  |
| `NVL(expr, alt)`                      | Oracle/MS  | x   | x   | x   | ✔   | ✔   | x   | COALESCE‑like (2 arguments)                                    |
| `DECODE(expr, v1,r1, ..., default)`   | Oracle     | x   | x   | x   | x   | ✔   | x   | Oracle conditional expression (switch‑like)                    |
| `TOP (n) [PERCENT]`                   | SQL Server | x   | x   | x   | ✔   | x   | x   | Non‑standard row limit                                         |
| `INSERT ... ON CONFLICT DO ...`       | PostgreSQL | x   | ✔   | x   | x   | x   | x   | PostgreSQL UPSERT                                              |
| `INSERT ... ON DUPLICATE KEY UPDATE`  | MySQL      | x   | x   | ✔   | x   | x   | x   | MySQL UPSERT                                                   |
| `REPLACE INTO`                        | MySQL/SQ   | x   | x   | ✔   | x   | x   | ✔   | DELETE+INSERT semantics                                        |
| JSON operators (`->`, `->>`, `#>`...) | PostgreSQL | x   | ✔   | x   | x   | x   | x   | Rich JSON manipulation                                         |
| `CONNECT BY PRIOR`                    | Oracle     | x   | x   | x   | x   | ✔   | x   | Legacy hierarchical query syntax                               |
| `PRAGMA ...`                          | SQLite     | x   | x   | x   | x   | x   | ✔   | Engine configuration knobs (foreign_keys, journal_mode, etc.)  |

---

## 12. Schema generation, introspection, and synchronization

Metal-ORM ships with dialect-aware schema tooling that can emit DDL for PostgreSQL, MySQL/MariaDB, SQLite, and SQL Server. The generator renders tables, columns, indexes (unique and partial/filtered where supported), constraints, foreign keys, defaults, and identity/auto-increment definitions in dependency order so a single statement list bootstraps the schema.

`introspectSchema(executor, dialect, options)` walks a live database in those dialects and returns a `DatabaseSchema` snapshot that records tables, columns, indexes, and foreign keys.

`diffSchema(expectedTables, actualSchema, dialect, options)` compares the schema metadata and produces ordered change plans that `synchronizeSchema(...)` can apply. Use `allowDestructive` and `dryRun` to gate drops, and pay attention to the SQLite warning about table rebuilds when a destructive change is required.

See `docs/schema-generation.md` for examples of generating, introspecting, diffing, and synchronizing schemas.

This cheat sheet focuses on SQL language features and their support across major relational databases and Metal-ORM in 2025. For exact behavior and edge cases, always consult the official documentation of each RDBMS.

---

## Metal-ORM Support Summary

**Fully Supported Features (?):**
- Basic DQL/DML: SELECT, WHERE, GROUP BY, HAVING, ORDER BY, LIMIT, OFFSET
- Joins: INNER, LEFT, RIGHT joins with smart relation handling
- CTEs: WITH and WITH RECURSIVE support
- Window Functions: ROW_NUMBER, RANK, DENSE_RANK, LAG, LEAD, NTILE, etc.
- Subqueries: EXISTS, NOT EXISTS, scalar subqueries
- Expressions: CASE WHEN, BETWEEN, IN, IS NULL, etc.
- Aggregations: COUNT, SUM, AVG, MIN, MAX, etc.
- Basic DDL operations: CREATE/DROP TABLE, INDEX, VIEW, SCHEMA, DATABASE
- Constraints: PRIMARY KEY, UNIQUE, NOT NULL, CHECK, FOREIGN KEY
- Transactions: BEGIN, COMMIT, ROLLBACK, SAVEPOINT
- Schema tooling: dialect-aware DDL generation plus `introspectSchema`, `diffSchema`, and `synchronizeSchema` helpers for Postgres, MySQL/MariaDB, SQLite, and SQL Server (covers defaults, checks, identities/auto-increment, FK/index metadata via `DatabaseSchema`, and `allowDestructive`/`dryRun` safeguards).

**Partially Supported Features (~):**
- LIKE ESCAPE, COALESCE, NULLIF, DISTINCT in aggregates
- FETCH FIRST n ROWS ONLY (partial support)
- SET TRANSACTION ISOLATION LEVEL (partial support)
- RETURNING / OUTPUT where the dialect exposes it (Postgres, SQLite)

**Not Supported Features (x):**
- Advanced DML: MERGE, CALL procedure
- Advanced joins: LATERAL, CROSS APPLY, NATURAL JOIN, JOIN USING
- Set operations: UNION, UNION ALL, INTERSECT, EXCEPT, MINUS
- Advanced constraints: DEFERRABLE, INITIALLY DEFERRED
- Advanced DDL: CREATE MATERIALIZED VIEW, CREATE SEQUENCE, ALTER SEQUENCE
- Advanced data types: ENUM, XML, ARRAY
- Dialect-specific features: SERIAL, AUTO_INCREMENT, IDENTITY, NVARCHAR, NVL, DECODE, TOP, ON CONFLICT, ON DUPLICATE KEY, REPLACE INTO, JSON operators, CONNECT BY PRIOR, PRAGMA
- Programmability: CREATE PROCEDURE, CREATE FUNCTION, CREATE TRIGGER, INSTEAD OF trigger, Exception handling
- Metadata: INFORMATION_SCHEMA, Native catalogs

For exact behavior and edge cases, always consult the official documentation of each RDBMS.
