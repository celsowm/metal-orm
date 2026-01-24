import type { CountryValidator, ValidationOptions, ValidationResult, AutoCorrectionResult } from '../country-validators.js';

/**
 * Brazilian CNPJ validator
 * Format: XX.XXX.XXX/XXXX-XX (14 digits)
 * Checksum: Mod 11 algorithm
 */
export class CNPJValidator implements CountryValidator<string> {
  readonly countryCode = 'BR';
  readonly identifierType = 'cnpj';
  readonly name = 'br-cnpj';
  
  validate(value: string, options: ValidationOptions = {}): ValidationResult {
    const normalized = this.normalize(value);
    
    // Validate format
    if (!/^\d{14}$/.test(normalized)) {
      return { 
        isValid: false, 
        error: options.errorMessage || 'CNPJ must contain exactly 14 numeric digits' 
      };
    }
    
    // Check for known invalid CNPJs
    if (this.isKnownInvalid(normalized) && options.strict !== false) {
      return { 
        isValid: false, 
        error: options.errorMessage || 'Invalid CNPJ number' 
      };
    }
    
    // Validate checksum
    if (!this.validateChecksum(normalized)) {
      return { 
        isValid: false, 
        error: options.errorMessage || 'Invalid CNPJ checksum' 
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
    if (normalized.length !== 14) return value;
    return normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  
  autoCorrect(value: string): AutoCorrectionResult<string> {
    const normalized = this.normalize(value);
    
    if (normalized.length === 14) {
      return { success: true, correctedValue: this.format(normalized) };
    }
    
    if (normalized.length < 14) {
      const padded = normalized.padEnd(14, '0');
      return { success: true, correctedValue: this.format(padded) };
    }
    
    const truncated = normalized.slice(0, 14);
    return { success: true, correctedValue: this.format(truncated) };
  }
  
  private isKnownInvalid(cnpj: string): boolean {
    // Check for CNPJs with all digits the same (e.g., 00.000.000/0000-00)
    return /^(\d)\1{13}$/.test(cnpj);
  }
  
  private validateChecksum(cnpj: string): boolean {
    const digits = cnpj.split('').map(Number);
    const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    
    // Calculate first check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      sum += digits[i] * weights1[i];
    }
    let check1 = sum % 11;
    check1 = check1 < 2 ? 0 : 11 - check1;
    
    if (check1 !== digits[12]) {
      return false;
    }
    
    // Calculate second check digit
    sum = 0;
    for (let i = 0; i < 13; i++) {
      sum += digits[i] * weights2[i];
    }
    let check2 = sum % 11;
    check2 = check2 < 2 ? 0 : 11 - check2;
    
    return check2 === digits[13];
  }
}
