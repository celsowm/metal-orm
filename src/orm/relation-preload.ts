import type { NormalizedRelationIncludeTree } from '../query-builder/relation-include-tree.js';
import { mergeRelationIncludeTrees } from '../query-builder/relation-include-tree.js';
import type { RelationIncludeOptions } from '../query-builder/relation-types.js';
import { getEntityMeta } from './entity-meta.js';

type LoadableRelation = {
  load?: () => Promise<unknown>;
  getItems?: () => unknown;
  get?: () => unknown;
};

const collectEntities = (value: unknown): Record<string, unknown>[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter(item => item && typeof item === 'object') as Record<string, unknown>[];
  }
  if (typeof value === 'object') {
    return [value as Record<string, unknown>];
  }
  return [];
};

const loadRelation = async (
  entity: Record<string, unknown>,
  relationName: string
): Promise<Record<string, unknown>[]> => {
  const wrapper = entity[relationName] as LoadableRelation | undefined;
  if (!wrapper) return [];

  if (typeof wrapper.load === 'function') {
    const loaded = await wrapper.load();
    return collectEntities(loaded);
  }

  if (typeof wrapper.getItems === 'function') {
    return collectEntities(wrapper.getItems());
  }

  if (typeof wrapper.get === 'function') {
    return collectEntities(wrapper.get());
  }

  return collectEntities(wrapper);
};

const setLazyOptionsIfEmpty = (
  entity: Record<string, unknown>,
  relationName: string,
  options?: RelationIncludeOptions
): void => {
  if (!options) return;
  const meta = getEntityMeta(entity);
  if (!meta || meta.lazyRelationOptions.has(relationName)) return;
  meta.lazyRelationOptions.set(relationName, options);
};

type PendingBatch = {
  entities: Record<string, unknown>[];
  include: NormalizedRelationIncludeTree;
};

const batchByTable = (
  pending: PendingBatch[]
): PendingBatch[] => {
  if (pending.length <= 1) return pending;

  const byTable = new Map<string, PendingBatch>();
  let ungroupedIndex = 0;

  for (const { entities, include } of pending) {
    const meta = entities.length ? getEntityMeta(entities[0]) : undefined;
    const tableKey = meta?.table?.name ?? `__ungrouped_${ungroupedIndex++}`;

    const existing = byTable.get(tableKey);
    if (existing) {
      existing.entities.push(...entities);
      existing.include = mergeRelationIncludeTrees(existing.include, include);
    } else {
      byTable.set(tableKey, { entities: [...entities], include: { ...include } });
    }
  }

  return Array.from(byTable.values());
};

export const preloadRelationIncludes = async (
  entities: Record<string, unknown>[],
  includeTree: NormalizedRelationIncludeTree,
  depth = 0
): Promise<void> => {
  if (!entities.length) return;
  const entries = Object.entries(includeTree);
  if (!entries.length) return;

  const pending: PendingBatch[] = [];

  for (const [relationName, node] of entries) {
    const shouldLoad = depth > 0 || Boolean(node.include);
    if (!shouldLoad) continue;

    for (const entity of entities) {
      setLazyOptionsIfEmpty(entity, relationName, node.options);
    }

    const loaded = await Promise.all(
      entities.map(entity => loadRelation(entity, relationName))
    );
    const relatedEntities = loaded.flat();

    if (node.include && relatedEntities.length) {
      pending.push({ entities: relatedEntities, include: node.include });
    }
  }

  const batched = batchByTable(pending);
  for (const { entities: batchEntities, include } of batched) {
    await preloadRelationIncludes(batchEntities, include, depth + 1);
  }
};
