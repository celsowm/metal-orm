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

// Options for creating a validator instance
export interface ValidatorFactoryOptions {
  /** Custom validation rules */
  customRules?: Record<string, unknown>;
  
  /** Whether to enable strict mode by default */
  strict?: boolean;
  
  /** Custom error messages */
  errorMessages?: Record<string, string>;
}
