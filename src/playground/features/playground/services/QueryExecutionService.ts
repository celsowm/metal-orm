import { performance } from 'node:perf_hooks';
import { SelectQueryBuilder } from '../../../../builder/select';
import { Users } from '../data/schema';
import { SqliteDialect } from '../../../../dialect/sqlite';
import { hydrateRows } from '../../../../runtime/hydration';
import type { IDatabaseClient } from '../common/IDatabaseClient';
import type { QueryExecutionResult } from '../api/types';
import type { Scenario } from '../data/scenarios';
import type { TableDef } from '../../../../schema/table';

/**
 * Extracts the TypeScript code from a build function
 */
function extractTypeScriptCode<TTable extends TableDef>(buildFn: (builder: SelectQueryBuilder<any, TTable>) => SelectQueryBuilder<any, TTable>): string {
    const fnString = buildFn.toString();

    // Remove the function wrapper and return statement
    const bodyMatch = fnString.match(/=>\s*\{?\s*(.*?)\s*\}?$/s);
    if (bodyMatch) {
        let code = bodyMatch[1].trim();

        // Remove trailing semicolon if present
        code = code.replace(/;$/, '');

        // Clean up indentation (remove common leading spaces)
        const lines = code.split('\n');
        if (lines.length > 1) {
            // Find the minimum indentation of non-empty lines
            const nonEmptyLines = lines.filter(line => line.trim().length > 0);
            const minIndent = Math.min(...nonEmptyLines.map(line => {
                const match = line.match(/^(\s*)/);
                return match ? match[1].length : 0;
            }));

            // Remove the common indentation
            code = lines.map(line => line.slice(minIndent)).join('\n').trim();
        }

        return code;
    }

    return fnString;
}

export class QueryExecutionService {
  constructor(private dbClient: IDatabaseClient) { }

  async executeScenario(scenario: Scenario): Promise<QueryExecutionResult> {
    const startTime = performance.now();

    try {
      if (!this.dbClient.isReady) {
        return {
          sql: '',
          params: [],
          typescriptCode: scenario.typescriptCode || extractTypeScriptCode(scenario.build),
          results: [],
          error: 'Database not ready',
          executionTime: 0
        };
      }

      const queryBuilder = new SelectQueryBuilder(Users);
      const builtQuery = scenario.build(queryBuilder);

      const dialect = new SqliteDialect();
      const compiled = builtQuery.compile(dialect);

      const results = await this.dbClient.executeSql(compiled.sql, compiled.params);
      const executionTime = performance.now() - startTime;

      // Check if hydration is needed
      const hydrationPlan = builtQuery.getHydrationPlan();
      let hydratedResults: Record<string, any>[] | undefined;

      if (hydrationPlan && results.length > 0) {
        // Convert QueryResult[] to Record<string, any>[] for hydration
        const rows: Record<string, any>[] = [];
        const { columns, values } = results[0];

        for (const row of values) {
          const obj: Record<string, any> = {};
          columns.forEach((col, idx) => {
            obj[col] = row[idx];
          });
          rows.push(obj);
        }

        hydratedResults = hydrateRows(rows, hydrationPlan);
      }

      return {
        sql: compiled.sql,
        params: compiled.params,
        typescriptCode: scenario.typescriptCode || extractTypeScriptCode(scenario.build),
        results,
        hydratedResults,
        error: this.dbClient.error,
        executionTime
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        sql: '',
        params: [],
        typescriptCode: scenario.typescriptCode || extractTypeScriptCode(scenario.build),
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
