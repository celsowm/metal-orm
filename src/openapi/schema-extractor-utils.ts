import type { TableDef } from '../schema/table.js';
import type { HydrationPlan } from '../core/hydration/types.js';
import type { ProjectionNode } from '../query-builder/select-query-state.js';
import type {
  OpenApiSchema,
  SchemaExtractionContext,
  OutputSchemaOptions,
  JsonSchemaProperty,
  JsonSchemaType
} from './schema-types.js';

export const hasComputedProjection = (projectionNodes?: ProjectionNode[]): boolean =>
  Boolean(projectionNodes && projectionNodes.some(node => node.type !== 'Column'));

export const shouldUseSelectedSchema = (
  options: OutputSchemaOptions,
  plan: HydrationPlan | undefined,
  projectionNodes: ProjectionNode[] | undefined
): boolean => {
  if (!plan || options.mode !== 'selected') return false;
  if (hasComputedProjection(projectionNodes)) return false;
  if (options.refMode === 'components' && options.selectedRefMode !== 'components') return false;
  return true;
};

export const resolveComponentName = (table: TableDef, options: OutputSchemaOptions): string =>
  options.componentName ? options.componentName(table) : table.name;

const normalizeColumns = (columns: string[]): string[] =>
  Array.from(new Set(columns)).sort((a, b) => a.localeCompare(b));

const buildSelectionSignature = (plan: HydrationPlan): string => {
  const relations = plan.relations
    .map(relation => ({
      name: relation.name,
      columns: normalizeColumns(relation.columns)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return JSON.stringify({
    root: normalizeColumns(plan.rootColumns),
    relations
  });
};

const hashString = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

export const resolveSelectedComponentName = (
  table: TableDef,
  plan: HydrationPlan,
  options: OutputSchemaOptions
): string => {
  const base = resolveComponentName(table, options);
  const signature = buildSelectionSignature(plan);
  return `${base}__sel_${hashString(signature)}`;
};

export const ensureComponentRef = (
  table: TableDef,
  componentName: string,
  context: SchemaExtractionContext,
  schemaFactory: () => OpenApiSchema
): JsonSchemaProperty => {
  if (context.components && !context.components.schemas[componentName]) {
    if (!context.visitedTables.has(table.name)) {
      context.components.schemas[componentName] = schemaFactory();
    }
  }

  return { $ref: `#/components/schemas/${componentName}` };
};

export const registerComponentSchema = (
  name: string,
  schema: OpenApiSchema,
  context: SchemaExtractionContext
): void => {
  if (!context.components) return;
  if (!context.components.schemas[name]) {
    context.components.schemas[name] = schema;
  }
};

export const createContext = (maxDepth: number): SchemaExtractionContext => ({
  visitedTables: new Set(),
  schemaCache: new Map(),
  depth: 0,
  maxDepth
});

export const buildCircularReferenceSchema = (
  tableName: string,
  kind: 'input' | 'output'
): OpenApiSchema => ({
  type: 'object',
  properties: {
    _ref: {
      type: 'string' as JsonSchemaType,
      description: `Circular ${kind} reference to ${tableName}`
    }
  },
  required: []
});
