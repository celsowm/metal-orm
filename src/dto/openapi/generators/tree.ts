import type { TableDef } from '../../../schema/table.js';
import type { ColumnDef } from '../../../schema/column-types.js';
import type { EntityConstructor } from '../../../orm/entity-metadata.js';
import type { OpenApiSchema, OpenApiDialect, OpenApiType } from '../types.js';
import { columnToOpenApiSchema } from './column.js';
import { getColumnMap, isTableDef } from './base.js';
import { getTreeConfig } from '../../../tree/tree-decorator.js';

export interface TreeNodeSchemaOptions {
  dialect?: OpenApiDialect;
  componentName?: string;
  includeTreeMetadata?: boolean;
  exclude?: string[];
  include?: string[];
}

export interface TreeNodeResultSchemaOptions extends TreeNodeSchemaOptions {
  parentKey?: string;
}

export interface TreeListSchemaOptions {
  keyType?: OpenApiType;
  valueType?: OpenApiType;
}

export function threadedNodeToOpenApiSchema<T extends TableDef | EntityConstructor>(
  target: T,
  options?: TreeNodeSchemaOptions
): OpenApiSchema {
  const componentName = options?.componentName;
  const nodeSchema = entityToOpenApiSchema(target, options);

  const treeNodeSchema: OpenApiSchema = {
    type: 'object',
    properties: {
      node: nodeSchema,
      children: {
        type: 'array',
        items: componentName ? { $ref: `#/components/schemas/${componentName}` } : {},
        description: 'Child nodes in the tree hierarchy',
      },
    },
    required: ['node', 'children'],
    description: 'A node in a threaded tree structure with nested children',
  };

  return treeNodeSchema;
}

export function treeNodeToOpenApiSchema<T extends TableDef | EntityConstructor>(
  target: T,
  options?: TreeNodeSchemaOptions
): OpenApiSchema {
  const includeMetadata = options?.includeTreeMetadata ?? true;
  const entitySchema = entityToOpenApiSchema(target, options);

  const properties: Record<string, OpenApiSchema> = {
    entity: entitySchema,
    lft: {
      type: 'integer',
      description: 'Left boundary value (nested set)',
    },
    rght: {
      type: 'integer',
      description: 'Right boundary value (nested set)',
    },
    isLeaf: {
      type: 'boolean',
      description: 'Whether this node has no children',
    },
    isRoot: {
      type: 'boolean',
      description: 'Whether this node has no parent',
    },
    childCount: {
      type: 'integer',
      minimum: 0,
      description: 'Number of descendants',
    },
  };

  if (includeMetadata) {
    properties.depth = {
      type: 'integer',
      minimum: 0,
      description: 'Depth level (0 = root)',
    };
  }

  return {
    type: 'object',
    properties,
    required: ['entity', 'lft', 'rght', 'isLeaf', 'isRoot', 'childCount'],
    description: 'A tree node with nested set boundaries and metadata',
  };
}

export function treeNodeResultToOpenApiSchema<T extends TableDef | EntityConstructor>(
  target: T,
  options?: TreeNodeResultSchemaOptions
): OpenApiSchema {
  const includeMetadata = options?.includeTreeMetadata ?? true;
  const entitySchema = entityToOpenApiSchema(target, options);
  const parentKey = resolveParentKey(target, options);
  const parentSchema = resolveParentSchema(target, parentKey, options?.dialect);
  const parentIdSchema: OpenApiSchema = {
    ...parentSchema,
    description: parentSchema.description ?? 'Parent identifier (null for roots)',
  };

  const properties: Record<string, OpenApiSchema> = {
    data: entitySchema,
    lft: {
      type: 'integer',
      description: 'Left boundary value (nested set)',
    },
    rght: {
      type: 'integer',
      description: 'Right boundary value (nested set)',
    },
    parentId: parentIdSchema,
    isLeaf: {
      type: 'boolean',
      description: 'Whether this node has no children',
    },
    isRoot: {
      type: 'boolean',
      description: 'Whether this node has no parent',
    },
  };

  if (includeMetadata) {
    properties.depth = {
      type: 'integer',
      minimum: 0,
      description: 'Depth level (0 = root)',
    };
  }

  return {
    type: 'object',
    properties,
    required: ['data', 'lft', 'rght', 'parentId', 'isLeaf', 'isRoot'],
    description: 'A tree node result with nested set boundaries and metadata',
  };
}

export function treeListEntryToOpenApiSchema(
  options?: TreeListSchemaOptions
): OpenApiSchema {
  const keyType = options?.keyType ?? 'integer';
  const valueType = options?.valueType ?? 'string';

  return {
    type: 'object',
    properties: {
      key: {
        type: keyType,
        description: 'The key (usually primary key)',
      },
      value: {
        type: valueType,
        description: 'The display value with depth prefix',
      },
      depth: {
        type: 'integer',
        minimum: 0,
        description: 'The depth level',
      },
    },
    required: ['key', 'value', 'depth'],
    description: 'A tree list entry for dropdown/select rendering',
  };
}

export function generateTreeComponents<T extends TableDef | EntityConstructor>(
  target: T,
  baseName: string,
  options?: TreeNodeSchemaOptions
): Record<string, OpenApiSchema> {
  const threadedNodeName = `${baseName}TreeNode`;

  return {
    [baseName]: entityToOpenApiSchema(target, options),
    [`${baseName}Node`]: treeNodeToOpenApiSchema(target, options),
    [`${baseName}NodeResult`]: treeNodeResultToOpenApiSchema(target, options),
    [threadedNodeName]: threadedNodeToOpenApiSchema(target, {
      ...options,
      componentName: threadedNodeName,
    }),
    [`${baseName}TreeList`]: {
      type: 'array',
      items: treeListEntryToOpenApiSchema(),
      description: `Flat list of ${baseName} tree entries for dropdown/select`,
    },
    [`${baseName}ThreadedTree`]: {
      type: 'array',
      items: { $ref: `#/components/schemas/${threadedNodeName}` },
      description: `Threaded tree structure of ${baseName} nodes`,
    },
  };
}

function entityToOpenApiSchema<T extends TableDef | EntityConstructor>(
  target: T,
  options?: TreeNodeSchemaOptions
): OpenApiSchema {
  const columns = getColumnMap(target);
  const properties: Record<string, OpenApiSchema> = {};
  const required: string[] = [];
  const dialect = options?.dialect ?? 'openapi-3.1';

  for (const [key, col] of Object.entries(columns)) {
    if (options?.exclude?.includes(key)) {
      continue;
    }

    if (options?.include && !options.include.includes(key)) {
      continue;
    }

    properties[key] = columnToOpenApiSchema(col, dialect);

    if (col.notNull || col.primary) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 && { required }),
  };
}

function resolveParentSchema<T extends TableDef | EntityConstructor>(
  target: T,
  parentKey: string,
  dialect: OpenApiDialect = 'openapi-3.1'
): OpenApiSchema {
  const columns = getColumnMap(target);
  const parentColumn = columns[parentKey] ?? findColumnByName(columns, parentKey);

  if (parentColumn) {
    return columnToOpenApiSchema(parentColumn, dialect);
  }

  return {
    type: ['string', 'null'],
  };
}

function resolveParentKey<T extends TableDef | EntityConstructor>(
  target: T,
  options?: TreeNodeResultSchemaOptions
): string {
  if (options?.parentKey) {
    return options.parentKey;
  }

  if (!isTableDef(target)) {
    const config = getTreeConfig(target);
    if (config?.parentKey) {
      return config.parentKey;
    }
  }

  return 'parentId';
}

function findColumnByName(
  columns: Record<string, ColumnDef>,
  columnName: string
): ColumnDef | undefined {
  return Object.values(columns).find(col => col.name === columnName);
}
