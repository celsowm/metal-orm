Here is the comparison table for **Date and Time Functions**.

> **Important Note on SQLite:** SQLite does **not** have a dedicated storage class for dates or times. It stores them as **strings** (ISO8601), **reals** (Julian days), or **integers** (Unix Timestamps). Most functions manipulate these formats directly.

### List of Date and Time Functions in SQLite, SQL Server, PostgreSQL, and MySQL

| Function / Concept | Description | SQLite | SQL Server | PostgreSQL | MySQL | Metal-ORM |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Current Date & Time** | Returns the current local date and time. | `datetime('now')` | `GETDATE()` or `SYSDATETIME()` | `NOW()` or `CURRENT_TIMESTAMP` | `NOW()` | - |
| **Current Date** | Returns only the current date (no time). | `date('now')` | `CAST(GETDATE() AS DATE)` | `CURRENT_DATE` | `CURDATE()` | - |
| **Current Time** | Returns only the current time. | `time('now')` | `CAST(GETDATE() AS TIME)` | `CURRENT_TIME` | `CURTIME()` | - |
| **Current UTC Time** | Returns current UTC/GMT date and time. | `datetime('now', 'utc')` | `GETUTCDATE()` | `NOW() AT TIME ZONE 'UTC'` | `UTC_TIMESTAMP()` | - |
| **Extract Part** | Extracts a part (year, month, day, hour) from a date. | `strftime('%Y', col)` (etc.) | `DATEPART(part, col)` | `EXTRACT(part FROM col)` | `EXTRACT(part FROM col)` | - |
| **Year / Month / Day** | Shorthand functions to get specific parts. | (Use `strftime`) | `YEAR()`, `MONTH()`, `DAY()` | `EXTRACT` or `date_part` | `YEAR()`, `MONTH()`, `DAY()` | - |
| **Add Interval** | Adds a specific time interval to a date. | `date(col, '+1 day')` | `DATEADD(part, number, date)` | `date + INTERVAL '1 day'` | `DATE_ADD(date, INTERVAL 1 DAY)` | - |
| **Subtract Interval** | Subtracts a specific time interval from a date. | `date(col, '-1 day')` | `DATEADD(part, -num, date)` | `date - INTERVAL '1 day'` | `DATE_SUB(date, INTERVAL 1 DAY)` | - |
| **Date Difference** | Returns the difference between two dates. | `julianday(d1) - julianday(d2)` (Returns days) | `DATEDIFF(part, start, end)` (Returns integer of boundaries crossed) | `age(end, start)` (Returns Interval) or `end - start` | `DATEDIFF(d1, d2)` (Returns days) | - |
| **Format Date** | Converts a date object to a formatted string. | `strftime('format', col)` | `FORMAT(col, 'format')` (2012+) | `TO_CHAR(col, 'format')` | `DATE_FORMAT(col, 'format')` | - |
| **Parse Date** | Converts a formatted string into a date object. | (Automatic if ISO8601) | `TRY_PARSE()` or `CONVERT()` | `TO_DATE('str', 'fmt')` | `STR_TO_DATE('str', 'fmt')` | - |
| **Unix Timestamp** | Returns the current Unix epoch (seconds since 1970). | `unixepoch()` (v3.38+) or `strftime('%s','now')` | (Requires complex math) `DATEDIFF(s, '1970-01-01', GETUTCDATE())` | `EXTRACT(EPOCH FROM NOW())` | `UNIX_TIMESTAMP()` | - |
| **From Unix Timestamp** | Converts Unix epoch seconds to a date. | `datetime(col, 'unixepoch')` | `DATEADD(s, col, '1970-01-01')` | `to_timestamp(col)` | `FROM_UNIXTIME(col)` | - |
| **End of Month** | Returns the last day of the month for a given date. | `date(col,'start of month','+1 month','-1 day')` | `EOMONTH(date)` (2012+) | `(date_trunc('month', date) + interval '1 month' - interval '1 day')::date` | `LAST_DAY(date)` | - |
| **Day of Week** | Returns the index of the weekday. | `strftime('%w', col)` (0=Sun, 6=Sat) | `DATEPART(dw, col)` (Depends on `SET DATEFIRST`) | `EXTRACT(DOW FROM col)` (0=Sun) | `DAYOFWEEK(col)` (1=Sun) or `WEEKDAY()` (0=Mon) | - |
| **Week Number** | Returns the week number of the year. | `strftime('%W', col)` | `DATEPART(wk, col)` | `EXTRACT(WEEK FROM col)` | `WEEKOFYEAR(col)` | - |
| **Date Truncation** | Resets precision (e.g., first day of the month/year). | `date(col, 'start of month')` | `DATETRUNC(part, date)` (SQL 2022+) | `DATE_TRUNC('part', date)` | (Manual) `DATE_FORMAT(d, '%Y-%m-01')` | - |

### Key Syntax Differences

1.  **Format Strings (`strftime` vs `FORMAT` vs `TO_CHAR` vs `DATE_FORMAT`)**
    *   **SQLite / MySQL:** Use `%` specifiers (e.g., `%Y-%m-%d`).
    *   **PostgreSQL:** Uses patterns without `%` (e.g., `YYYY-MM-DD`).
    *   **SQL Server:**
        *   Function `FORMAT` (newer): Uses .NET standard (e.g., `yyyy-MM-dd`).
        *   Function `CONVERT` (older): Uses integer style codes (e.g., `103` for British/French dd/mm/yyyy).

2.  **Difference Calculation (`DATEDIFF`)**
    *   **SQL Server:** `DATEDIFF(day, start, end)` returns the number of "midnight boundaries" crossed.
    *   **MySQL:** `DATEDIFF(end, start)` returns the number of days (integer) strictly based on date parts.
    *   **PostgreSQL:** Subtracting dates (`date1 - date2`) returns an integer (days). Subtracting timestamps returns an `INTERVAL`.

3.  **Interval Arithmetic**
    *   **PostgreSQL** is the most flexible: `date_col + interval '3 months'`.
    *   **MySQL** uses strict syntax: `DATE_ADD(date_col, INTERVAL 3 MONTH)`.
    *   **SQL Server** uses: `DATEADD(month, 3, date_col)`.
    *   **SQLite** uses modifiers strings: `date(date_col, '+3 months')`.
