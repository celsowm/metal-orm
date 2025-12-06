Here is the comparison table for **Numeric/Mathematical Functions** across the four database systems.

> **Note on SQLite:** Native mathematical functions (like `sin`, `cos`, `pow`, `log`, etc.) were introduced in **SQLite 3.35.0 (2021)**. In older versions, these require a specific extension to be loaded.

### List of Numeric Functions in SQLite, SQL Server, PostgreSQL, and MySQL

| Function Name | Description | SQLite | SQL Server | PostgreSQL | MySQL | MO |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ABS** | Returns the absolute value of a number. | ✔ | ✔ | ✔ | ✔ | - |
| **ACOS** | Returns the arccosine (inverse cosine). | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **ASIN** | Returns the arcsine (inverse sine). | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **ATAN** | Returns the arctangent (inverse tangent). | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **ATAN2** | Returns the arctangent of the two arguments (y, x). | ✔ (v3.35+) | `ATN2(y, x)` | ✔ | ✔ | - |
| **CEIL / CEILING** | Returns the smallest integer greater than or equal to a number. | `CEIL` (v3.35+) | `CEILING` | ✔ (`CEIL` / `CEILING`) | ✔ (`CEIL` / `CEILING`) | - |
| **COS** | Returns the cosine of a number (in radians). | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **COT** | Returns the cotangent of a number. | Use `1/TAN(x)` | ✔ | ✔ | ✔ | - |
| **DEGREES** | Converts radians to degrees. | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **EXP** | Returns *e* raised to the power of the argument. | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **FLOOR** | Returns the largest integer less than or equal to a number. | ✔ | ✔ | ✔ | ✔ | - |
| **LN** | Returns the natural logarithm (base *e*). | ✔ (v3.35+) | `LOG(x)` | ✔ | `LN(x)` or `LOG(x)` | - |
| **LOG (Base 10)** | Returns the base-10 logarithm. | `LOG(x)` (v3.35+) | `LOG10(x)` | `LOG(x)` | `LOG10(x)` | - |
| **LOG (Base *N*)** | Returns the logarithm of a number for a specific base. | (Math: `ln(x)/ln(b)`) | `LOG(x, base)` | `LOG(base, x)` | `LOG(base, x)` | - |
| **MOD / %** | Returns the remainder of a division. | `%` operator | `%` operator | `MOD(x,y)` or `%` | `MOD(x,y)` or `%` | - |
| **PI** | Returns the value of PI (approx. 3.14159...). | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **POWER / POW** | Returns the value of a number raised to the power of another. | ✔ (v3.35+) | `POWER(x, y)` | `POWER` or `^` | `POW` or `POWER` | - |
| **RADIANS** | Converts degrees to radians. | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **RAND / RANDOM** | Returns a random number. | `RANDOM()` (Returns **Int**) | `RAND()` (Returns Float 0-1) | `RANDOM()` (Returns Float 0-1) | `RAND()` (Returns Float 0-1) | - |
| **ROUND** | Rounds a number to a specified number of decimal places. | ✔ | ✔ | ✔ | ✔ | - |
| **SIGN** | Returns the sign of a number (-1, 0, 1). | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **SIN** | Returns the sine of a number (in radians). | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **SQRT** | Returns the square root of a number. | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **TAN** | Returns the tangent of a number (in radians). | ✔ (v3.35+) | ✔ | ✔ | ✔ | - |
| **TRUNC / TRUNCATE**| Truncates a number to a specific precision (without rounding). | `TRUNC` (v3.35+) | `ROUND(x, y, 1)` | `TRUNC(x, y)` | `TRUNCATE(x, y)` | - |

### Key Differences Summary

1.  **Logarithms (`LOG` vs `LN`):**
    *   **SQL Server** and **MySQL** use `LOG(x)` for Natural Logarithm (base *e*).
    *   **PostgreSQL** and **SQLite** use `LOG(x)` for Base-10 Logarithm (Postgres uses `LN` for natural; SQLite uses `LN` for natural).
    *   *Always check documentation or test `LOG(10)` to see if it returns `1` (Base 10) or `2.302...` (Base e).*

2.  **Random Numbers:**
    *   **SQLite's** `RANDOM()` returns a huge 64-bit signed **integer**. To get a float between 0 and 1 (like other DBs), you usually use: `ABS(RANDOM() / 9223372036854775808.0)`.
    *   The others return a **float** between 0 and 1 natively.

3.  **Truncation:**
    *   **SQL Server** does not have a `TRUNC` or `TRUNCATE` function for numbers (only for tables). You must use `ROUND` with a third parameter set to `1` (e.g., `ROUND(123.456, 2, 1)`).

4.  **ATAN2:**
    *   **SQL Server** names this function `ATN2`. The others use `ATAN2`.
