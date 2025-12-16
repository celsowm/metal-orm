# Comprehensive Anti-Patterns and SOLID Violations Report

This report consolidates all identified anti-patterns and SOLID principles violations found in the `src` directory. Each entry includes the location of the issue, a description, and a suggestion for remediation.

---

## 🔴 Critical Issues (High Priority)

### 1. **Violation: Global Mutable State**

-   **Location:**
    -   `src/orm/entity-metadata.ts` (Line 183)
    -   `src/core/ddl/introspect/registry.ts` (Line 6)
    -   `src/query-builder/select-query-builder-deps.ts` (Line 137)
    -   `src/schema/table.ts` (Line 161)
-   **Description:** The use of mutable global variables (`metadataMap`, `registry`, `defaultSelectQueryBuilderDependencies`, `TABLE_REF_CACHE`) introduces global state, which makes testing difficult and can lead to unpredictable behavior. This is a major architectural anti-pattern.
-   **Suggestion:** Refactor to use an instance-based approach. For example, create a `MetadataRegistry` class and pass it via dependency injection.

### 2. **Violation: Single Responsibility Principle (God Objects)**

-   **Location:**
    -   `src/orm/orm-session.ts` (Line 50)
    -   `src/orm/unit-of-work.ts` (Line 14)
    -   `src/query-builder/select.ts` (Line 72)
    -   `src/core/dialect/base/sql-dialect.ts` (Line 11)
-   **Description:** The `OrmSession`, `UnitOfWork`, `SelectQueryBuilder`, and `SqlDialectBase` classes are "god objects" that have too many responsibilities. This makes them difficult to understand, test, and maintain.
-   **Suggestion:** Break these classes down into smaller, more focused classes that each have a single responsibility.

### 3. **Violation: Don't Repeat Yourself (DRY)**

-   **Location:**
    -   `src/orm/entity-target.ts` (entire file)
    -   `src/orm/lazy-batch.ts` (Lines 46, 110, 164, 218)
-   **Description:** The `src/orm/entity-target.ts` file is a complete duplicate of `src/decorators/bootstrap.ts`. The `loadHasManyRelation`, `loadHasOneRelation`, `loadBelongsToRelation`, and `loadBelongsToManyRelation` functions in `src/orm/lazy-batch.ts` are all very similar.
-   **Suggestion:** Remove the duplicate file and refactor the `lazy-batch.ts` functions to share a common core.

### 4. **Violation: Unsafe Type Assertions**

-   **Location:** Numerous files, including:
    -   `src/codegen/typescript.ts` (Line 411)
    -   `src/orm/relations/has-many.ts` (Line 84)
    -   `src/orm/relations/has-one.ts` (Line 92)
    -   `src/orm/relations/many-to-many.ts` (Line 66)
    -   `src/core/dialect/mssql/functions.ts` (Line 48)
-   **Description:** The codebase is littered with unsafe type assertions (`as`, `!`). This subverts the type system and can lead to runtime errors.
-   **Suggestion:** Replace all unsafe type assertions with type guards.

---

## 🟡 Medium Priority Issues

### 1. **Violation: Single Responsibility Principle (Complex Functions)**

-   **Location:**
    -   `src/core/ddl/schema-diff.ts` (Line 86)
    -   `src/core/ddl/introspect/mssql.ts` (Line 44)
    -   `src/core/ddl/introspect/mysql.ts` (Line 36)
    -   `src/core/ddl/introspect/postgres.ts` (Line 79)
-   **Description:** The `diffSchema`, `introspect` (in `mssql.ts`, `mysql.ts`, and `postgres.ts`), and other functions are overly long and complex. They handle multiple responsibilities, making them difficult to read, test, and maintain.
-   **Suggestion:** Break these functions down into smaller, more focused functions.

### 2. **Violation: Open/Closed Principle**

-   **Location:**
    -   `src/core/ddl/dialects/mssql-schema-dialect.ts` (Line 35)
    -   `src/core/ddl/dialects/mysql-schema-dialect.ts` (Line 33)
    -   `src/core/ddl/dialects/postgres-schema-dialect.ts` (Line 32)
    -   `src/core/ddl/dialects/sqlite-schema-dialect.ts` (Line 32)
-   **Description:** The `renderColumnType` methods in the dialect classes use a long `switch` statement. This violates the Open/Closed Principle because adding a new column type requires modifying the `switch` statement in every dialect.
-   **Suggestion:** Use a map or object literal to handle the type mappings.

### 3. **Code Smell: Long Parameter Lists**

-   **Location:**
    -   `src/core/dialect/base/cte-compiler.ts` (Line 16)
    -   `src/orm/relations/belongs-to.ts` (Line 30)
    -   `src/orm/relations/has-many.ts` (Line 45)
    -   `src/orm/relations/has-one.ts` (Line 31)
    -   `src/orm/relations/many-to-many.ts` (Line 31)
-   **Description:** Several functions and constructors have long parameter lists. This is a code smell that can make the code difficult to use and test.
-   **Suggestion:** Use an options object to pass the required dependencies.

### 4. **Code Smell: `void` Expressions**

-   **Location:**
    -   `src/core/ddl/dialects/base-schema-dialect.ts` (Line 44)
    -   `src/core/execution/pooling/pool.ts` (Line 61)
-   **Description:** The use of `void` to suppress "unused variable" or "unhandled promise" errors is a code smell that can lead to silent failures and make the code more difficult to understand.
-   **Suggestion:** Prefix unused variables with an underscore and properly handle all promise rejections.

---

## 🟢 Minor Issues (Low Priority)

### 1. **Code Smell: Weak Type Guards**

-   **Location:**
    -   `src/query/target.ts` (Line 6)
    -   `src/query-builder/delete.ts` (Line 104)
    -   `src/query-builder/update.ts` (Line 115)
-   **Description:** Several type guards are a bit weak, as they only check for the presence of a property. A more robust type guard would check the value of the property as well.
-   **Suggestion:** Strengthen the type guards to be more specific.

### 2. **Code Smell: "Best-Effort" Parser**

-   **Location:** `src/query-builder/raw-column-parser.ts` (Line 6)
-   **Description:** The `parseRawColumn` function is a "best-effort" parser, which is a code smell. It's not robust and could easily break with more complex SQL.
-   **Suggestion:** Replace the "best-effort" parser with a more robust solution, or clearly document its limitations.

### 3. **SQL Injection Vulnerability**

-   **Location:** `src/core/ddl/introspect/sqlite.ts` (Line 92)
-   **Description:** The use of `escapeSingleQuotes` for sanitizing table names is a potential SQL injection vulnerability.
-   **Suggestion:** Use parameterized queries instead.
