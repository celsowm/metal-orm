import { HydrationPlan } from '../ast/query';
import { isRelationAlias, makeRelationAlias } from '../utils/relation-alias';

/**
 * Hydrates query results according to a hydration plan
 * @param rows - Raw database rows
 * @param plan - Hydration plan
 * @returns Hydrated result objects with nested relations
 */
export const hydrateRows = (rows: Record<string, any>[], plan?: HydrationPlan): Record<string, any>[] => {
  if (!plan || !rows.length) return rows;

  const rootMap = new Map<any, any>();

  rows.forEach(row => {
    const rootId = row[plan.rootPrimaryKey];
    if (rootId === undefined) return;

    if (!rootMap.has(rootId)) {
      const base: Record<string, any> = {};
      const baseKeys = plan.rootColumns.length ? plan.rootColumns : Object.keys(row).filter(k => !isRelationAlias(k));
      baseKeys.forEach(key => { base[key] = row[key]; });
      plan.relations.forEach(rel => { base[rel.name] = []; });
      rootMap.set(rootId, base);
    }

    const parent = rootMap.get(rootId);

    plan.relations.forEach(rel => {
      const childPkKey = makeRelationAlias(rel.aliasPrefix, rel.targetPrimaryKey);
      const childPk = row[childPkKey];
      if (childPk === null || childPk === undefined) return;

      const bucket = parent[rel.name] as any[];
      if (bucket.some(item => item[rel.targetPrimaryKey] === childPk)) return;

      const child: Record<string, any> = {};
      rel.columns.forEach(col => {
        const key = makeRelationAlias(rel.aliasPrefix, col);
        child[col] = row[key];
      });

      if (rel.pivot) {
        const pivot: Record<string, any> = {};
        rel.pivot.columns.forEach(col => {
          const key = makeRelationAlias(rel.pivot.aliasPrefix, col);
          pivot[col] = row[key];
        });

        if (Object.values(pivot).some(v => v !== null && v !== undefined)) {
          (child as any)._pivot = pivot;
        }
      }

      bucket.push(child);
    });
  });

  return Array.from(rootMap.values());
};
