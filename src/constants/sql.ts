export const SQL_KEYWORDS = {
  SELECT: 'SELECT',
  FROM: 'FROM',
  WHERE: 'WHERE',
  JOIN: 'JOIN',
  INNER_JOIN: 'INNER JOIN',
  LEFT_JOIN: 'LEFT JOIN',
  RIGHT_JOIN: 'RIGHT JOIN',
  ORDER_BY: 'ORDER BY',
  GROUP_BY: 'GROUP BY',
  HAVING: 'HAVING',
  DISTINCT: 'DISTINCT',
  EXISTS: 'EXISTS',
  NOT_EXISTS: 'NOT EXISTS'
} as const;

export const SQL_OPERATORS = {
  EQUALS: '=',
  GREATER_THAN: '>',
  LESS_THAN: '<',
  LIKE: 'LIKE',
  NOT_LIKE: 'NOT LIKE',
  IN: 'IN',
  NOT_IN: 'NOT IN',
  BETWEEN: 'BETWEEN',
  NOT_BETWEEN: 'NOT BETWEEN',
  IS_NULL: 'IS NULL',
  IS_NOT_NULL: 'IS NOT NULL',
  AND: 'AND',
  OR: 'OR'
} as const;

export type SqlOperator = (typeof SQL_OPERATORS)[keyof typeof SQL_OPERATORS];

export const JOIN_KINDS = {
  INNER: 'INNER',
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
  CROSS: 'CROSS'
} as const;

export type JoinKind = (typeof JOIN_KINDS)[keyof typeof JOIN_KINDS];

export const ORDER_DIRECTIONS = {
  ASC: 'ASC',
  DESC: 'DESC'
} as const;

export type OrderDirection = (typeof ORDER_DIRECTIONS)[keyof typeof ORDER_DIRECTIONS];

export const SUPPORTED_DIALECTS = {
  MYSQL: 'mysql',
  SQLITE: 'sqlite',
  MSSQL: 'mssql'
} as const;

export type DialectName = (typeof SUPPORTED_DIALECTS)[keyof typeof SUPPORTED_DIALECTS];
