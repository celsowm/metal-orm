import { SQL_OPERATORS, SqlOperator } from './sql';

/**
 * Configuration for how SQL operators map to TypeScript builder helpers
 */
export interface SqlOperatorConfig {
  /**
   * SQL operator literal
   */
  sql: SqlOperator;
  /**
   * Corresponding TypeScript helper name
   */
  tsName: string;
}

/**
 * Registry of supported SQL operators and their companion helper names
 */
export const SQL_OPERATOR_REGISTRY: Record<SqlOperator, SqlOperatorConfig> = {
  [SQL_OPERATORS.EQUALS]: { sql: SQL_OPERATORS.EQUALS, tsName: 'eq' },
  [SQL_OPERATORS.NOT_EQUALS]: { sql: SQL_OPERATORS.NOT_EQUALS, tsName: 'neq' },
  [SQL_OPERATORS.GREATER_THAN]: { sql: SQL_OPERATORS.GREATER_THAN, tsName: 'gt' },
  [SQL_OPERATORS.GREATER_OR_EQUAL]: { sql: SQL_OPERATORS.GREATER_OR_EQUAL, tsName: 'gte' },
  [SQL_OPERATORS.LESS_THAN]: { sql: SQL_OPERATORS.LESS_THAN, tsName: 'lt' },
  [SQL_OPERATORS.LESS_OR_EQUAL]: { sql: SQL_OPERATORS.LESS_OR_EQUAL, tsName: 'lte' },
  [SQL_OPERATORS.LIKE]: { sql: SQL_OPERATORS.LIKE, tsName: 'like' },
  [SQL_OPERATORS.NOT_LIKE]: { sql: SQL_OPERATORS.NOT_LIKE, tsName: 'notLike' },
  [SQL_OPERATORS.IN]: { sql: SQL_OPERATORS.IN, tsName: 'inList' },
  [SQL_OPERATORS.NOT_IN]: { sql: SQL_OPERATORS.NOT_IN, tsName: 'notInList' },
  [SQL_OPERATORS.IS_NULL]: { sql: SQL_OPERATORS.IS_NULL, tsName: 'isNull' },
  [SQL_OPERATORS.IS_NOT_NULL]: { sql: SQL_OPERATORS.IS_NOT_NULL, tsName: 'isNotNull' },
  [SQL_OPERATORS.AND]: { sql: SQL_OPERATORS.AND, tsName: 'and' },
  [SQL_OPERATORS.OR]: { sql: SQL_OPERATORS.OR, tsName: 'or' },
  [SQL_OPERATORS.BETWEEN]: { sql: SQL_OPERATORS.BETWEEN, tsName: 'between' },
  [SQL_OPERATORS.NOT_BETWEEN]: { sql: SQL_OPERATORS.NOT_BETWEEN, tsName: 'notBetween' },
  [SQL_OPERATORS.EXISTS]: { sql: SQL_OPERATORS.EXISTS, tsName: 'exists' },
  [SQL_OPERATORS.NOT_EXISTS]: { sql: SQL_OPERATORS.NOT_EXISTS, tsName: 'notExists' }
};
