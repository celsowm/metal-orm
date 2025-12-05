import { HydrationPlan, HydrationRelationPlan } from '../core/ast/query.js';
import { RelationKinds } from '../schema/relation.js';
import { isRelationAlias, makeRelationAlias } from '../query-builder/relation-alias.js';

/**
 * Hydrates query results according to a hydration plan
 * @param rows - Raw database rows
 * @param plan - Hydration plan
 * @returns Hydrated result objects with nested relations
 */
export const hydrateRows = (rows: Record<string, any>[], plan?: HydrationPlan): Record<string, any>[] => {
  if (!plan || !rows.length) return rows;

  const rootMap = new Map<any, Record<string, any>>();
  const relationIndex = new Map<any, Record<string, Set<any>>>();

  const getOrCreateParent = (row: Record<string, any>) => {
    const rootId = row[plan.rootPrimaryKey];
    if (rootId === undefined) return undefined;

    if (!rootMap.has(rootId)) {
      rootMap.set(rootId, createBaseRow(row, plan));
    }

    return rootMap.get(rootId);
  };

  const getRelationSeenSet = (rootId: any, relationName: string): Set<any> => {
    let byRelation = relationIndex.get(rootId);
    if (!byRelation) {
      byRelation = {};
      relationIndex.set(rootId, byRelation);
    }

    let seen = byRelation[relationName];
    if (!seen) {
      seen = new Set<any>();
      byRelation[relationName] = seen;
    }

    return seen;
  };

  for (const row of rows) {
    const rootId = row[plan.rootPrimaryKey];
    if (rootId === undefined) continue;

    const parent = getOrCreateParent(row);
    if (!parent) continue;

    for (const rel of plan.relations) {
      const childPkKey = makeRelationAlias(rel.aliasPrefix, rel.targetPrimaryKey);
      const childPk = row[childPkKey];
      if (childPk === null || childPk === undefined) continue;

      const seen = getRelationSeenSet(rootId, rel.name);
      if (seen.has(childPk)) continue;
      seen.add(childPk);

      if (rel.type === RelationKinds.HasOne) {
        if (!parent[rel.name]) {
          parent[rel.name] = buildChild(row, rel);
        }
        continue;
      }

      const bucket = parent[rel.name] as any[];
      bucket.push(buildChild(row, rel));
    }
  }

  return Array.from(rootMap.values());
};

const createBaseRow = (row: Record<string, any>, plan: HydrationPlan): Record<string, any> => {
  const base: Record<string, any> = {};
  const baseKeys = plan.rootColumns.length
    ? plan.rootColumns
    : Object.keys(row).filter(k => !isRelationAlias(k));

  for (const key of baseKeys) {
    base[key] = row[key];
  }

  for (const rel of plan.relations) {
    base[rel.name] = rel.type === RelationKinds.HasOne ? null : [];
  }

  return base;
};

const buildChild = (row: Record<string, any>, rel: HydrationRelationPlan): Record<string, any> => {
  const child: Record<string, any> = {};
  for (const col of rel.columns) {
    const key = makeRelationAlias(rel.aliasPrefix, col);
    child[col] = row[key];
  }

  const pivot = buildPivot(row, rel);
  if (pivot) {
    (child as any)._pivot = pivot;
  }

  return child;
};

const buildPivot = (row: Record<string, any>, rel: HydrationRelationPlan): Record<string, any> | undefined => {
  if (!rel.pivot) return undefined;

  const pivot: Record<string, any> = {};
  for (const col of rel.pivot.columns) {
    const key = makeRelationAlias(rel.pivot.aliasPrefix, col);
    pivot[col] = row[key];
  }

  const hasValue = Object.values(pivot).some(v => v !== null && v !== undefined);
  return hasValue ? pivot : undefined;
};
