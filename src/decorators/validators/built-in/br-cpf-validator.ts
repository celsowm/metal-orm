import type { CountryValidator, ValidationOptions, ValidationResult, AutoCorrectionResult } from '../country-validators.js';

/**
 * Brazilian CPF validator
 * Format: XXX.XXX.XXX-XX (11 digits)
 * Checksum: Mod 11 algorithm
 */
export class CPFValidator implements CountryValidator<string> {
  readonly countryCode = 'BR';
  readonly identifierType = 'cpf';
  readonly name = 'br-cpf';
  
  validate(value: string, options: ValidationOptions = {}): ValidationResult {
    const normalized = this.normalize(value);
    
    // Validate format
    if (!/^\d{11}$/.test(normalized)) {
      return { 
        isValid: false, 
        error: options.errorMessage || 'CPF must contain exactly 11 numeric digits' 
      };
    }
    
    // Check for known invalid CPFs
    if (this.isKnownInvalid(normalized) && options.strict !== false) {
      return { 
        isValid: false, 
        error: options.errorMessage || 'Invalid CPF number' 
      };
    }
    
    // Validate checksum
    if (!this.validateChecksum(normalized)) {
      return { 
        isValid: false, 
        error: options.errorMessage || 'Invalid CPF checksum' 
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
    if (normalized.length !== 11) return value;
    return normalized.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  
  autoCorrect(value: string): AutoCorrectionResult<string> {
    const normalized = this.normalize(value);
    
    if (normalized.length === 11) {
      return { success: true, correctedValue: this.format(normalized) };
    }
    
    if (normalized.length < 11) {
      const padded = normalized.padEnd(11, '0');
      return { success: true, correctedValue: this.format(padded) };
    }
    
    const truncated = normalized.slice(0, 11);
    return { success: true, correctedValue: this.format(truncated) };
  }
  
  private isKnownInvalid(cpf: string): boolean {
    // Check for CPFs with all digits the same (e.g., 111.111.111-11)
    return /^(\d)\1{10}$/.test(cpf);
  }
  
  private validateChecksum(cpf: string): boolean {
    const digits = cpf.split('').map(Number);
    
    // Calculate first check digit
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += digits[i] * (10 - i);
    }
    let check1 = sum % 11;
    check1 = check1 < 2 ? 0 : 11 - check1;
    
    if (check1 !== digits[9]) {
      return false;
    }
    
    // Calculate second check digit
    sum = 0;
    for (let i = 0; i < 10; i++) {
      sum += digits[i] * (11 - i);
    }
    let check2 = sum % 11;
    check2 = check2 < 2 ? 0 : 11 - check2;
    
    return check2 === digits[10];
  }
}
