export type QueryResult = {
  columns: string[];
  values: unknown[][];
};

export interface DbExecutor {
  executeSql(sql: string, params?: unknown[]): Promise<QueryResult[]>;
  beginTransaction?(): Promise<void>;
  commitTransaction?(): Promise<void>;
  rollbackTransaction?(): Promise<void>;
}
