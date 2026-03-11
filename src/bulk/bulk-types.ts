import type { TableDef } from '../schema/table.js';
import type { OrmSession } from '../orm/orm-session.js';
import type { ExpressionNode } from '../core/ast/expression-nodes.js';
import type { ColumnDef } from '../schema/column-types.js';
import type { UpsertClause } from '../core/ast/query.js';
import type { ValueOperandInput } from '../core/ast/expression.js';

export type { TableDef, OrmSession };

export type BulkConcurrency = 'sequential' | number;

export interface BulkResult {
  processedRows: number;
  chunksExecuted: number;
  returning: Record<string, unknown>[];
  chunkTimings?: number[];
  metadata?: BulkResultMetadata;
}

export interface BulkResultMetadata {
  strategy: 'individual' | 'batch' | 'whereIn';
  dialect: string;
  hasReturningSupport: boolean;
}

export interface BulkBaseOptions {
  chunkSize?: number;
  concurrency?: BulkConcurrency;
  transactional?: boolean;
  timing?: boolean;
  onChunkComplete?: (info: ChunkCompleteInfo) => void | Promise<void>;
}

export interface ChunkCompleteInfo {
  chunkIndex: number;
  totalChunks: number;
  rowsInChunk: number;
  elapsedMs: number;
}

export type InsertRow = Record<string, ValueOperandInput>;

export interface BulkInsertOptions extends BulkBaseOptions {
  returning?: boolean | ColumnDef[];
  onConflict?: UpsertClause;
}

export interface BulkUpsertOptions extends BulkInsertOptions {
  conflictColumns?: string[];
  updateColumns?: string[];
}

export type UpdateRow = Record<string, ValueOperandInput>;

export interface BulkUpdateOptions extends BulkBaseOptions {
  by?: string | string[];
  where?: ExpressionNode;
  returning?: boolean | ColumnDef[];
}

export interface BulkDeleteOptions extends BulkBaseOptions {
  by?: string;
  where?: ExpressionNode;
}

export interface ChunkOutcome {
  processedRows: number;
  returning: Record<string, unknown>[];
  elapsedMs: number;
}
