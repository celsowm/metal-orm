import type { CountryValidator, ValidationOptions, ValidationResult, AutoCorrectionResult } from '../country-validators.js';

/**
 * Brazilian CEP validator
 * Format: XXXXX-XXX (8 digits)
 */
export class CEPValidator implements CountryValidator<string> {
  readonly countryCode = 'BR';
  readonly identifierType = 'cep';
  readonly name = 'br-cep';
  
  validate(value: string, options: ValidationOptions = {}): ValidationResult {
    const normalized = this.normalize(value);
    
    // Validate format
    if (!/^\d{8}$/.test(normalized)) {
      return { 
        isValid: false, 
        error: options.errorMessage || 'CEP must contain exactly 8 numeric digits' 
      };
    }
    
    return { 
      isValid: true, 
      normalizedValue: normalized, 
      formattedValue: this.format(value) 
    };
  }
  
  normalize(value: string): string {
    return value.replace(/[^0-9]/g, '');
  }
  
  format(value: string): string {
    const normalized = this.normalize(value);
    if (normalized.length !== 8) return value;
    return normalized.replace(/(\d{5})(\d{3})/, '$1-$2');
  }
  
  autoCorrect(value: string): AutoCorrectionResult<string> {
    const normalized = this.normalize(value);
    
    if (normalized.length === 8) {
      return { success: true, correctedValue: this.format(normalized) };
    }
    
    if (normalized.length < 8) {
      const padded = normalized.padEnd(8, '0');
      return { success: true, correctedValue: this.format(padded) };
    }
    
    const truncated = normalized.slice(0, 8);
    return { success: true, correctedValue: this.format(truncated) };
  }
}
