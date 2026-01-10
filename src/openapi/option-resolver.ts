import type {
  SchemaOptions,
  OutputSchemaOptions,
  InputSchemaOptions,
  InputSchemaMode
} from './schema-types.js';

const DEFAULT_MAX_DEPTH = 5;

export const resolveOutputOptions = (options: SchemaOptions): OutputSchemaOptions => ({
  mode: options.mode ?? 'full',
  includeDescriptions: options.includeDescriptions,
  includeEnums: options.includeEnums,
  includeExamples: options.includeExamples,
  includeDefaults: options.includeDefaults,
  includeNullable: options.includeNullable,
  maxDepth: options.maxDepth ?? DEFAULT_MAX_DEPTH,
  refMode: options.refMode ?? 'inline',
  selectedRefMode: options.selectedRefMode ?? 'inline',
  componentName: options.componentName,
  outputAsRef: options.outputAsRef ?? false
});

export const resolveInputOptions = (options: SchemaOptions): InputSchemaOptions | undefined => {
  if (options.input === false) return undefined;
  const input = options.input ?? {};
  const mode = (input.mode ?? 'create') as InputSchemaMode;

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
    requirePrimaryKey: input.requirePrimaryKey ?? (mode === 'update'),
    excludeRelationForeignKeys: input.excludeRelationForeignKeys ?? false,
    relationSelections: input.relationSelections
  };
};

export const getMaxDepth = (options: SchemaOptions): number => {
  return options.maxDepth ?? DEFAULT_MAX_DEPTH;
};
