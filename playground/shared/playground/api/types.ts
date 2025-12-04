import type { QueryResult } from '../common/IDatabaseClient.js';

export interface QueryExecutionResult {
  sql: string;
  params: unknown[];
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
