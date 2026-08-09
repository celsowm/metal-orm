import type { SqlCompilerFactory } from '../base/sql-compiler-set.js';
import { MssqlDeleteCompiler } from './delete-compiler.js';
import { MssqlInsertCompiler } from './insert-compiler.js';
import { MssqlSelectCompiler } from './select-compiler.js';
import { MssqlUpdateCompiler } from './update-compiler.js';

export const createMssqlCompilerSet: SqlCompilerFactory = ({ services, sources }) => ({
  select: new MssqlSelectCompiler(services, sources),
  insert: new MssqlInsertCompiler(services, sources),
  update: new MssqlUpdateCompiler(services, sources),
  delete: new MssqlDeleteCompiler(services, sources)
});
