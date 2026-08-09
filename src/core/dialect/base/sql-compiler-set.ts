import type { CompilerContext } from '../abstract.js';
import type {
  DeleteQueryNode,
  InsertQueryNode,
  SelectQueryNode,
  UpdateQueryNode
} from '../../ast/query.js';
import type { StandardSqlCompilerServices } from './standard-sql-services.js';
import type { StandardSqlSourceCompiler } from './standard-sql-source-compiler.js';

export interface SqlAstCompiler<TAst> {
  compile(ast: TAst, ctx: CompilerContext): string;
}

export interface SqlCompilerSet {
  select: SqlAstCompiler<SelectQueryNode>;
  insert: SqlAstCompiler<InsertQueryNode>;
  update: SqlAstCompiler<UpdateQueryNode>;
  delete: SqlAstCompiler<DeleteQueryNode>;
}

export interface SqlCompilerAssemblyContext {
  services: StandardSqlCompilerServices;
  sources: StandardSqlSourceCompiler;
}

/**
 * Allows a backend to replace only the standard query compilers whose SQL
 * grammar genuinely differs from the common implementation.
 */
export type SqlCompilerFactory = (
  context: SqlCompilerAssemblyContext
) => Partial<SqlCompilerSet>;
