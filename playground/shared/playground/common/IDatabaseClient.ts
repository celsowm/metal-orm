export type QueryResult = {
  columns: string[];
  values: any[][];
};

export interface IDatabaseClient {
  isReady: boolean;
  error: string | null;
  executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]>;
}
