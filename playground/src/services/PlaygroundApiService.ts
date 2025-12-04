import type { ApiStatusResponse, QueryExecutionResult } from '../shared/playground/api/types.js';

const DEFAULT_API_BASE = '/api/playground';

export class PlaygroundApiService {
  constructor(private basePath: string = DEFAULT_API_BASE) {}

  async getStatus(): Promise<ApiStatusResponse> {
    try {
      const response = await fetch(`${this.basePath}/status`);
      if (!response.ok) {
        const message = await response.text();
        return {
          ready: false,
          error: message || 'Unable to reach the playground API',
        };
      }

      return (await response.json()) as ApiStatusResponse;
    } catch (error) {
      return {
        ready: false,
        error: error instanceof Error ? error.message : 'Unknown network error',
      };
    }
  }

  async executeScenario(scenarioId: string): Promise<QueryExecutionResult> {
    try {
      const response = await fetch(`${this.basePath}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioId }),
      });

      if (!response.ok) {
        const message = await response.text();
        return {
          sql: '',
          params: [],
          typescriptCode: '',
          results: [],
          error: message || 'Unable to execute scenario',
          executionTime: 0,
        };
      }

      return (await response.json()) as QueryExecutionResult;
    } catch (error) {
      return {
        sql: '',
        params: [],
        typescriptCode: '',
        results: [],
        error: error instanceof Error ? error.message : 'Unknown network error',
        executionTime: 0,
      };
    }
  }
}
