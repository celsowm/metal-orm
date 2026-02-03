import { HydrationPlan, HydrationRelationPlan } from '../core/hydration/types.js';
import { RelationKinds } from '../schema/relation.js';
import { isRelationAlias, makeRelationAlias } from '../query-builder/relation-alias.js';

/**
 * Hydrates query results according to a hydration plan
 * @param rows - Raw database rows

/**
 * Hydrates query results according to a hydration plan
 * @param rows - Raw database rows
 * @param plan - Hydration plan
 * @returns Hydrated result objects with nested relations
 */
export const hydrateRows = (rows: Record<string, unknown>[], plan?: HydrationPlan): Record<string, unknown>[] => {
  if (!plan || !rows.length) return rows;

  const rootMap = new Map<unknown, Record<string, unknown>>();
  const relationIndex = new Map<unknown, Record<string, Set<unknown>>>();

  const getOrCreateParent = (row: Record<string, unknown>) => {
    const rootId = row[plan.rootPrimaryKey];
    if (rootId === undefined) return undefined;

    if (!rootMap.has(rootId)) {
      rootMap.set(rootId, createBaseRow(row, plan));
    }

    return rootMap.get(rootId);
  };

  const getRelationSeenSet = (rootId: unknown, relationName: string): Set<unknown> => {
    let byRelation = relationIndex.get(rootId);
    if (!byRelation) {
      byRelation = {};
      relationIndex.set(rootId, byRelation);
    }

    let seen = byRelation[relationName];
    if (!seen) {
      seen = new Set<unknown>();
      byRelation[relationName] = seen;
    }

    return seen;
  };

  const hasRelations = plan.relations.length > 0;

  for (const row of rows) {
    const rootId = row[plan.rootPrimaryKey];

    if (rootId === undefined || rootId === null) {
      if (!hasRelations) {
        rootMap.set(Symbol(), createBaseRow(row, plan));
      }
      continue;
    }

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

      const bucket = parent[rel.name] as unknown[];
      bucket.push(buildChild(row, rel));
    }
  }

  return Array.from(rootMap.values());
};

const createBaseRow = (row: Record<string, unknown>, plan: HydrationPlan): Record<string, unknown> => {
  const base: Record<string, unknown> = {};
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

const buildChild = (row: Record<string, unknown>, rel: HydrationRelationPlan): Record<string, unknown> => {
  const child: Record<string, unknown> = {};
  for (const col of rel.columns) {
    const key = makeRelationAlias(rel.aliasPrefix, col);
    child[col] = row[key];
  }

  const pivot = buildPivot(row, rel);
  if (pivot) {
    (child as { _pivot: unknown })._pivot = pivot;
    if (rel.pivot?.merge) {
      mergePivotIntoChild(child, pivot);
    }
  }

  return child;
};

const mergePivotIntoChild = (child: Record<string, unknown>, pivot: Record<string, unknown>): void => {
  for (const [key, value] of Object.entries(pivot)) {
    if (key in child) continue;
    child[key] = value;
  }
};

const buildPivot = (row: Record<string, unknown>, rel: HydrationRelationPlan): Record<string, unknown> | undefined => {
  if (!rel.pivot) return undefined;

  const pivot: Record<string, unknown> = {};
  for (const col of rel.pivot.columns) {
    const key = makeRelationAlias(rel.pivot.aliasPrefix, col);
    pivot[col] = row[key];
  }

  const hasValue = Object.values(pivot).some(v => v !== null && v !== undefined);
  return hasValue ? pivot : undefined;
};
