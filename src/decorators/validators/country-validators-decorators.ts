import { getOrCreateMetadataBag } from '../decorator-metadata.js';
import { registerValidator } from './country-validator-registry.js';
import { CPFValidator } from './built-in/br-cpf-validator.js';
import { CNPJValidator } from './built-in/br-cnpj-validator.js';
import { CEPValidator } from './built-in/br-cep-validator.js';

// Register built-in validators
registerValidator('BR', 'cpf', () => new CPFValidator());
registerValidator('BR', 'cnpj', () => new CNPJValidator());
registerValidator('BR', 'cep', () => new CEPValidator());

const normalizePropertyName = (name: string | symbol): string => {
  if (typeof name === 'symbol') {
    return name.description ?? name.toString();
  }
  return name;
};

/**
 * Decorator to validate a Brazilian CPF number
 * @param options - Validation options
 * @returns Property decorator for CPF validation
 */
export function CPF(options?: { strict?: boolean; errorMessage?: string }) {
  return function (_value: unknown, context: ClassFieldDecoratorContext) {
    const propertyName = normalizePropertyName(context.name);
    const bag = getOrCreateMetadataBag(context);
    
    // Find or create transformer metadata for this property
    let existing = bag.transformers.find(t => t.propertyName === propertyName);
    if (!existing) {
      existing = {
        propertyName,
        metadata: {
          propertyName,
          transformers: [],
          validators: [],
          sanitizers: [],
          executionOrder: 'both'
        }
      };
      bag.transformers.push(existing);
    }
    
    // Create validator instance
    const validator = new CPFValidator();
    
    // Add validator to metadata
    existing.metadata.validators.push({
      name: validator.name,
      validate: (value: string) => {
        const result = validator.validate(value, {
          strict: options?.strict ?? true,
          errorMessage: options?.errorMessage
        });
        return {
          isValid: result.isValid,
          error: result.error,
          message: result.error
        };
      },
      autoTransform: (value: string) => {
        const correction = validator.autoCorrect(value);
        if (correction?.success) {
          return {
            success: true,
            correctedValue: correction.correctedValue,
            message: correction.message
          };
        }
        return { success: false };
      }
    } as unknown as never);
    
    // Add sanitizer to normalize and format
    existing.metadata.sanitizers.push({
      name: 'cpf-formatter',
      sanitize: (value: string) => validator.format(value)
    });
  };
}

/**
 * Decorator to validate a Brazilian CNPJ number
 * @param options - Validation options
 * @returns Property decorator for CNPJ validation
 */
export function CNPJ(options?: { strict?: boolean; errorMessage?: string }) {
  return function (_value: unknown, context: ClassFieldDecoratorContext) {
    const propertyName = normalizePropertyName(context.name);
    const bag = getOrCreateMetadataBag(context);
    
    // Find or create transformer metadata for this property
    let existing = bag.transformers.find(t => t.propertyName === propertyName);
    if (!existing) {
      existing = {
        propertyName,
        metadata: {
          propertyName,
          transformers: [],
          validators: [],
          sanitizers: [],
          executionOrder: 'both'
        }
      };
      bag.transformers.push(existing);
    }
    
    // Create validator instance
    const validator = new CNPJValidator();
    
    // Add validator to metadata
    existing.metadata.validators.push({
      name: validator.name,
      validate: (value: string) => {
        const result = validator.validate(value, {
          strict: options?.strict ?? true,
          errorMessage: options?.errorMessage
        });
        return {
          isValid: result.isValid,
          error: result.error,
          message: result.error
        };
      },
      autoTransform: (value: string) => {
        const correction = validator.autoCorrect(value);
        if (correction?.success) {
          return {
            success: true,
            correctedValue: correction.correctedValue,
            message: correction.message
          };
        }
        return { success: false };
      }
    } as unknown as never);
    
    // Add sanitizer to normalize and format
    existing.metadata.sanitizers.push({
      name: 'cnpj-formatter',
      sanitize: (value: string) => validator.format(value)
    });
  };
}

/**
 * Decorator to validate a Brazilian CEP number
 * @param options - Validation options
 * @returns Property decorator for CEP validation
 */
export function CEP(options?: { strict?: boolean; errorMessage?: string }) {
  return function (_value: unknown, context: ClassFieldDecoratorContext) {
    const propertyName = normalizePropertyName(context.name);
    const bag = getOrCreateMetadataBag(context);
    
    // Find or create transformer metadata for this property
    let existing = bag.transformers.find(t => t.propertyName === propertyName);
    if (!existing) {
      existing = {
        propertyName,
        metadata: {
          propertyName,
          transformers: [],
          validators: [],
          sanitizers: [],
          executionOrder: 'both'
        }
      };
      bag.transformers.push(existing);
    }
    
    // Create validator instance
    const validator = new CEPValidator();
    
    // Add validator to metadata
    existing.metadata.validators.push({
      name: validator.name,
      validate: (value: string) => {
        const result = validator.validate(value, {
          strict: options?.strict ?? true,
          errorMessage: options?.errorMessage
        });
        return {
          isValid: result.isValid,
          error: result.error,
          message: result.error
        };
      },
      autoTransform: (value: string) => {
        const correction = validator.autoCorrect(value);
        if (correction?.success) {
          return {
            success: true,
            correctedValue: correction.correctedValue,
            message: correction.message
          };
        }
        return { success: false };
      }
    } as unknown as never);
    
    // Add sanitizer to normalize and format
    existing.metadata.sanitizers.push({
      name: 'cep-formatter',
      sanitize: (value: string) => validator.format(value)
    });
  };
}
