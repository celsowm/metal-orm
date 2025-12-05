| Function Name | Description | SQLite | SQL Server | PostgreSQL | MySQL | MO (metal-orm) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ASCII** | Returns the numeric ASCII value of the first character. | Use `unicode()` | ✔ | ✔ (In UTF-8 returns codepoint) | ✔ `ASCII()` | Emit via Metal-orm (selectRaw('ASCII(...)') or a FunctionNode). |
| **BIN** | Returns the binary representation (base 2) of a number. | | | | ✔ `BIN()` | Emit via Metal-orm (selectRaw('BIN(...)') or a FunctionNode). |
| **BIT_LENGTH** | Returns the length of a string in **bits**. | | | ✔ | ✔ `BIT_LENGTH()` | Emit via Metal-orm (selectRaw('BIT_LENGTH(...)') or a FunctionNode). |
| **BTRIM** | Removes characters from the start and end (defaults to spaces). | Use `TRIM` | | ✔ | Use `TRIM()` | Emit via Metal-orm (selectRaw('BTRIM(...)') or a FunctionNode). |
| **CASEFOLD** | Performs *case folding* for case-insensitive comparisons. | | | ✔ | Use `LOWER()` | Emit via Metal-orm (selectRaw('CASEFOLD(...)') or a FunctionNode). |
| **CHAR** | Returns a string from Unicode/ASCII integer codes. | ✔ | ✔ (Up to 1 char, 0–255) | Use `CHR` | ✔ `CHAR()` | Emit via Metal-orm (selectRaw('CHAR(...)') or a FunctionNode). |
| **CHARINDEX** | Returns the position of a substring (1-indexed). | ✔ | ✔ | Use `POSITION` / `STRPOS` | Use `LOCATE()` or `INSTR()` | Emit via Metal-orm (selectRaw('CHARINDEX(...)') or a FunctionNode). |
| **CHAR_LENGTH** | Returns the number of characters (not bytes). | Use `LENGTH()` | Use `LEN()` | ✔ | ✔ `CHAR_LENGTH()` | Emit via Metal-orm (selectRaw('CHAR_LENGTH(...)') or a FunctionNode). |
| **CHR** | Returns the character for a given code. | Use `CHAR` | Use `CHAR` or `NCHAR` | ✔ | Use `CHAR()` | Emit via Metal-orm (selectRaw('CHR(...)') or a FunctionNode). |
| **CONCAT** | Concatenates strings (ignores NULLs in some DBs). | ✔ (v3.35+) | ✔ (SQL 2012+) | ✔ | ✔ `CONCAT()` (Returns NULL if any arg is NULL) | Emit via Metal-orm (selectRaw('CONCAT(...)') or a FunctionNode). |
| **CONCAT_WS** | Concatenates with separator (ignores NULLs). | ✔ (v3.35+) | ✔ (SQL 2017+) | ✔ | ✔ `CONCAT_WS()` | Emit via Metal-orm (selectRaw('CONCAT_WS(...)') or a FunctionNode). |
| **DIFFERENCE** | Returns Soundex difference (0-4). | | ✔ | | (Use `SOUNDEX` manually) | Emit via Metal-orm (selectRaw('DIFFERENCE(...)') or a FunctionNode). |
| **ELT** | Returns the *N*-th string from a list of arguments. | | | | ✔ `ELT()` | Emit via Metal-orm (selectRaw('ELT(...)') or a FunctionNode). |
| **EXPORT_SET** | Returns a string representing bits of a number. | | | | ✔ `EXPORT_SET()` | Emit via Metal-orm (selectRaw('EXPORT_SET(...)') or a FunctionNode). |
| **FIELD** | Returns the index of a string in a list. | | | | ✔ `FIELD()` | Emit via Metal-orm (selectRaw('FIELD(...)') or a FunctionNode). |
| **FIND_IN_SET** | Returns position of a string in a comma-separated list. | | | | ✔ `FIND_IN_SET()` | Emit via Metal-orm (selectRaw('FIND_IN_SET(...)') or a FunctionNode). |
| **FORMAT** | Formats a number (e.g., with commas). | ✔ (`printf`) | ✔ (SQL 2012+) | ✔ | ✔ `FORMAT()` | Emit via Metal-orm (selectRaw('FORMAT(...)') or a FunctionNode). |
| **FROM_BASE64** | Decodes Base64 to binary. | | | Use `decode(..., 'base64')` | ✔ `FROM_BASE64()` | Emit via Metal-orm (selectRaw('FROM_BASE64(...)') or a FunctionNode). |
| **GLOB** | Matches against Unix-style wildcards. | ✔ | | | Use `LIKE` or `REGEXP` | Emit via Metal-orm (selectRaw('GLOB(...)') or a FunctionNode). |
| **GROUP_CONCAT** | Aggregates strings from a group into one string. | ✔ | Use `STRING_AGG` | Use `STRING_AGG` | ✔ `GROUP_CONCAT()` | Emit via Metal-orm (selectRaw('GROUP_CONCAT(...)') or a FunctionNode). |
| **HEX** | Returns hexadecimal representation. | ✔ | | Use `TO_HEX` / `encode` | ✔ `HEX()` | Emit via Metal-orm (selectRaw('HEX(...)') or a FunctionNode). |
| **INITCAP** | Capitalizes the first letter of each word. | | | ✔ | (Custom function needed) | Emit via Metal-orm (selectRaw('INITCAP(...)') or a FunctionNode). |
| **INSERT** | Inserts/Overwrites a substring at a position. | Use `STUFF` | Use `STUFF` | Use `OVERLAY` | ✔ `INSERT()` | Emit via Metal-orm (selectRaw('INSERT(...)') or a FunctionNode). |
| **INSTR** | Returns position of first occurrence of substring. | ✔ | Use `CHARINDEX` | Use `STRPOS` | ✔ `INSTR()` | Emit via Metal-orm (selectRaw('INSTR(...)') or a FunctionNode). |
| **LEFT** | Extracts *N* characters from the left. | Use `SUBSTR` | ✔ | ✔ | ✔ `LEFT()` | Emit via Metal-orm (selectRaw('LEFT(...)') or a FunctionNode). |
| **LEN** | Length of string (SQL Server ignores trailing spaces). | | ✔ | Use `LENGTH` | Use `LENGTH` (bytes) or `CHAR_LENGTH` | Emit via Metal-orm (selectRaw('LEN(...)') or a FunctionNode). |
| **LENGTH** | Returns length of string. | ✔ (chars) | Use `LEN` | ✔ (chars) | ✔ `LENGTH()` (Returns bytes!) | Emit via Metal-orm (selectRaw('LENGTH(...)') or a FunctionNode). |
| **LOCATE** | Synonym for INSTR (MySQL specific syntax). | | | | ✔ `LOCATE()` | Emit via Metal-orm (selectRaw('LOCATE(...)') or a FunctionNode). |
| **LOWER** | Converts to lowercase. | ✔ (ASCII only) | ✔ | ✔ | ✔ `LOWER()` | Emit via Metal-orm (selectRaw('LOWER(...)') or a FunctionNode). |
| **LPAD** | Pads string on the left. | | | ✔ | ✔ `LPAD()` | Emit via Metal-orm (selectRaw('LPAD(...)') or a FunctionNode). |
| **LTRIM** | Trims from the left. | ✔ | ✔ | ✔ | ✔ `LTRIM()` | Emit via Metal-orm (selectRaw('LTRIM(...)') or a FunctionNode). |
| **MAKE_SET** | Returns set values based on bits. | | | | ✔ `MAKE_SET()` | Emit via Metal-orm (selectRaw('MAKE_SET(...)') or a FunctionNode). |
| **MD5** | Returns MD5 hash. | (extension) | Use `HASHBYTES` | ✔ | ✔ `MD5()` | Emit via Metal-orm (selectRaw('MD5(...)') or a FunctionNode). |
| **NORMALIZE** | Unicode normalization. | | | ✔ | (Not native) | Emit via Metal-orm (selectRaw('NORMALIZE(...)') or a FunctionNode). |
| **OCT** | Returns octal representation. | | | Use `TO_OCT` | ✔ `OCT()` | Emit via Metal-orm (selectRaw('OCT(...)') or a FunctionNode). |
| **OCTET_LENGTH** | Returns length in bytes. | ✔ | Use `DATALENGTH` | ✔ | ✔ `OCTET_LENGTH()` | Emit via Metal-orm (selectRaw('OCTET_LENGTH(...)') or a FunctionNode). |
| **ORD** | Returns numeric code of first character (multibyte safe). | Equiv `ASCII` | | | ✔ `ORD()` | Emit via Metal-orm (selectRaw('ORD(...)') or a FunctionNode). |
| **OVERLAY** | Replaces part of a string. | | Use `STUFF` | ✔ | Use `INSERT()` | Emit via Metal-orm (selectRaw('OVERLAY(...)') or a FunctionNode). |
| **PARSE_IDENT** | Splits qualified identifier. | | | ✔ | (Not native) | Emit via Metal-orm (selectRaw('PARSE_IDENT(...)') or a FunctionNode). |
| **PATINDEX** | Returns position of pattern. | | ✔ | | Use `REGEXP_INSTR` (v8.0+) | Emit via Metal-orm (selectRaw('PATINDEX(...)') or a FunctionNode). |
| **POSITION** | Returns position of substring (Standard SQL). | ✔ | | ✔ | ✔ `POSITION()` | Emit via Metal-orm (selectRaw('POSITION(...)') or a FunctionNode). |
| **QUOTE** | Escapes string for SQL literal. | ✔ | Use `QUOTENAME` | Use `quote_literal` | ✔ `QUOTE()` | Emit via Metal-orm (selectRaw('QUOTE(...)') or a FunctionNode). |
| **QUOTE_IDENT** | Escapes string for identifier. | | Use `QUOTENAME` | ✔ | Use backticks \` | Emit via Metal-orm (selectRaw('QUOTE_IDENT(...)') or a FunctionNode). |
| **QUOTE_LITERAL** | Escapes string for literal. | ✔ | | ✔ | Use `QUOTE()` | Emit via Metal-orm (selectRaw('QUOTE_LITERAL(...)') or a FunctionNode). |
| **QUOTENAME** | Adds delimiters (brackets/quotes). | | ✔ | Use `quote_ident` | (Not native) | Emit via Metal-orm (selectRaw('QUOTENAME(...)') or a FunctionNode). |
| **REGEXP_COUNT** | Count regex matches. | | | ✔ (PG 15+) | (Use custom logic) | Emit via Metal-orm (selectRaw('REGEXP_COUNT(...)') or a FunctionNode). |
| **REGEXP_INSTR** | Position of regex match. | | | ✔ (PG 15+) | ✔ `REGEXP_INSTR()` (v8.0+) | Emit via Metal-orm (selectRaw('REGEXP_INSTR(...)') or a FunctionNode). |
| **REGEXP_LIKE** | Boolean regex match check. | | | ✔ (PG 15+) | ✔ `REGEXP_LIKE()` (v8.0+) | Emit via Metal-orm (selectRaw('REGEXP_LIKE(...)') or a FunctionNode). |
| **REGEXP_MATCH** | Returns captured substrings. | | | ✔ | Use `REGEXP_SUBSTR()` | Emit via Metal-orm (selectRaw('REGEXP_MATCH(...)') or a FunctionNode). |
| **REGEXP_MATCHES**| Returns all regex matches. | | | ✔ | (Not native) | Emit via Metal-orm (selectRaw('REGEXP_MATCHES(...)') or a FunctionNode). |
| **REGEXP_REPLACE**| Replaces regex matches. | ✔ | | ✔ | ✔ `REGEXP_REPLACE()` (v8.0+) | Emit via Metal-orm (selectRaw('REGEXP_REPLACE(...)') or a FunctionNode). |
| **REGEXP_SUBSTR** | Extracts matching substring. | | | ✔ (PG 15+) | ✔ `REGEXP_SUBSTR()` (v8.0+) | Emit via Metal-orm (selectRaw('REGEXP_SUBSTR(...)') or a FunctionNode). |
| **REPEAT** | Repeats string *N* times. | | Use `REPLICATE` | ✔ | ✔ `REPEAT()` | Emit via Metal-orm (selectRaw('REPEAT(...)') or a FunctionNode). |
| **REPLACE** | Replaces occurrences of a substring. | ✔ | ✔ | ✔ | ✔ `REPLACE()` | Emit via Metal-orm (selectRaw('REPLACE(...)') or a FunctionNode). |
| **REPLICATE** | Repeats string (SQL Server). | ✔ | ✔ | | Use `REPEAT()` | Emit via Metal-orm (selectRaw('REPLICATE(...)') or a FunctionNode). |
| **REVERSE** | Reverses the string. | | ✔ | ✔ | ✔ `REVERSE()` | Emit via Metal-orm (selectRaw('REVERSE(...)') or a FunctionNode). |
| **RIGHT** | Extracts *N* characters from the right. | Use `SUBSTR` | ✔ | ✔ | ✔ `RIGHT()` | Emit via Metal-orm (selectRaw('RIGHT(...)') or a FunctionNode). |
| **RPAD** | Pads string on the right. | | | ✔ | ✔ `RPAD()` | Emit via Metal-orm (selectRaw('RPAD(...)') or a FunctionNode). |
| **RTRIM** | Trims from the right. | ✔ | ✔ | ✔ | ✔ `RTRIM()` | Emit via Metal-orm (selectRaw('RTRIM(...)') or a FunctionNode). |
| **SOUNDEX** | Returns Soundex code. | ✔ (If enabled) | ✔ | (via extension) | ✔ `SOUNDEX()` | Emit via Metal-orm (selectRaw('SOUNDEX(...)') or a FunctionNode). |
| **SPACE** | Returns string of *N* spaces. | `repeat(' ', N)` | ✔ | `repeat(' ', N)` | ✔ `SPACE()` | Emit via Metal-orm (selectRaw('SPACE(...)') or a FunctionNode). |
| **SPLIT_PART** | Splits string by delimiter and picks *N*-th part. | | | ✔ | Use `SUBSTRING_INDEX()` | Emit via Metal-orm (selectRaw('SPLIT_PART(...)') or a FunctionNode). |
| **STARTS_WITH** | Checks prefix. | | | ✔ | Use `LIKE 'str%'` | Emit via Metal-orm (selectRaw('STARTS_WITH(...)') or a FunctionNode). |
| **STR** | Converts number to string. | | ✔ | | Use `FORMAT` or `CAST` | Emit via Metal-orm (selectRaw('STR(...)') or a FunctionNode). |
| **STRCMP** | Compares two strings (-1, 0, 1). | | | | ✔ `STRCMP()` | Emit via Metal-orm (selectRaw('STRCMP(...)') or a FunctionNode). |
| **STRPOS** | Returns position of substring. | | | ✔ | Use `LOCATE()` / `INSTR()` | Emit via Metal-orm (selectRaw('STRPOS(...)') or a FunctionNode). |
| **STUFF** | Inserts/Deletes into string (SQL Server). | | ✔ | | Use `INSERT()` | Emit via Metal-orm (selectRaw('STUFF(...)') or a FunctionNode). |
| **SUBSTR** | Extracts substring. | ✔ | ✔ | ✔ | ✔ `SUBSTR()` | Emit via Metal-orm (selectRaw('SUBSTR(...)') or a FunctionNode). |
| **SUBSTRING_INDEX**| Returns substring before *N*-th delimiter. | | | | ✔ `SUBSTRING_INDEX()` | Emit via Metal-orm (selectRaw('SUBSTRING_INDEX(...)') or a FunctionNode). |
| **TO_ASCII** | Converts to ASCII. | | | ✔ | (Not native) | Emit via Metal-orm (selectRaw('TO_ASCII(...)') or a FunctionNode). |
| **TO_BASE64** | Encodes to Base64. | | | Use `encode` | ✔ `TO_BASE64()` | Emit via Metal-orm (selectRaw('TO_BASE64(...)') or a FunctionNode). |
| **TO_BIN** | Returns binary string. | | | ✔ | Use `BIN()` | Emit via Metal-orm (selectRaw('TO_BIN(...)') or a FunctionNode). |
| **TO_HEX** | Returns hex string. | | | ✔ | Use `HEX()` | Emit via Metal-orm (selectRaw('TO_HEX(...)') or a FunctionNode). |
| **TO_OCT** | Returns octal string. | | | ✔ | Use `OCT()` | Emit via Metal-orm (selectRaw('TO_OCT(...)') or a FunctionNode). |
| **TRANSLATE** | Character-wise replacement. | | ✔ (SQL 2017+) | ✔ | Use chained `REPLACE()` | Emit via Metal-orm (selectRaw('TRANSLATE(...)') or a FunctionNode). |
| **TRIM** | Trims whitespace/characters. | ✔ | ✔ (SQL 2017+) | ✔ | ✔ `TRIM()` | Emit via Metal-orm (selectRaw('TRIM(...)') or a FunctionNode). |
| **UNHEX** | Decodes hex to binary. | ✔ | | `decode(..,'hex')`| ✔ `UNHEX()` | Emit via Metal-orm (selectRaw('UNHEX(...)') or a FunctionNode). |
| **UNICODE** | Returns code of first char. | ✔ | ✔ | Use `ASCII` | Use `ORD()` | Emit via Metal-orm (selectRaw('UNICODE(...)') or a FunctionNode). |
| **UNISTR** | Interprets Unicode escapes (`\uXXXX`). | ✔ (v3.50+) | ✔ (SQL 2025+) | ✔ | (Not native) | Emit via Metal-orm (selectRaw('UNISTR(...)') or a FunctionNode). |
| **UPPER** | Converts to uppercase. | ✔ (ASCII only) | ✔ | ✔ | ✔ `UPPER()` | Emit via Metal-orm (selectRaw('UPPER(...)') or a FunctionNode). |
