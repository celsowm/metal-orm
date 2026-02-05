import type { TableSourceNode } from '../core/ast/query.js';
import type { SelectQueryState } from './select-query-state.js';
import { findJoinByRelationKey } from './join-utils.js';

/**
 * Gets the exposed name from a TableSourceNode.
 * The exposed name is the alias if present, otherwise the table/function name.
 */
export const getExposedName = (ts: TableSourceNode): string | null => {
  if (ts.type === 'Table') return ts.alias ?? ts.name;
  if (ts.type === 'DerivedTable') return ts.alias;
  if (ts.type === 'FunctionTable') return ts.alias ?? ts.name;
  return null;
};

/**
 * Collects all exposed names from the current query state (FROM + JOINs).
 * This is used to detect naming collisions when adding new joins.
 */
export const collectExposedNames = (state: SelectQueryState): Set<string> => {
  const used = new Set<string>();
  const fromName = getExposedName(state.ast.from);
  if (fromName) used.add(fromName);
  for (const j of state.ast.joins) {
    const n = getExposedName(j.table);
    if (n) used.add(n);
  }
  return used;
};

/**
 * Creates a unique alias based on a base name, avoiding collisions with already-used names.
 */
export const makeUniqueAlias = (base: string, used: Set<string>): string => {
  let alias = base;
  let i = 2;
  while (used.has(alias)) alias = `${base}_${i++}`;
  return alias;
};

/**
 * Ensures a TableSourceNode has a unique correlation name (alias) to avoid SQL Server's
 * "same exposed names" error. If the table's exposed name already exists in the query,
 * an alias is generated using the relation name.
 */
export const ensureCorrelationName = (
  state: SelectQueryState,
  relationName: string,
  ts: TableSourceNode,
  extraUsed?: Iterable<string>
): TableSourceNode => {
  if (ts.type !== 'Table') return ts;
  if (ts.alias) return ts;

  const used = collectExposedNames(state);
  for (const x of extraUsed ?? []) used.add(x);

  // Only alias if the exposed name (table name) already exists
  if (!used.has(ts.name)) return ts;

  const alias = makeUniqueAlias(relationName, used);
  return { ...ts, alias };
};

/**
 * Gets the correlation name (exposed name) for a join associated with a relation.
 */
export const getJoinCorrelationName = (
  state: SelectQueryState,
  relationName: string,
  fallback: string
): string => {
  const join = findJoinByRelationKey(state.ast.joins, relationName);
  if (!join) return fallback;
  const t = join.table;
  if (t.type === 'Table') return t.alias ?? t.name;
  if (t.type === 'DerivedTable') return t.alias;
  if (t.type === 'FunctionTable') return t.alias ?? fallback;
  return fallback;
};

/**
 * Resolves a target table name for joins, considering aliases and fallbacks.
 */
export const resolveTargetTableName = (target: TableSourceNode, fallback: string): string => {
  if (target.type === 'Table') return target.alias ?? target.name;
  if (target.type === 'DerivedTable') return target.alias;
  if (target.type === 'FunctionTable') return target.alias ?? fallback;
  return fallback;
};
