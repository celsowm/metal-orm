import type {
  DeleteQueryNode,
  InsertQueryNode,
  SelectQueryNode,
  UpdateQueryNode
} from '../ast/query.js';

/** Context for SQL compilation with parameter management. */
export interface CompilerContext {
  params: unknown[];
  addParameter(value: unknown): string;
}

/** Result of SQL compilation. */
export interface CompiledQuery {
  sql: string;
  params: unknown[];
}

export interface SelectCompiler {
  compileSelect(ast: SelectQueryNode): CompiledQuery;
}

export interface InsertCompiler {
  compileInsert(ast: InsertQueryNode): CompiledQuery;
}

export interface UpdateCompiler {
  compileUpdate(ast: UpdateQueryNode): CompiledQuery;
}

export interface DeleteCompiler {
  compileDelete(ast: DeleteQueryNode): CompiledQuery;
}

/**
 * Structural contract consumed by query builders and the ORM runtime.
 *
 * A dialect is assembled from compiler components. There is intentionally no
 * base class: inheritance is not part of the extension model.
 */
export interface Dialect
  extends SelectCompiler, InsertCompiler, UpdateCompiler, DeleteCompiler {
  quoteIdentifier(id: string): string;
  supportsDmlReturningClause(): boolean;
}
