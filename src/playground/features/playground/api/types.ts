import type { QueryResult } from '../common/IDatabaseClient';

export interface QueryExecutionResult {
  sql: string;
  typescriptCode: string;
  results: QueryResult[];
  hydratedResults?: Record<string, any>[];
  error: string | null;
  executionTime: number;
}

export interface ApiStatusResponse {
  ready: boolean;
  error: string | null;
}
