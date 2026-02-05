import type { TableDef } from '../schema/table.js';
import type { RelationDef } from '../schema/relation.js';
import type { RelationMap, RelationTargetTable } from '../schema/types.js';
import type { RelationIncludeOptions, TypedRelationIncludeOptions } from './relation-types.js';

export type RelationIncludeInput<TTable extends TableDef> = {
  [K in keyof RelationMap<TTable> & string]?: true | RelationIncludeNodeInput<TTable['relations'][K]>;
};

export type RelationIncludeNodeInput<TRel extends RelationDef> =
  TypedRelationIncludeOptions<TRel> & {
    include?: RelationIncludeInput<RelationTargetTable<TRel>>;
  };

export type NormalizedRelationIncludeNode = {
  options?: RelationIncludeOptions;
  include?: NormalizedRelationIncludeTree;
};

export type NormalizedRelationIncludeTree = Record<string, NormalizedRelationIncludeNode>;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object');

export const normalizeRelationIncludeNode = <TRel extends RelationDef>(
  value?: true | RelationIncludeNodeInput<TRel>
): NormalizedRelationIncludeNode => {
  if (!value || value === true) {
    return {};
  }

  if (!isObject(value)) {
    return {};
  }

  const { include, ...rest } = value as Record<string, unknown>;
  const options = Object.keys(rest).length ? (rest as RelationIncludeOptions) : undefined;
  const normalizedInclude = isObject(include)
    ? normalizeRelationInclude(include as RelationIncludeInput<TableDef>)
    : undefined;

  if (normalizedInclude && Object.keys(normalizedInclude).length > 0) {
    return { options, include: normalizedInclude };
  }

  return { options };
};

export const normalizeRelationInclude = (
  input?: RelationIncludeInput<TableDef>
): NormalizedRelationIncludeTree => {
  if (!input) return {};

  const tree: NormalizedRelationIncludeTree = {};
  for (const [key, value] of Object.entries(input)) {
    tree[key] = normalizeRelationIncludeNode(value as RelationIncludeNodeInput<RelationDef> | true);
  }
  return tree;
};

export const mergeRelationIncludeTrees = (
  base: NormalizedRelationIncludeTree,
  next: NormalizedRelationIncludeTree
): NormalizedRelationIncludeTree => {
  const merged: NormalizedRelationIncludeTree = { ...base };

  for (const [key, node] of Object.entries(next)) {
    const existing = merged[key];
    if (!existing) {
      merged[key] = node;
      continue;
    }

    const include = existing.include && node.include
      ? mergeRelationIncludeTrees(existing.include, node.include)
      : (node.include ?? existing.include);

    merged[key] = {
      options: node.options ?? existing.options,
      ...(include ? { include } : {})
    };
  }

  return merged;
};

export const cloneRelationIncludeTree = (
  tree: NormalizedRelationIncludeTree
): NormalizedRelationIncludeTree => {
  const cloned: NormalizedRelationIncludeTree = {};
  for (const [key, node] of Object.entries(tree)) {
    cloned[key] = {
      options: node.options,
      ...(node.include ? { include: cloneRelationIncludeTree(node.include) } : {})
    };
  }
  return cloned;
};

export const getIncludeNode = (
  tree: NormalizedRelationIncludeTree,
  segments: string[]
): { options?: RelationIncludeOptions; exists: boolean } => {
  let current: NormalizedRelationIncludeTree | undefined = tree;
  let node: { options?: RelationIncludeOptions; include?: NormalizedRelationIncludeTree } | undefined;
  for (let i = 0; i < segments.length; i += 1) {
    if (!current) return { exists: false };
    node = current[segments[i]];
    if (!node) return { exists: false };
    if (i < segments.length - 1) {
      current = node.include;
    }
  }
  return { options: node?.options, exists: Boolean(node) };
};

export const setIncludeOptions = (
  tree: NormalizedRelationIncludeTree,
  segments: string[],
  options: RelationIncludeOptions
): void => {
  let current: NormalizedRelationIncludeTree = tree;
  for (let i = 0; i < segments.length; i += 1) {
    const key = segments[i];
    const isLeaf = i === segments.length - 1;
    const existing = current[key] ?? {};
    if (isLeaf) {
      current[key] = { ...existing, options };
      return;
    }
    const nextInclude = existing.include ?? {};
    current[key] = { ...existing, include: nextInclude };
    current = nextInclude;
  }
};
