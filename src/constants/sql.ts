/**
 * SQL keywords used in query generation
 */
export const SQL_KEYWORDS = {
  /** SELECT clause keyword */
  SELECT: 'SELECT',
  /** FROM clause keyword */
  FROM: 'FROM',
  /** WHERE clause keyword */
  WHERE: 'WHERE',
  /** JOIN keyword */
  JOIN: 'JOIN',
  /** INNER JOIN keyword */
  INNER_JOIN: 'INNER JOIN',
  /** LEFT JOIN keyword */
  LEFT_JOIN: 'LEFT JOIN',
  /** RIGHT JOIN keyword */
  RIGHT_JOIN: 'RIGHT JOIN',
  /** ORDER BY clause keyword */
  ORDER_BY: 'ORDER BY',
  /** GROUP BY clause keyword */
  GROUP_BY: 'GROUP BY',
  /** HAVING clause keyword */
  HAVING: 'HAVING',
  /** DISTINCT keyword */
  DISTINCT: 'DISTINCT',
  /** EXISTS operator */
  EXISTS: 'EXISTS',
  /** NOT EXISTS operator */
  NOT_EXISTS: 'NOT EXISTS'
} as const;

/**
 * SQL operators used in query conditions
 */
export const SQL_OPERATORS = {
  /** Equality operator */
  EQUALS: '=',
  /** Greater than operator */
  GREATER_THAN: '>',
  /** Less than operator */
  LESS_THAN: '<',
  /** LIKE pattern matching operator */
  LIKE: 'LIKE',
  /** NOT LIKE pattern matching operator */
  NOT_LIKE: 'NOT LIKE',
  /** IN membership operator */
  IN: 'IN',
  /** NOT IN membership operator */
  NOT_IN: 'NOT IN',
  /** BETWEEN range operator */
  BETWEEN: 'BETWEEN',
  /** NOT BETWEEN range operator */
  NOT_BETWEEN: 'NOT BETWEEN',
  /** IS NULL null check operator */
  IS_NULL: 'IS NULL',
  /** IS NOT NULL null check operator */
  IS_NOT_NULL: 'IS NOT NULL',
  /** Logical AND operator */
  AND: 'AND',
  /** Logical OR operator */
  OR: 'OR',
  /** EXISTS operator */
  EXISTS: 'EXISTS',
  /** NOT EXISTS operator */
  NOT_EXISTS: 'NOT EXISTS'
} as const;

/**
 * Type representing any supported SQL operator
 */
export type SqlOperator = (typeof SQL_OPERATORS)[keyof typeof SQL_OPERATORS];

/**
 * Types of SQL joins supported
 */
export const JOIN_KINDS = {
  /** INNER JOIN type */
  INNER: 'INNER',
  /** LEFT JOIN type */
  LEFT: 'LEFT',
  /** RIGHT JOIN type */
  RIGHT: 'RIGHT',
  /** CROSS JOIN type */
  CROSS: 'CROSS'
} as const;

/**
 * Type representing any supported join kind
 */
export type JoinKind = (typeof JOIN_KINDS)[keyof typeof JOIN_KINDS];

/**
 * Ordering directions for result sorting
 */
export const ORDER_DIRECTIONS = {
  /** Ascending order */
  ASC: 'ASC',
  /** Descending order */
  DESC: 'DESC'
} as const;

/**
 * Type representing any supported order direction
 */
export type OrderDirection = (typeof ORDER_DIRECTIONS)[keyof typeof ORDER_DIRECTIONS];

/**
 * Supported database dialects
 */
export const SUPPORTED_DIALECTS = {
  /** MySQL database dialect */
  MYSQL: 'mysql',
  /** SQLite database dialect */
  SQLITE: 'sqlite',
  /** Microsoft SQL Server dialect */
  MSSQL: 'mssql',
  /** PostgreSQL database dialect */
  POSTGRES: 'postgres'
} as const;

/**
 * Type representing any supported database dialect
 */
export type DialectName = (typeof SUPPORTED_DIALECTS)[keyof typeof SUPPORTED_DIALECTS];
