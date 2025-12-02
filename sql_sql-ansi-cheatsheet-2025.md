
# SQL Feature Compatibility Cheat Sheet (ANSI vs Major RDBMS vs Metal-ORM, 2025)

This document summarizes a broad set of SQL features and indicates:

- **ANSI?**
  - ✔ = defined in some version of the SQL standard (SQL‑92, SQL:1999, SQL:2003, SQL:2011, SQL:2016, SQL:2023, etc.)
  - (P) = partially standardized / standardized but implemented with significant variation
  - ✖ = purely dialect-specific (non‑ANSI)
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
- ✖ = not supported

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
| `LIMIT n`                                  | Pagination     |  ✖  | ✔   | ✔   | ✖   | ~   | ✔   | ✔   | Non‑standard; standard uses `FETCH FIRST`                                  |
| `OFFSET n`                                 | Pagination     | (P) | ✔   | ✔   | (P) | (P) | ✔   | ✔   | Common in PG/MY/SQ; MS/OR use `FETCH`/`OFFSET`                             |
| `FETCH FIRST n ROWS ONLY`                  | Pagination     |  ✔  | ✔   | ✔   | ✔   | ✔   | ~   | ~   | Standard way to limit number of rows                                       |
| `INSERT INTO ... VALUES (...)`             | DML            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Literal insert                                                              |
| `INSERT INTO ... SELECT ...`               | DML            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Insert from query                                                          |
| `UPDATE ... SET ...`                       | DML            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Update rows                                                                 |
| `DELETE FROM ...`                          | DML            |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Delete rows                                                                 |
| `MERGE INTO ... USING ...`                 | Advanced DML   |  ✔  | ✔   | ✖   | ✔   | ✔   | ✖   | ✖   | Standard UPSERT; MY/SQ rely on non‑standard alternatives                   |
| `RETURNING` (after DML)                    | Advanced DML   | (P) | ✔   | ✖   | ~   | ~   | ✖   | ✖   | Newer standard / partial; heavily used in PostgreSQL                       |
| `CALL procedure(...)`                      | Procedures     | (P) | ✔   | ✔   | ✔   | ✔   | ✖   | ✖   | Standard in SQL/PSM, but syntax details vary                               |

---

## 2. Predicates, Operators, and Expressions

| Feature / Syntax                 | Category         | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                       |
|----------------------------------|------------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-------------------------------------------------------------|
| `=`, `<>`, `<`, `>`, `<=`, `>=` | Comparison       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Standard comparison operators                               |
| `AND`, `OR`, `NOT`              | Boolean          |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Boolean operators                                           |
| `BETWEEN a AND b`               | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Inclusive range                                             |
| `IN (values/subquery)`          | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Membership in a list                                        |
| `LIKE 'pattern'`                | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Pattern matching with `%` and `_`                          |
| `LIKE ... ESCAPE ''`           | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ~   | Explicit escape character                                   |
| `IS NULL` / `IS NOT NULL`       | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | NULL tests                                                  |
| `EXISTS (subquery)`             | Predicate        |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Tests for row existence                                     |
| `CASE WHEN ... THEN ... END`    | Expression       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Standard conditional expression                             |
| `COALESCE(a,b,...)`             | Scalar function  |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ~   | First non‑NULL                                              |
| `NULLIF(a,b)`                   | Scalar function  |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ~   | Returns NULL if `a = b`                                     |
| `IS DISTINCT FROM`              | NULL‑safe compare| (P) | ✔   | ~   | ~   | ~   | ✔   | ✖   | Standardized later; implementations differ                  |
| `ILIKE`                         | Text             | ✖   | ✔   | ✖   | ✖   | ✖   | ✖   | ✖   | PostgreSQL case‑insensitive LIKE                            |
| Regex predicates (`~`, `REGEXP`)| Text / Regex     | ✖   | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Regex support is non‑standard everywhere                    |

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
| `GROUPING SETS (...)`                     | Grouping      |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✖   | Explicit grouping sets                                                 |
| `ROLLUP (...)`                            | Grouping      |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✖   | Hierarchical subtotals                                                 |
| `CUBE (...)`                              | Grouping      |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✖   | All dimension combinations                                             |
| `DISTINCT` in aggregates (`COUNT(DISTINCT)`)| Aggregate   |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ~   | Distinct values inside aggregate                                      |

---

## 4. JOINs and Set Operations

| Feature / Syntax                      | Category          | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                               |
|---------------------------------------|-------------------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-------------------------------------------------------------------------------------|
| `CROSS JOIN`                          | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Cartesian product                                                                   |
| `[INNER] JOIN ... ON ...`             | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Inner join                                                                          |
| `LEFT [OUTER] JOIN`                   | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Left outer join                                                                     |
| `RIGHT [OUTER] JOIN`                  | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Supported in recent SQLite; older versions lack it                                  |
| `FULL [OUTER] JOIN`                   | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Supported in recent SQLite; older versions use workarounds                          |
| `NATURAL JOIN`                        | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Joins on columns with same name                                                     |
| `JOIN ... USING (col,...)`            | Join              |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Shorthand for join on columns with same name                                        |
| `LATERAL` / `CROSS APPLY`             | Advanced join     | (P) | ✔   | ✖   | ~   | ~   | ✖   | ✖   | Standard has `LATERAL`; SQL Server uses `CROSS/OUTER APPLY` (non‑standard)         |
| `UNION`                               | Set operation     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Union with duplicate elimination                                                    |
| `UNION ALL`                           | Set operation     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Union without duplicate elimination                                                 |
| `INTERSECT`                           | Set operation     |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | MySQL 8.0.31+ supports `INTERSECT`                                                  |
| `EXCEPT`                              | Set operation     |  ✔  | ✔   | ✔   | ✔   | ✖   | ✔   | ✖   | Oracle uses `MINUS` instead of `EXCEPT`                                             |
| `MINUS`                               | Set operation     | ✖   | ✖   | ✖   | ✖   | ✔   | ✖   | ✖   | Oracle‑specific equivalent of `EXCEPT`                                             |

---

## 5. DDL: Tables, Indexes, Schemas

| Feature / Syntax                     | Category  | ANSI | PG  | MY  | MS  | OR  | SQ  | MO  | Notes                                                                  |
|--------------------------------------|-----------|:----:|:---:|:---:|:---:|:---:|:---:|:---:|-------------------------------------------------------------------------|
| `CREATE TABLE`                       | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Table creation                                                         |
| `ALTER TABLE ADD COLUMN`             | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Add column                                                             |
| `ALTER TABLE ALTER/MODIFY COLUMN`    | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Syntax differs by database                                             |
| `ALTER TABLE DROP COLUMN`            | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Drop column                                                            |
| `DROP TABLE`                         | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Drop table                                                             |
| `CREATE SCHEMA`                      | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✔   | SQLite does not implement separate schemas                            |
| `DROP SCHEMA`                        | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✔   | Same as above                                                          |
| `CREATE DATABASE`                    | DDL       | ✖   | ✔   | ✔   | ✔   | ✔   | ✖   | ✔   | Non‑standard; engine‑specific                                          |
| `DROP DATABASE`                      | DDL       | ✖   | ✔   | ✔   | ✔   | ✔   | ✖   | ✔   | Same                                                                  |
| `CREATE VIEW`                        | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Logical view                                                           |
| `CREATE MATERIALIZED VIEW`          | DDL       | (P) | ✔   | ✖   | ~   | ✔   | ✖   | ✖   | PG/OR support materialized views; MS uses indexed views (~)           |
| `CREATE INDEX`                       | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Index creation                                                         |
| `DROP INDEX`                         | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✔   | Drop index                                                             |
| `CREATE SEQUENCE`                    | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✖   | Sequence object; SQLite has no sequences                              |
| `ALTER SEQUENCE`, `NEXT VALUE FOR`   | DDL       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✖   | Syntax differs; concept is standardized                               |

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
| `DEFERRABLE` / `INITIALLY DEFERRED`               | Advanced constraint      |  ✔  | ✔   | ✖   | ~   | ✔   | ✖   | ✖   | Controls when constraint is checked (end of transaction vs row‑by‑row)         |

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
| `GRANT ... ON ... TO ...`             | Security       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✔   | Privilege management                                               |
| `REVOKE ... FROM ...`                 | Security       |  ✔  | ✔   | ✔   | ✔   | ✔   | ✖   | ✔   | Revoke privileges                                                  |
| `CREATE ROLE` / `CREATE USER`         | Security       | (P) | ✔   | ✔   | ✔   | ✔   | ✖   | ✔   | User/role model is standardized conceptually but differs in detail |

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
| `INTERVAL`                          | Date/Time    |  ✔  | ✔   | ✖   | ✖   | ✔   | ✖   | ✖   | PG/OR implement rich INTERVAL; MY/MS use functions instead           |
| `BOOLEAN`                           | Boolean      |  ✔  | ✔   | ~   | ✔   | ✔   | ~   | ✔   | MY maps to `TINYINT(1)`; SQ accepts but does not enforce strongly   |
| `ENUM`                              | Text         | ✖   | ✔   | ✔   | ✖   | ✖   | ✖   | ✖   | Extension in PG/MY                                                   |
| `JSON` / `JSONB` (native type)      | JSON         | (P) | ✔   | ✔   | ✔   | ✔   | ~   | ✔   | SQL/JSON is standardized; native type details vary                  |
| `XML` (native type)                | XML          | (P) | ✔   | ✖   | ✔   | ✔   | ✖   | ✖   | SQL/XML in standard; strong support in OR/MS/PG                     |
| `ARRAY`                             | Collection   | ✖   | ✔   | ✖   | ✖   | ~   | ✖   | ✖   | Powerful extension in PostgreSQL                                    |

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
| `CREATE PROCEDURE`                         | Stored procedure    | (P) | ✔   | ✔   | ✔   | ✔   | ✖   | ✖   | SQL/PSM defines it, but each DB has its own procedural language              |
| `CREATE FUNCTION`                          | Stored function     | (P) | ✔   | ✔   | ✔   | ✔   | ✖   | ✖   | In PG/OR, can be SQL/PL; in MS/MY, proprietary dialects                      |
| `CREATE TRIGGER`                           | Trigger             |  ✔  | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | `BEFORE`/`AFTER` on DML operations                                           |
| `INSTEAD OF` trigger                       | View trigger        | (P) | ✔   | ✖   | ✔   | ✔   | ✖   | ✖   | Intercepts operations on views                                               |
| Exception / error handling (`SIGNAL`, etc)| Error handling      | (P) | ~   | ✔   | ✔   | ✔   | ✖   | ✖   | SQL/PSM defines it; implementations vary greatly                             |
| `INFORMATION_SCHEMA.TABLES`, `COLUMNS`,... | Standard metadata   |  ✔  | ✔   | ✔   | ✔   | ~   | ✖   | ✖   | Standard metadata views; Oracle focuses more on `ALL_*/USER_*/DBA_*` views   |
| Native catalogs (`pg_catalog`, `sys`, etc)| Native metadata     | ✖   | ✔   | ✔   | ✔   | ✔   | ✔   | ✖   | Engine‑specific catalog views                                                |

---

## 11. Common Non‑ANSI Dialect Extensions

| Feature / Syntax                       | Dialect     | ANSI | PG  | MY  | MS  | OR  | SQ  | Notes                                                          |
|----------------------------------------|------------|:----:|:---:|:---:|:---:|:---:|:---:|-----------------------------------------------------------------|
| `SERIAL` / `BIGSERIAL`                | PostgreSQL | ✖   | ✔   | ✖   | ✖   | ✖   | ✖   | Sugar for sequence + default                                   |
| `AUTO_INCREMENT`                      | MySQL      | ✖   | ✖   | ✔   | ✖   | ✖   | ✖   | Built‑in auto increment                                        |
| `IDENTITY(1,1)`                       | SQL Server | ✖   | ✖   | ✖   | ✔   | ~   | ✖   | Identity columns                                               |
| `NVARCHAR`, `NCHAR`                   | Unicode    | ✖   | ✔   | ✔   | ✔   | ✔   | ✖   | Unicode‑aware character types                                  |
| `NVL(expr, alt)`                      | Oracle/MS  | ✖   | ✖   | ✖   | ✔   | ✔   | ✖   | COALESCE‑like (2 arguments)                                    |
| `DECODE(expr, v1,r1, ..., default)`   | Oracle     | ✖   | ✖   | ✖   | ✖   | ✔   | ✖   | Oracle conditional expression (switch‑like)                    |
| `TOP (n) [PERCENT]`                   | SQL Server | ✖   | ✖   | ✖   | ✔   | ✖   | ✖   | Non‑standard row limit                                         |
| `INSERT ... ON CONFLICT DO ...`       | PostgreSQL | ✖   | ✔   | ✖   | ✖   | ✖   | ✖   | PostgreSQL UPSERT                                              |
| `INSERT ... ON DUPLICATE KEY UPDATE`  | MySQL      | ✖   | ✖   | ✔   | ✖   | ✖   | ✖   | MySQL UPSERT                                                   |
| `REPLACE INTO`                        | MySQL/SQ   | ✖   | ✖   | ✔   | ✖   | ✖   | ✔   | DELETE+INSERT semantics                                        |
| JSON operators (`->`, `->>`, `#>`...) | PostgreSQL | ✖   | ✔   | ✖   | ✖   | ✖   | ✖   | Rich JSON manipulation                                         |
| `CONNECT BY PRIOR`                    | Oracle     | ✖   | ✖   | ✖   | ✖   | ✔   | ✖   | Legacy hierarchical query syntax                               |
| `PRAGMA ...`                          | SQLite     | ✖   | ✖   | ✖   | ✖   | ✖   | ✔   | Engine configuration knobs (foreign_keys, journal_mode, etc.)  |

---

This cheat sheet focuses on SQL language features and their support across major relational databases and Metal-ORM in 2025. For exact behavior and edge cases, always consult the official documentation of each RDBMS.

---

## Metal-ORM Support Summary

**Fully Supported Features (✔):**
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

**Partially Supported Features (~):**   - LIKE ESCAPE, COALESCE, NULLIF, DISTINCT in aggregates
- FETCH FIRST n ROWS ONLY (partial support)
- SET TRANSACTION ISOLATION LEVEL (partial support)

**Not Supported Features (✖):**
- Advanced DML: MERGE, RETURNING, CALL procedure
- Advanced joins: LATERAL, CROSS APPLY, NATURAL JOIN, JOIN USING
- Set operations: UNION, UNION ALL, INTERSECT, EXCEPT, MINUS
- Advanced constraints: DEFERRABLE, INITIALLY DEFERRED
- Advanced DDL: CREATE MATERIALIZED VIEW, CREATE SEQUENCE, ALTER SEQUENCE
- Advanced data types: ENUM, XML, ARRAY
- Dialect-specific features: SERIAL, AUTO_INCREMENT, IDENTITY, NVARCHAR, NVL, DECODE, TOP, ON CONFLICT, ON DUPLICATE KEY, REPLACE INTO, JSON operators, CONNECT BY PRIOR, PRAGMA
- Programmability: CREATE PROCEDURE, CREATE FUNCTION, CREATE TRIGGER, INSTEAD OF trigger, Exception handling
- Metadata: INFORMATION_SCHEMA, Native catalogs

For exact behavior and edge cases, always consult the official documentation of each RDBMS.
