import { performance } from 'node:perf_hooks';
import { SelectQueryBuilder } from '../../../../builder/select';
import { Users } from '../data/schema';
import { SqliteDialect } from '../../../../dialect/sqlite';
import type { IDatabaseClient } from '../common/IDatabaseClient';
import type { QueryExecutionResult } from '../api/types';
import type { Scenario } from '../data/scenarios';

export class QueryExecutionService {
  constructor(private dbClient: IDatabaseClient) { }

  async executeScenario(scenario: Scenario): Promise<QueryExecutionResult> {
    const startTime = performance.now();

    try {
      if (!this.dbClient.isReady) {
        return {
          sql: '',
          results: [],
          error: 'Database not ready',
          executionTime: 0
        };
      }

      const queryBuilder = new SelectQueryBuilder(Users);
      const builtQuery = scenario.build(queryBuilder);

      const dialect = new SqliteDialect();
      const sql = builtQuery.toSql(dialect);

      const results = await this.dbClient.executeSql(sql);
      const executionTime = performance.now() - startTime;

      return {
        sql,
        results,
        error: this.dbClient.error,
        executionTime
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        sql: '',
        results: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime
      };
    }
  }

  isDatabaseReady(): boolean {
    return this.dbClient.isReady;
  }

  getLastError(): string | null {
    return this.dbClient.error;
  }
}
