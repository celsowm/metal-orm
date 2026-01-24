import type { PropertySanitizer, AutoTransformableValidator, AutoTransformResult, ValidationResult } from '../transformer-metadata.js';

// TrimTransformer
export class TrimTransformer implements PropertySanitizer<string> {
  readonly name = 'trim';
  
  constructor(private readonly options: { trimStart?: boolean; trimEnd?: boolean; trimAll?: boolean } = {}) {}
  
  sanitize(value: string): string {
    if (typeof value !== 'string') return value;
    
    if (this.options.trimAll) {
      return value.trim();
    }
    
    let result = value;
    if (this.options.trimStart) {
      result = result.trimStart();
    }
    if (this.options.trimEnd) {
      result = result.trimEnd();
    }
    if (!this.options.trimStart && !this.options.trimEnd && !this.options.trimAll) {
      result = result.trim();
    }
    
    return result;
  }
}

// CaseTransformer
export class CaseTransformer implements PropertySanitizer<string> {
  readonly name: string;
  
  constructor(private readonly caseType: 'lower' | 'upper' | 'capitalize' | 'title') {
    this.name = `case-${caseType}`;
  }
  
  sanitize(value: string): string {
    if (typeof value !== 'string') return value;
    
    switch (this.caseType) {
      case 'lower':
        return value.toLowerCase();
      case 'upper':
        return value.toUpperCase();
      case 'capitalize':
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      case 'title':
        return value.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      default:
        return value;
    }
  }
}

// AlphanumericValidator
export class AlphanumericValidator implements AutoTransformableValidator<string> {
  readonly name = 'alphanumeric';
  
  constructor(private readonly options: { allowSpaces?: boolean; allowUnderscores?: boolean; allowHyphens?: boolean } = {}) {}
  
  validate(value: string): ValidationResult {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Value must be a string' };
    }
    
    const pattern = new RegExp(
      `^[a-zA-Z0-9${this.options.allowSpaces ? ' ' : ''}${this.options.allowUnderscores ? '_' : ''}${this.options.allowHyphens ? '-' : ''}]*$`
    );
    
    return pattern.test(value) 
      ? { isValid: true } 
      : { isValid: false, error: 'Value must contain only alphanumeric characters' };
  }
  
  autoTransform(value: string): AutoTransformResult<string> {
    if (typeof value !== 'string') {
      return { success: false };
    }
    
    let result = value;
    result = result.replace(/[^a-zA-Z0-9]/g, char => {
      if (char === ' ' && this.options.allowSpaces) return ' ';
      if (char === '_' && this.options.allowUnderscores) return '_';
      if (char === '-' && this.options.allowHyphens) return '-';
      return '';
    });
    
    return { 
      success: true, 
      correctedValue: result, 
      message: 'Removed non-alphanumeric characters' 
    };
  }
}

// EmailValidator
export class EmailValidator implements AutoTransformableValidator<string> {
  readonly name = 'email';
  
  constructor(private readonly options: { allowPlus?: boolean; requireTLD?: boolean } = {}) {}
  
  validate(value: string): ValidationResult {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Value must be a string' };
    }
    
    // Simple email regex - RFC 5322 is very complex, this covers most cases
    const emailPattern = this.options.allowPlus 
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 
      : /^[^\s@+]+@[^\s@]+\.[^\s@]+$/;
    
    if (!emailPattern.test(value)) {
      return { isValid: false, error: 'Value must be a valid email address' };
    }
    
    if (this.options.requireTLD) {
      const parts = value.split('.');
      if (parts.length < 3 || parts[parts.length - 1].length < 2) {
        return { isValid: false, error: 'Email must have a valid top-level domain' };
      }
    }
    
    return { isValid: true };
  }
  
  autoTransform(value: string): AutoTransformResult<string> {
    if (typeof value !== 'string') {
      return { success: false };
    }
    
    let result = value.trim().toLowerCase();
    if (!this.options.allowPlus) {
      result = result.replace(/\+.*@/, '@');
    }
    
    return { 
      success: true, 
      correctedValue: result, 
      message: 'Trimmed and lowercased email' 
    };
  }
}

// LengthValidator
export class LengthValidator implements AutoTransformableValidator<string> {
  readonly name = 'length';
  
  constructor(private readonly options: { min?: number; max?: number; exact?: number } = {}) {}
  
  validate(value: string): ValidationResult {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Value must be a string' };
    }
    
    if (this.options.exact !== undefined && value.length !== this.options.exact) {
      return { isValid: false, error: `Value must be exactly ${this.options.exact} characters long` };
    }
    
    if (this.options.min !== undefined && value.length < this.options.min) {
      return { isValid: false, error: `Value must be at least ${this.options.min} characters long` };
    }
    
    if (this.options.max !== undefined && value.length > this.options.max) {
      return { isValid: false, error: `Value must be at most ${this.options.max} characters long` };
    }
    
    return { isValid: true };
  }
  
  autoTransform(value: string): AutoTransformResult<string> {
    if (typeof value !== 'string') {
      return { success: false };
    }
    
    let result = value;
    
    if (this.options.max !== undefined && result.length > this.options.max) {
      result = result.slice(0, this.options.max);
    }
    
    if (this.options.min !== undefined && result.length < this.options.min) {
      result = result.padEnd(this.options.min);
    }
    
    return { 
      success: true, 
      correctedValue: result, 
      message: 'Adjusted string length' 
    };
  }
}

// PatternValidator
export class PatternValidator implements AutoTransformableValidator<string> {
  readonly name = 'pattern';
  
  constructor(private readonly options: { pattern: RegExp; flags?: string; errorMessage?: string; replacement?: string } = { pattern: /.*/ }) {}
  
  validate(value: string): ValidationResult {
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Value must be a string' };
    }
    
    const pattern = new RegExp(this.options.pattern.source, this.options.flags);
    
    if (!pattern.test(value)) {
      return { isValid: false, error: this.options.errorMessage || 'Value does not match required pattern' };
    }
    
    return { isValid: true };
  }
  
  autoTransform(value: string): AutoTransformResult<string> {
    if (typeof value !== 'string' || !this.options.replacement) {
      return { success: false };
    }
    
    const pattern = new RegExp(this.options.pattern.source, this.options.flags);
    const result = value.replace(pattern, this.options.replacement);
    
    return { 
      success: true, 
      correctedValue: result, 
      message: 'Replaced pattern matches' 
    };
  }
}
