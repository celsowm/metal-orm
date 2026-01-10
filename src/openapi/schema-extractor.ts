import type { TableDef } from '../schema/table.js';
import type { HydrationPlan } from '../core/hydration/types.js';
import type { ProjectionNode } from '../query-builder/select-query-state.js';

import type {
  OpenApiSchema,
  OpenApiSchemaBundle,
  SchemaOptions,
  OutputSchemaOptions,
  InputSchemaOptions
} from './schema-types.js';
import { extractInputSchema } from './schema-extractor-input.js';
import { extractOutputSchema } from './schema-extractor-output.js';
import {
  createContext,
  hasComputedProjection,
  registerComponentSchema,
  resolveComponentName,
  resolveSelectedComponentName,
  shouldUseSelectedSchema
} from './schema-extractor-utils.js';

const DEFAULT_MAX_DEPTH = 5;

/**
 * Extracts OpenAPI 3.1 schemas for output and optional input payloads.
 */
export const extractSchema = (
  table: TableDef,
  plan: HydrationPlan | undefined,
  projectionNodes: ProjectionNode[] | undefined,
  options: SchemaOptions = {}
): OpenApiSchemaBundle => {
  const outputOptions = resolveOutputOptions(options);
  const outputContext = createContext(outputOptions.maxDepth ?? DEFAULT_MAX_DEPTH);
  if (outputOptions.refMode === 'components') {
    outputContext.components = { schemas: {} };
  }
  const output = extractOutputSchema(table, plan, projectionNodes, outputContext, outputOptions);
  const useSelected = shouldUseSelectedSchema(outputOptions, plan, projectionNodes);
  const hasComputedFields = hasComputedProjection(projectionNodes);

  if (outputOptions.refMode === 'components' && outputContext.components && !hasComputedFields) {
    const componentName = useSelected && plan
      ? resolveSelectedComponentName(table, plan, outputOptions)
      : resolveComponentName(table, outputOptions);
    registerComponentSchema(componentName, output, outputContext);
  }

  const inputOptions = resolveInputOptions(options);
  if (!inputOptions) {
    return {
      output,
      components: outputContext.components && Object.keys(outputContext.components.schemas).length
        ? outputContext.components
        : undefined
    };
  }

  const inputContext = createContext(inputOptions.maxDepth ?? DEFAULT_MAX_DEPTH);
  const input = extractInputSchema(table, inputContext, inputOptions);

  return {
    output,
    input,
    components: outputContext.components && Object.keys(outputContext.components.schemas).length
      ? outputContext.components
      : undefined
  };
};

const resolveOutputOptions = (options: SchemaOptions): OutputSchemaOptions => ({
  mode: options.mode ?? 'full',
  includeDescriptions: options.includeDescriptions,
  includeEnums: options.includeEnums,
  includeExamples: options.includeExamples,
  includeDefaults: options.includeDefaults,
  includeNullable: options.includeNullable,
  maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
  refMode: options.refMode ?? 'inline',
  selectedRefMode: options.selectedRefMode ?? 'inline',
  componentName: options.componentName
});

const resolveInputOptions = (options: SchemaOptions): InputSchemaOptions | undefined => {
  if (options.input === false) return undefined;
  const input = options.input ?? {};
  const mode = input.mode ?? 'create';

  return {
    mode,
    includeRelations: input.includeRelations ?? true,
    relationMode: input.relationMode ?? 'mixed',
    includeDescriptions: input.includeDescriptions ?? options.includeDescriptions,
    includeEnums: input.includeEnums ?? options.includeEnums,
    includeExamples: input.includeExamples ?? options.includeExamples,
    includeDefaults: input.includeDefaults ?? options.includeDefaults,
    includeNullable: input.includeNullable ?? options.includeNullable,
    maxDepth: input.maxDepth ?? options.maxDepth ?? DEFAULT_MAX_DEPTH,
    omitReadOnly: input.omitReadOnly ?? true,
    excludePrimaryKey: input.excludePrimaryKey ?? false,
    requirePrimaryKey: input.requirePrimaryKey ?? (mode === 'update')
  };
};

/**
 * Converts a schema to a JSON string with optional pretty printing
 */
export const schemaToJson = (schema: OpenApiSchema, pretty = false): string => {
  return JSON.stringify(schema, null, pretty ? 2 : 0);
};
