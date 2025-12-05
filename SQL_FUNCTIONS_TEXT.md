| Function Name | Description | SQLite | SQL Server | PostgreSQL | MySQL |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ASCII** | Returns the numeric ASCII value of the first character. | Use `unicode()` | ✔ | ✔ (In UTF-8 returns codepoint) | ✔ `ASCII()` |
| **BIN** | Returns the binary representation (base 2) of a number. | | | | ✔ `BIN()` |
| **BIT_LENGTH** | Returns the length of a string in **bits**. | | | ✔ | ✔ `BIT_LENGTH()` |
| **BTRIM** | Removes characters from the start and end (defaults to spaces). | Use `TRIM` | | ✔ | Use `TRIM()` |
| **CASEFOLD** | Performs *case folding* for case-insensitive comparisons. | | | ✔ | Use `LOWER()` |
| **CHAR** | Returns a string from Unicode/ASCII integer codes. | ✔ | ✔ (Up to 1 char, 0–255) | Use `CHR` | ✔ `CHAR()` |
| **CHARINDEX** | Returns the position of a substring (1-indexed). | ✔ | ✔ | Use `POSITION` / `STRPOS` | Use `LOCATE()` or `INSTR()` |
| **CHAR_LENGTH** | Returns the number of characters (not bytes). | Use `LENGTH()` | Use `LEN()` | ✔ | ✔ `CHAR_LENGTH()` |
| **CHR** | Returns the character for a given code. | Use `CHAR` | Use `CHAR` or `NCHAR` | ✔ | Use `CHAR()` |
| **CONCAT** | Concatenates strings (ignores NULLs in some DBs). | ✔ (v3.35+) | ✔ (SQL 2012+) | ✔ | ✔ `CONCAT()` (Returns NULL if any arg is NULL) |
| **CONCAT_WS** | Concatenates with separator (ignores NULLs). | ✔ (v3.35+) | ✔ (SQL 2017+) | ✔ | ✔ `CONCAT_WS()` |
| **DIFFERENCE** | Returns Soundex difference (0-4). | | ✔ | | (Use `SOUNDEX` manually) |
| **ELT** | Returns the *N*-th string from a list of arguments. | | | | ✔ `ELT()` |
| **EXPORT_SET** | Returns a string representing bits of a number. | | | | ✔ `EXPORT_SET()` |
| **FIELD** | Returns the index of a string in a list. | | | | ✔ `FIELD()` |
| **FIND_IN_SET** | Returns position of a string in a comma-separated list. | | | | ✔ `FIND_IN_SET()` |
| **FORMAT** | Formats a number (e.g., with commas). | ✔ (`printf`) | ✔ (SQL 2012+) | ✔ | ✔ `FORMAT()` |
| **FROM_BASE64** | Decodes Base64 to binary. | | | Use `decode(..., 'base64')` | ✔ `FROM_BASE64()` |
| **GLOB** | Matches against Unix-style wildcards. | ✔ | | | Use `LIKE` or `REGEXP` |
| **GROUP_CONCAT** | Aggregates strings from a group into one string. | ✔ | Use `STRING_AGG` | Use `STRING_AGG` | ✔ `GROUP_CONCAT()` |
| **HEX** | Returns hexadecimal representation. | ✔ | | Use `TO_HEX` / `encode` | ✔ `HEX()` |
| **INITCAP** | Capitalizes the first letter of each word. | | | ✔ | (Custom function needed) |
| **INSERT** | Inserts/Overwrites a substring at a position. | Use `STUFF` | Use `STUFF` | Use `OVERLAY` | ✔ `INSERT()` |
| **INSTR** | Returns position of first occurrence of substring. | ✔ | Use `CHARINDEX` | Use `STRPOS` | ✔ `INSTR()` |
| **LEFT** | Extracts *N* characters from the left. | Use `SUBSTR` | ✔ | ✔ | ✔ `LEFT()` |
| **LEN** | Length of string (SQL Server ignores trailing spaces). | | ✔ | Use `LENGTH` | Use `LENGTH` (bytes) or `CHAR_LENGTH` |
| **LENGTH** | Returns length of string. | ✔ (chars) | Use `LEN` | ✔ (chars) | ✔ `LENGTH()` (Returns bytes!) |
| **LOCATE** | Synonym for INSTR (MySQL specific syntax). | | | | ✔ `LOCATE()` |
| **LOWER** | Converts to lowercase. | ✔ (ASCII only) | ✔ | ✔ | ✔ `LOWER()` |
| **LPAD** | Pads string on the left. | | | ✔ | ✔ `LPAD()` |
| **LTRIM** | Trims from the left. | ✔ | ✔ | ✔ | ✔ `LTRIM()` |
| **MAKE_SET** | Returns set values based on bits. | | | | ✔ `MAKE_SET()` |
| **MD5** | Returns MD5 hash. | (extension) | Use `HASHBYTES` | ✔ | ✔ `MD5()` |
| **NORMALIZE** | Unicode normalization. | | | ✔ | (Not native) |
| **OCT** | Returns octal representation. | | | Use `TO_OCT` | ✔ `OCT()` |
| **OCTET_LENGTH** | Returns length in bytes. | ✔ | Use `DATALENGTH` | ✔ | ✔ `OCTET_LENGTH()` |
| **ORD** | Returns numeric code of first character (multibyte safe). | Equiv `ASCII` | | | ✔ `ORD()` |
| **OVERLAY** | Replaces part of a string. | | Use `STUFF` | ✔ | Use `INSERT()` |
| **PARSE_IDENT** | Splits qualified identifier. | | | ✔ | (Not native) |
| **PATINDEX** | Returns position of pattern. | | ✔ | | Use `REGEXP_INSTR` (v8.0+) |
| **POSITION** | Returns position of substring (Standard SQL). | ✔ | | ✔ | ✔ `POSITION()` |
| **QUOTE** | Escapes string for SQL literal. | ✔ | Use `QUOTENAME` | Use `quote_literal` | ✔ `QUOTE()` |
| **QUOTE_IDENT** | Escapes string for identifier. | | Use `QUOTENAME` | ✔ | Use backticks \` |
| **QUOTE_LITERAL** | Escapes string for literal. | ✔ | | ✔ | Use `QUOTE()` |
| **QUOTENAME** | Adds delimiters (brackets/quotes). | | ✔ | Use `quote_ident` | (Not native) |
| **REGEXP_COUNT** | Count regex matches. | | | ✔ (PG 15+) | (Use custom logic) |
| **REGEXP_INSTR** | Position of regex match. | | | ✔ (PG 15+) | ✔ `REGEXP_INSTR()` (v8.0+) |
| **REGEXP_LIKE** | Boolean regex match check. | | | ✔ (PG 15+) | ✔ `REGEXP_LIKE()` (v8.0+) |
| **REGEXP_MATCH** | Returns captured substrings. | | | ✔ | Use `REGEXP_SUBSTR()` |
| **REGEXP_MATCHES**| Returns all regex matches. | | | ✔ | (Not native) |
| **REGEXP_REPLACE**| Replaces regex matches. | ✔ | | ✔ | ✔ `REGEXP_REPLACE()` (v8.0+) |
| **REGEXP_SUBSTR** | Extracts matching substring. | | | ✔ (PG 15+) | ✔ `REGEXP_SUBSTR()` (v8.0+) |
| **REPEAT** | Repeats string *N* times. | | Use `REPLICATE` | ✔ | ✔ `REPEAT()` |
| **REPLACE** | Replaces occurrences of a substring. | ✔ | ✔ | ✔ | ✔ `REPLACE()` |
| **REPLICATE** | Repeats string (SQL Server). | ✔ | ✔ | | Use `REPEAT()` |
| **REVERSE** | Reverses the string. | | ✔ | ✔ | ✔ `REVERSE()` |
| **RIGHT** | Extracts *N* characters from the right. | Use `SUBSTR` | ✔ | ✔ | ✔ `RIGHT()` |
| **RPAD** | Pads string on the right. | | | ✔ | ✔ `RPAD()` |
| **RTRIM** | Trims from the right. | ✔ | ✔ | ✔ | ✔ `RTRIM()` |
| **SOUNDEX** | Returns Soundex code. | ✔ (If enabled) | ✔ | (via extension) | ✔ `SOUNDEX()` |
| **SPACE** | Returns string of *N* spaces. | `repeat(' ', N)` | ✔ | `repeat(' ', N)` | ✔ `SPACE()` |
| **SPLIT_PART** | Splits string by delimiter and picks *N*-th part. | | | ✔ | Use `SUBSTRING_INDEX()` |
| **STARTS_WITH** | Checks prefix. | | | ✔ | Use `LIKE 'str%'` |
| **STR** | Converts number to string. | | ✔ | | Use `FORMAT` or `CAST` |
| **STRCMP** | Compares two strings (-1, 0, 1). | | | | ✔ `STRCMP()` |
| **STRPOS** | Returns position of substring. | | | ✔ | Use `LOCATE()` / `INSTR()` |
| **STUFF** | Inserts/Deletes into string (SQL Server). | | ✔ | | Use `INSERT()` |
| **SUBSTR** | Extracts substring. | ✔ | ✔ | ✔ | ✔ `SUBSTR()` |
| **SUBSTRING_INDEX**| Returns substring before *N*-th delimiter. | | | | ✔ `SUBSTRING_INDEX()` |
| **TO_ASCII** | Converts to ASCII. | | | ✔ | (Not native) |
| **TO_BASE64** | Encodes to Base64. | | | Use `encode` | ✔ `TO_BASE64()` |
| **TO_BIN** | Returns binary string. | | | ✔ | Use `BIN()` |
| **TO_HEX** | Returns hex string. | | | ✔ | Use `HEX()` |
| **TO_OCT** | Returns octal string. | | | ✔ | Use `OCT()` |
| **TRANSLATE** | Character-wise replacement. | | ✔ (SQL 2017+) | ✔ | Use chained `REPLACE()` |
| **TRIM** | Trims whitespace/characters. | ✔ | ✔ (SQL 2017+) | ✔ | ✔ `TRIM()` |
| **UNHEX** | Decodes hex to binary. | ✔ | | `decode(..,'hex')`| ✔ `UNHEX()` |
| **UNICODE** | Returns code of first char. | ✔ | ✔ | Use `ASCII` | Use `ORD()` |
| **UNISTR** | Interprets Unicode escapes (`\uXXXX`). | ✔ (v3.50+) | ✔ (SQL 2025+) | ✔ | (Not native) |
| **UPPER** | Converts to uppercase. | ✔ (ASCII only) | ✔ | ✔ | ✔ `UPPER()` |