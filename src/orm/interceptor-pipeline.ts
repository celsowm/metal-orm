import type { DbExecutor, ExecutionPayload } from '../core/execution/db-executor.js';
import { toExecutionPayload } from '../core/execution/db-executor.js';

export interface QueryContext {
  sql: string;
  params: unknown[];
  // maybe metadata like entity type, operation type, etc.
}

export type QueryInterceptor = (
  ctx: QueryContext,
  next: () => Promise<ExecutionPayload>
) => Promise<ExecutionPayload>;

/**
 * Pipeline for query interceptors.
 * Interceptors can wrap query execution to add logging, tracing, caching, etc.
 */
export class InterceptorPipeline {
  private interceptors: QueryInterceptor[] = [];

  use(interceptor: QueryInterceptor) {
    this.interceptors.push(interceptor);
  }

  async run(ctx: QueryContext, executor: DbExecutor): Promise<ExecutionPayload> {
    let i = 0;
    const dispatch = async (): Promise<ExecutionPayload> => {
      const interceptor = this.interceptors[i++];
      if (!interceptor) {
        return toExecutionPayload(await executor.executeSql(ctx.sql, ctx.params));
      }
      return toExecutionPayload(await interceptor(ctx, dispatch));
    };
    return dispatch();
  }
}
