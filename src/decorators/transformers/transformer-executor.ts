import { getEntityMetadata } from '../../orm/entity-metadata.js';
import type { EntityConstructor, EntityMetadata } from '../../orm/entity-metadata.js';
import type { 
  TransformContext, 
  TransformerConfig, 
  PropertyTransformer, 
  PropertyValidator, 
  PropertySanitizer, 
  TransformerMetadata
} from './transformer-metadata.js';

export class TransformerExecutor {
  private config: TransformerConfig = {
    auto: false,
    execute: 'both',
    stopOnFirstError: false
  };

  constructor(options?: TransformerConfig) {
    this.config = { ...this.config, ...options };
  }

  /**
   * Applies all transformers to an entity instance
   */
  async applyTransformers(entity: Record<string, unknown>, entityClass: EntityConstructor, context: Partial<TransformContext> = {}): Promise<void> {
    const meta = getEntityMetadata(entityClass);
    if (!meta || !meta.transformers) return;

    // Get column types from entity metadata
    const columnTypes = this.getColumnTypes(meta);

    for (const [propertyName, transformerMeta] of Object.entries(meta.transformers)) {
      const typedMeta = transformerMeta as unknown as TransformerMetadata;
      
      // Skip if transformer should not execute in current context
      if (!this.shouldExecute(typedMeta.executionOrder, context.isUpdate)) {
        continue;
      }

      // Get current value
      const value = entity[propertyName];

      // Skip if value is null or undefined
      if (value === null || value === undefined) continue;

      // Create transform context
      const transformContext: TransformContext = {
        entityName: entityClass.name,
        propertyName,
        columnType: columnTypes[propertyName] || 'VARCHAR',
        isUpdate: context.isUpdate || false,
        originalValue: context.originalValue,
        autoTransform: this.config.auto
      };

      try {
        // Apply sanitizers first
        let transformedValue = this.applySanitizers(value, typedMeta.sanitizers, transformContext);
        
        // Apply transformers
        transformedValue = this.applyTransformersToValue(transformedValue, typedMeta.transformers, transformContext);
        
        // Apply validation
        this.applyValidators(transformedValue, typedMeta.validators, transformContext);
        
        // Update the entity with the transformed value
        entity[propertyName] = transformedValue;
      } catch (_error) {
        // Handle errors based on config
        if (this.config.stopOnFirstError) {
          throw _error;
        }
        // Continue with other properties
      }
    }
  }

  private shouldExecute(executionOrder: 'before-save' | 'after-load' | 'both', isUpdate: boolean): boolean {
    if (executionOrder === 'both') return true;
    if (isUpdate && executionOrder === 'before-save') return true;
    if (!isUpdate && executionOrder === 'after-load') return true;
    return false;
  }

  private getColumnTypes(meta: EntityMetadata): Record<string, string> {
    if (!meta || !meta.columns) return {};

    const columnTypes: Record<string, string> = {};
    for (const [propertyName, columnDef] of Object.entries(meta.columns)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      columnTypes[propertyName] = (columnDef as any).type || 'VARCHAR';
    }
    return columnTypes;
  }

  private applySanitizers(value: unknown, sanitizers: PropertySanitizer[], context: TransformContext): unknown {
    let result = value;
    for (const sanitizer of sanitizers) {
      try {
        result = sanitizer.sanitize(result, context);
      } catch (_error: unknown) {
        // Continue with next sanitizer if this one fails
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const error = _error;
      }
    }
    return result;
  }

  private applyTransformersToValue(value: unknown, transformers: PropertyTransformer[], context: TransformContext): unknown {
    let result = value;
    for (const transformer of transformers) {
      try {
        result = transformer.transform(result, context);
      } catch (_error: unknown) {
        // Continue with next transformer if this one fails
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const error = _error;
      }
    }
    return result;
  }

  private applyValidators(value: unknown, validators: PropertyValidator[], context: TransformContext): void {
    const errors: string[] = [];

    for (const validator of validators) {
      try {
        const result = validator.validate(value, context);
        
        if (!result.isValid) {
          if (context.autoTransform && 'autoTransform' in validator) {
            const autoResult = (validator as { autoTransform?: (v: unknown, c: TransformContext) => { success: boolean; correctedValue?: unknown; message?: string } }).autoTransform?.(value, context);
            if (typeof autoResult === 'object' && autoResult !== null && 'success' in autoResult && autoResult.success && 'correctedValue' in autoResult && autoResult.correctedValue !== undefined) {
              // Auto-correct the value
              (context as { correctedValue?: unknown }).correctedValue = autoResult.correctedValue;
              return; // Value is now valid
            }
          }
          errors.push(result.error || `Validation failed for ${validator.name}`);
          
          if (this.config.stopOnFirstError) {
            break;
          }
        }
      } catch (_error: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const error = _error;
        if (_error instanceof Error) {
          errors.push(_error.message);
        } else {
          errors.push('Validation failed');
        }
        if (this.config.stopOnFirstError) {
          break;
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join(', '));
    }
  }
}

/**
 * Creates a transformer executor with specified config
 */
export const createTransformerExecutor = (config?: TransformerConfig): TransformerExecutor => {
  return new TransformerExecutor(config);
};
