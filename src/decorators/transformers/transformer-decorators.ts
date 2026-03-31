import { resolveFieldDecoratorInfo } from '../decorator-metadata.js';
import type { TransformerMetadata } from './transformer-metadata.js';
import { 
  TrimTransformer, 
  CaseTransformer, 
  AlphanumericValidator, 
  EmailValidator, 
  LengthValidator, 
  PatternValidator 
} from './built-in/string-transformers.js';

const registerTransformerMetadata = (
  targetOrValue: unknown,
  contextOrProperty: unknown,
  metadata: Partial<TransformerMetadata>
): void => {
  const { propertyName, bag } = resolveFieldDecoratorInfo(
    targetOrValue,
    contextOrProperty,
    'Transformer'
  );
  
  // Find existing transformer metadata for this property
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
  
  // Merge metadata
  if (metadata.transformers) {
    existing.metadata.transformers.push(...metadata.transformers);
  }
  if (metadata.validators) {
    existing.metadata.validators.push(...metadata.validators);
  }
  if (metadata.sanitizers) {
    existing.metadata.sanitizers.push(...metadata.sanitizers);
  }
  if (metadata.executionOrder) {
    existing.metadata.executionOrder = metadata.executionOrder;
  }
};

// Trim decorator
export function Trim(options?: { trimStart?: boolean; trimEnd?: boolean; trimAll?: boolean }) {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      sanitizers: [new TrimTransformer(options)]
    });
  };
}

// Lower case decorator
export function Lower() {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      sanitizers: [new CaseTransformer('lower')]
    });
  };
}

// Upper case decorator
export function Upper() {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      sanitizers: [new CaseTransformer('upper')]
    });
  };
}

// Capitalize decorator
export function Capitalize() {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      sanitizers: [new CaseTransformer('capitalize')]
    });
  };
}

// Title case decorator
export function Title() {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      sanitizers: [new CaseTransformer('title')]
    });
  };
}

// Alphanumeric decorator
export function Alphanumeric(options?: { allowSpaces?: boolean; allowUnderscores?: boolean; allowHyphens?: boolean }) {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      validators: [new AlphanumericValidator(options)]
    });
  };
}

// Email decorator
export function Email(options?: { allowPlus?: boolean; requireTLD?: boolean }) {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      validators: [new EmailValidator(options)]
    });
  };
}

// Length decorator
export function Length(options: { min?: number; max?: number; exact?: number }) {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      validators: [new LengthValidator(options)]
    });
  };
}

// Pattern decorator
export function Pattern(options: { pattern: RegExp; flags?: string; errorMessage?: string; replacement?: string }) {
  return function (targetOrValue: unknown, contextOrProperty: unknown) {
    registerTransformerMetadata(targetOrValue, contextOrProperty, {
      validators: [new PatternValidator(options)]
    });
  };
}
