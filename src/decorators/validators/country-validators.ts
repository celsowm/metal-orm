/**
 * Base interface for country-specific identifier validators
 */
export interface CountryValidator<T = string> {
  /** ISO 3166-1 alpha-2 country code (e.g., 'BR', 'US') */
  readonly countryCode: string;
  
  /** Identifier type (e.g., 'cpf', 'cnpj', 'ssn', 'zip') */
  readonly identifierType: string;
  
  /** Unique validator name (e.g., 'br-cpf', 'us-ssn') */
  readonly name: string;
  
  /**
   * Validates an identifier value
   * @param value - The identifier value to validate
   * @param options - Validation options
   * @returns Validation result with success status and optional error message
   */
  validate(value: T, options?: ValidationOptions): ValidationResult;
  
  /**
   * Normalizes an identifier value (removes formatting, standardizes)
   * @param value - The identifier value to normalize
   * @returns Normalized value (digits only, uppercase, etc.)
   */
  normalize(value: T): string;
  
  /**
   * Formats an identifier value according to country standards
   * @param value - The identifier value to format (can be normalized or formatted)
   * @returns Formatted value (e.g., '123.456.789-01' for CPF)
   */
  format(value: T): string;
  
  /**
   * Attempts to auto-correct an invalid value
   * @param value - The invalid value to correct
   * @returns Auto-correction result or undefined if not possible
   */
  autoCorrect?(value: T): AutoCorrectionResult<T>;
}

/**
 * Validation options for country identifiers
 */
export interface ValidationOptions {
  /** Whether to allow formatted input (e.g., '123.456.789-01') */
  allowFormatted?: boolean;
  
  /** Whether to allow normalized input (e.g., '12345678901') */
  allowNormalized?: boolean;
  
  /** Whether to perform strict validation (e.g., check for known invalid numbers) */
  strict?: boolean;
  
  /** Custom error message */
  errorMessage?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  
  /** Error message if validation failed */
  error?: string;
  
  /** Normalized value (if validation passed) */
  normalizedValue?: string;
  
  /** Formatted value (if validation passed) */
  formattedValue?: string;
}

/**
 * Auto-correction result
 */
export interface AutoCorrectionResult<T = string> {
  /** Whether auto-correction was successful */
  success: boolean;
  
  /** Corrected value */
  correctedValue?: T;
  
  /** Description of what was corrected */
  message?: string;
}

// Country Validator Factory
export type CountryValidatorFactory<T = string> = (options?: ValidatorFactoryOptions) => CountryValidator<T>;

// Options for creating a validator instance
export interface ValidatorFactoryOptions {
  /** Custom validation rules */
  customRules?: Record<string, unknown>;
  
  /** Whether to enable strict mode by default */
  strict?: boolean;
  
  /** Custom error messages */
  errorMessages?: Record<string, string>;
}
