import type { DbExecutor, QueryResult } from '../core/execution/db-executor.js';

export interface QueryContext {
  sql: string;
  params: unknown[];
  // maybe metadata like entity type, operation type, etc.
}

export type QueryInterceptor = (ctx: QueryContext, next: () => Promise<QueryResult[]>) => Promise<QueryResult[]>;

export class InterceptorPipeline {
  private interceptors: QueryInterceptor[] = [];

  use(interceptor: QueryInterceptor) {
    this.interceptors.push(interceptor);
  }

  async run(ctx: QueryContext, executor: DbExecutor): Promise<QueryResult[]> {
    let i = 0;
    const dispatch = async (): Promise<QueryResult[]> => {
      const interceptor = this.interceptors[i++];
      if (!interceptor) {
        return executor.executeSql(ctx.sql, ctx.params);
      }
      return interceptor(ctx, dispatch);
    };
    return dispatch();
  }
}
