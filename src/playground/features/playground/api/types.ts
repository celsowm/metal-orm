import type { QueryResult } from '../common/IDatabaseClient';

export interface QueryExecutionResult {
  sql: string;
  results: QueryResult[];
  error: string | null;
  executionTime: number;
}

export interface ApiStatusResponse {
  ready: boolean;
  error: string | null;
}
