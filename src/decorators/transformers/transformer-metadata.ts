import type { ColumnType } from '../../schema/column-types.js';

// Transform context provides metadata about the transformation
export interface TransformContext {
  entityName: string;
  propertyName: string;
  columnType: ColumnType;
  isUpdate: boolean;
  originalValue?: unknown;
  autoTransform: boolean; // Whether auto-correction is enabled
}

// Auto-transform result for validators that can fix data
export interface AutoTransformResult<T = unknown> {
  success: boolean;
  correctedValue?: T;
  message?: string;
}

// Base transformer interface
export interface PropertyTransformer<TInput = unknown, TOutput = unknown> {
  readonly name: string;
  transform(value: TInput, context: TransformContext): TOutput;
}

// Validator interface (read-only, throws on failure)
export interface PropertyValidator<T = unknown> {
  readonly name: string;
  validate(value: T, context: TransformContext): ValidationResult;
}

// Sanitizer interface (mutates, never throws)
export interface PropertySanitizer<T = unknown> {
  readonly name: string;
  sanitize(value: T, context: TransformContext): T;
}

// Combined transformer that can validate and transform
export interface CompositeTransformer<TInput = unknown, TOutput = unknown>
  extends PropertyTransformer<TInput, TOutput>,
    PropertyValidator<TInput> {}

// Extended validator interface with auto-transform capability
export interface AutoTransformableValidator<T = unknown> extends PropertyValidator<T> {
  /**
   * Attempts to automatically correct an invalid value.
   * Returns undefined if auto-correction is not possible.
   */
  autoTransform?(value: T, context: TransformContext): AutoTransformResult<T>;
}

// Validation result
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  message?: string;
}

// Transformer metadata stored during decoration phase
export interface TransformerMetadata {
  propertyName: string;
  transformers: PropertyTransformer[];
  validators: PropertyValidator[];
  sanitizers: PropertySanitizer[];
  executionOrder: 'before-save' | 'after-load' | 'both';
}

// Transformer configuration options
export interface TransformerConfig {
  auto?: boolean; // Enable auto-transform mode (default: false)
  execute?: 'before-save' | 'after-load' | 'both'; // When to execute (default: 'both')
  stopOnFirstError?: boolean; // Stop validation on first error (default: false)
}
