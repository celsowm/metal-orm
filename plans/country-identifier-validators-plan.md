# Country-Specific Identifier Validators Plan for Metal ORM

## Executive Summary

Design and implement a country-specific identifier validation system for Metal ORM that mirrors the existing locale-based inflection architecture. This system will provide decorators for validating and normalizing country-specific identifiers like Brazilian CPF/CNPJ/CEP, US SSN/ZIP, EU VAT numbers, and more. The system follows the same registry-based pattern as [`INFLECTOR_FACTORIES`](scripts/inflection/index.mjs:4) for consistency and extensibility.

## Motivation

Just as the inflection system provides locale-aware pluralization for entity generation, a country-specific identifier system provides:

1. **Data Integrity**: Validate country-specific identifiers with proper checksums and formats
2. **Auto-Normalization**: Automatically format identifiers (e.g., CPF: `123.456.789-01`)
3. **Type Safety**: Strongly typed validators for TypeScript
4. **Extensibility**: Easy to add new country validators without modifying core code
5. **Consistency**: Follows the same registry pattern as inflection system

## Architecture Overview

### Design Principles (SOLID)

1. **Single Responsibility Principle (SRP)**
   - Each country validator handles one country's identifiers
   - Separate interfaces for validation vs normalization
   - Registry management is distinct from validation logic

2. **Open/Closed Principle (OCP)**
   - New country validators can be added without modifying existing code
   - Validator composition allows combining behaviors
   - Strategy pattern for validator execution

3. **Liskov Substitution Principle (LSP)**
   - All validators implement the same base interface
   - Validators can be substituted without breaking behavior
   - Consistent error handling across all validators

4. **Interface Segregation Principle (ISP)**
   - Small, focused interfaces (Validator, Normalizer, Formatter)
   - Clients depend only on methods they use
   - Separate interfaces for read-only vs mutating operations

5. **Dependency Inversion Principle (DIP)**
   - High-level code depends on abstractions (interfaces), not concrete implementations
   - Validator registry uses dependency injection
   - Materializer depends on validator interface, not specific validators

### System Architecture

```mermaid
graph TB
    subgraph "Decorator Layer"
        D1[@CountryIdentifier]
        D2[@CPF]
        D3[@CNPJ]
        D4[@CEP]
        D5[@SSN]
        D6[@ZIP]
    end
    
    subgraph "Registry Layer"
        R1[VALIDATOR_FACTORIES]
        R2[registerValidator]
        R3[resolveValidator]
    end
    
    subgraph "Validator Layer"
        V1[CountryValidator Interface]
        V2[BrazilValidator]
        V3[USAValidator]
        V4[EUValidator]
    end
    
    subgraph "Implementation Layer"
        I1[CPF Validator]
        I2[CNPJ Validator]
        I3[CEP Validator]
        I4[SSN Validator]
        I5[ZIP Validator]
        I6[VAT Validator]
    end
    
    D1 --> R3
    D2 --> R3
    D3 --> R3
    D4 --> R3
    D5 --> R3
    D6 --> R3
    
    R3 --> R1
    R1 --> V1
    V1 --> V2
    V1 --> V3
    V1 --> V4
    
    V2 --> I1
    V2 --> I2
    V2 --> I3
    V3 --> I4
    V3 --> I5
    V4 --> I6
```

## Core Interfaces

### Base Validator Interface

```typescript
/**
 * Base interface for country-specific identifier validators
 */
interface CountryValidator<T = string> {
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
interface ValidationOptions {
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
interface ValidationResult {
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
interface AutoCorrectionResult<T = string> {
  /** Whether auto-correction was successful */
  success: boolean;
  
  /** Corrected value */
  correctedValue?: T;
  
  /** Description of what was corrected */
  message?: string;
}
```

### Country Validator Factory

```typescript
/**
 * Factory function that creates a country validator instance
 */
type CountryValidatorFactory<T = string> = (options?: ValidatorFactoryOptions) => CountryValidator<T>;

/**
 * Options for creating a validator instance
 */
interface ValidatorFactoryOptions {
  /** Custom validation rules */
  customRules?: Record<string, unknown>;
  
  /** Whether to enable strict mode by default */
  strict?: boolean;
  
  /** Custom error messages */
  errorMessages?: Record<string, string>;
}
```

## Registry Pattern (Similar to Inflection)

### Registry Implementation

```typescript
/**
 * Registry for country-specific identifier validators
 * Mirrors the INFLECTOR_FACTORIES pattern from scripts/inflection/index.mjs
 */
const VALIDATOR_FACTORIES = new Map<string, CountryValidatorFactory>();

/**
 * Registers a country validator factory
 * @param countryCode - ISO 3166-1 alpha-2 country code (e.g., 'BR', 'US')
 * @param identifierType - Identifier type (e.g., 'cpf', 'ssn')
 * @param factory - Factory function that creates a validator instance
 */
export const registerValidator = (
  countryCode: string,
  identifierType: string,
  factory: CountryValidatorFactory
): void => {
  const key = `${countryCode.toLowerCase()}-${identifierType.toLowerCase()}`;
  if (!countryCode) throw new Error('countryCode is required');
  if (!identifierType) throw new Error('identifierType is required');
  if (typeof factory !== 'function') {
    throw new Error('factory must be a function that returns a validator');
  }
  VALIDATOR_FACTORIES.set(key, factory);
};

/**
 * Resolves a validator for a given country and identifier type
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @param identifierType - Identifier type
 * @returns Validator instance or undefined if not found
 */
export const resolveValidator = (
  countryCode: string,
  identifierType: string
): CountryValidator | undefined => {
  const key = `${countryCode.toLowerCase()}-${identifierType.toLowerCase()}`;
  const factory = VALIDATOR_FACTORIES.get(key);
  return factory ? factory() : undefined;
};

/**
 * Gets all registered validator keys
 * @returns Array of validator keys (e.g., ['br-cpf', 'us-ssn'])
 */
export const getRegisteredValidators = (): string[] => {
  return Array.from(VALIDATOR_FACTORIES.keys());
};

/**
 * Checks if a validator is registered
 * @param countryCode - ISO 3166-1 alpha-2 country code
 * @param identifierType - Identifier type
 * @returns True if validator is registered
 */
export const hasValidator = (
  countryCode: string,
  identifierType: string
): boolean => {
  const key = `${countryCode.toLowerCase()}-${identifierType.toLowerCase()}`;
  return VALIDATOR_FACTORIES.has(key);
};
```

## Built-in Country Validators

### Brazil (BR)

#### CPF (Cadastro de Pessoas Físicas)

```typescript
/**
 * Brazilian CPF validator
 * Format: XXX.XXX.XXX-XX (11 digits)
 * Checksum: Mod 11 algorithm
 */
interface CPFValidator extends CountryValidator<string> {
  readonly countryCode: 'BR';
  readonly identifierType: 'cpf';
  readonly name: 'br-cpf';
  
  validate(value: string, options?: ValidationOptions): ValidationResult;
  normalize(value: string): string; // Returns 11 digits only
  format(value: string): string; // Returns XXX.XXX.XXX-XX
  autoCorrect?(value: string): AutoCorrectionResult<string>;
}

// Example usage:
@CPF({ strict: true })
cpf!: string;

// Valid: '123.456.789-09', '12345678909'
// Invalid: '123.456.789-00' (known invalid), '1234567890' (wrong length)
```

#### CNPJ (Cadastro Nacional da Pessoa Jurídica)

```typescript
/**
 * Brazilian CNPJ validator
 * Format: XX.XXX.XXX/XXXX-XX (14 digits)
 * Checksum: Mod 11 algorithm
 */
interface CNPJValidator extends CountryValidator<string> {
  readonly countryCode: 'BR';
  readonly identifierType: 'cnpj';
  readonly name: 'br-cnpj';
  
  validate(value: string, options?: ValidationOptions): ValidationResult;
  normalize(value: string): string; // Returns 14 digits only
  format(value: string): string; // Returns XX.XXX.XXX/XXXX-XX
  autoCorrect?(value: string): AutoCorrectionResult<string>;
}

// Example usage:
@CNPJ({ strict: true })
cnpj!: string;

// Valid: '12.345.678/0001-90', '12345678000190'
// Invalid: '12.345.678/0001-00' (known invalid), '1234567800019' (wrong length)
```

#### CEP (Código de Endereçamento Postal)

```typescript
/**
 * Brazilian CEP validator
 * Format: XXXXX-XXX (8 digits)
 */
interface CEPValidator extends CountryValidator<string> {
  readonly countryCode: 'BR';
  readonly identifierType: 'cep';
  readonly name: 'br-cep';
  
  validate(value: string, options?: ValidationOptions): ValidationResult;
  normalize(value: string): string; // Returns 8 digits only
  format(value: string): string; // Returns XXXXX-XX
  autoCorrect?(value: string): AutoCorrectionResult<string>;
}

// Example usage:
@CEP()
cep!: string;

// Valid: '01310-100', '01310100'
// Invalid: '01310-10' (wrong length), '01310-10A' (non-numeric)
```

### United States (US)

#### SSN (Social Security Number)

```typescript
/**
 * US SSN validator
 * Format: XXX-XX-XXXX (9 digits)
 * Restrictions: Cannot start with 000, 666, or 900-999
 */
interface SSNValidator extends CountryValidator<string> {
  readonly countryCode: 'US';
  readonly identifierType: 'ssn';
  readonly name: 'us-ssn';
  
  validate(value: string, options?: ValidationOptions): ValidationResult;
  normalize(value: string): string; // Returns 9 digits only
  format(value: string): string; // Returns XXX-XX-XXXX
  autoCorrect?(value: string): AutoCorrectionResult<string>;
}

// Example usage:
@SSN({ strict: true })
ssn!: string;

// Valid: '123-45-6789', '123456789'
// Invalid: '000-00-0000' (starts with 000), '666-00-0000' (starts with 666)
```

#### ZIP Code

```typescript
/**
 * US ZIP code validator
 * Format: XXXXX or XXXXX-XXXX (5 or 9 digits)
 */
interface ZIPValidator extends CountryValidator<string> {
  readonly countryCode: 'US';
  readonly identifierType: 'zip';
  readonly name: 'us-zip';
  
  validate(value: string, options?: ValidationOptions): ValidationResult;
  normalize(value: string): string; // Returns 5 or 9 digits only
  format(value: string): string; // Returns XXXXX or XXXXX-XXXX
  autoCorrect?(value: string): AutoCorrectionResult<string>;
}

// Example usage:
@ZIP()
zipCode!: string;

// Valid: '12345', '12345-6789'
// Invalid: '1234' (too short), '123456' (invalid format)
```

### European Union (EU)

#### VAT Number

```typescript
/**
 * EU VAT number validator
 * Format: Country code + 2-12 alphanumeric characters
 * Country-specific validation rules
 */
interface VATValidator extends CountryValidator<string> {
  readonly countryCode: 'EU';
  readonly identifierType: 'vat';
  readonly name: 'eu-vat';
  
  validate(value: string, options?: ValidationOptions): ValidationResult;
  normalize(value: string): string; // Returns uppercase, no spaces
  format(value: string): string; // Returns country code + number
  autoCorrect?(value: string): AutoCorrectionResult<string>;
}

// Example usage:
@VAT({ country: 'DE' })
vatNumber!: string;

// Valid: 'DE123456789', 'GB123456789'
// Invalid: 'DE12345678' (wrong length for Germany)
```

## Decorator API

### Basic Usage

```typescript
import { Entity, Column } from 'metal-orm';
import { CPF, CNPJ, CEP, SSN, ZIP, VAT } from 'metal-orm/validators';

@Entity()
class BrazilianCustomer {
  @PrimaryKey({ type: 'INT' })
  id!: number;
  
  @Column({ type: 'VARCHAR', args: [14] })
  @CPF({ strict: true })
  cpf!: string;
  
  @Column({ type: 'VARCHAR', args: [18] })
  @CNPJ({ strict: true })
  cnpj!: string;
  
  @Column({ type: 'VARCHAR', args: [9] })
  @CEP()
  cep!: string;
}

@Entity()
class USCustomer {
  @PrimaryKey({ type: 'INT' })
  id!: number;
  
  @Column({ type: 'VARCHAR', args: [11] })
  @SSN({ strict: true })
  ssn!: string;
  
  @Column({ type: 'VARCHAR', args: [10] })
  @ZIP()
  zipCode!: string;
}

@Entity()
class EUCompany {
  @PrimaryKey({ type: 'INT' })
  id!: number;
  
  @Column({ type: 'VARCHAR', args: [15] })
  @VAT({ country: 'DE' })
  vatNumber!: string;
}
```

### Generic Country Identifier Decorator

```typescript
/**
 * Generic country identifier decorator
 * Allows specifying country and identifier type dynamically
 */
@Entity()
class Customer {
  @PrimaryKey({ type: 'INT' })
  id!: number;
  
  @Column({ type: 'VARCHAR', args: [20] })
  @CountryIdentifier({ country: 'BR', type: 'cpf' })
  nationalId!: string;
  
  @Column({ type: 'VARCHAR', args: [20] })
  @CountryIdentifier({ country: 'US', type: 'ssn' })
  socialSecurityNumber!: string;
  
  @Column({ type: 'VARCHAR', args: [10] })
  @CountryIdentifier({ country: 'BR', type: 'cep' })
  postalCode!: string;
}
```

### Auto-Transform Mode

```typescript
/**
 * Auto-transform mode automatically normalizes and formats identifiers
 */
@Entity({ autoTransform: true })
class Customer {
  @Column({ type: 'VARCHAR', args: [14] })
  @CPF({ auto: true })
  cpf!: string;
  
  @Column({ type: 'VARCHAR', args: [18] })
  @CNPJ({ auto: true })
  cnpj!: string;
}

// Input: '123.456.789-09'
// After save (normalized): '12345678909'
// After load (formatted): '123.456.789-09'
```

### Composition with Other Transformers

```typescript
/**
 * Country identifier validators can be composed with other transformers
 */
@Entity()
class Customer {
  @Column({ type: 'VARCHAR', args: [14] })
  @Trim()
  @CPF({ strict: true })
  cpf!: string;
  
  @Column({ type: 'VARCHAR', args: [18] })
  @Trim()
  @CNPJ({ strict: true })
  cnpj!: string;
  
  @Column({ type: 'VARCHAR', args: [9] })
  @Trim()
  @CEP()
  cep!: string;
}
```

## Implementation Plan

### Phase 1: Core Infrastructure

1. **Create directory structure**
   ```
   scripts/identifier/
   ├── index.mjs              # Registry and public API
   ├── base-validator.mjs     # Base interfaces and utilities
   ├── checksum.mjs          # Common checksum algorithms (Luhn, Mod-11)
   └── validators/
       ├── br/
       │   ├── cpf.mjs
       │   ├── cnpj.mjs
       │   └── cep.mjs
       ├── us/
       │   ├── ssn.mjs
       │   └── zip.mjs
       └── eu/
           └── vat.mjs
   ```

2. **Implement base validator interfaces**
   - [`CountryValidator`](#base-validator-interface)
   - [`ValidationOptions`](#validation-options)
   - [`ValidationResult`](#validation-result)
   - [`AutoCorrectionResult`](#auto-correction-result)

3. **Implement registry pattern**
   - [`VALIDATOR_FACTORIES`](#registry-implementation)
   - [`registerValidator()`](#registry-implementation)
   - [`resolveValidator()`](#registry-implementation)
   - [`getRegisteredValidators()`](#registry-implementation)
   - [`hasValidator()`](#registry-implementation)

4. **Implement checksum utilities**
   - Luhn algorithm (for credit cards, some IDs)
   - Mod-11 algorithm (for CPF, CNPJ)
   - Mod-10 algorithm (for some identifiers)

### Phase 2: Built-in Validators

1. **Brazil validators**
   - [`CPFValidator`](#cpf-cadastro-de-pessoas-físicas)
   - [`CNPJValidator`](#cnpj-cadastro-nacional-da-pessoa-jurídica)
   - [`CEPValidator`](#cep-código-de-endereçamento-postal)

2. **US validators**
   - [`SSNValidator`](#ssn-social-security-number)
   - [`ZIPValidator`](#zip-code)

3. **EU validators**
   - [`VATValidator`](#vat-number)

### Phase 3: Decorator Integration

1. **Create decorator factory**
   - `@CountryIdentifier()` - Generic decorator
   - `@CPF()` - Brazil CPF decorator
   - `@CNPJ()` - Brazil CNPJ decorator
   - `@CEP()` - Brazil CEP decorator
   - `@SSN()` - US SSN decorator
   - `@ZIP()` - US ZIP decorator
   - `@VAT()` - EU VAT decorator

2. **Integrate with transformer system**
   - Implement [`PropertyValidator`](plans/transformer-decorators-plan.md:173) interface
   - Implement [`AutoTransformableValidator`](plans/transformer-decorators-plan.md:207) interface
   - Register validators in [`TransformerRegistry`](plans/transformer-decorators-plan.md:247)

3. **Add metadata support**
   - Store country code and identifier type in metadata
   - Support auto-transform mode
   - Support execution order (before-save, after-load, both)

### Phase 4: Testing

1. **Unit tests for each validator**
   - Valid inputs
   - Invalid inputs
   - Edge cases
   - Auto-correction behavior

2. **Integration tests**
   - Registry functionality
   - Decorator integration
   - Auto-transform mode
   - Composition with other transformers

3. **E2E tests**
   - Entity save/load with country identifiers
   - Error handling
   - Performance

### Phase 5: Documentation

1. **API documentation**
   - Public API reference
   - Decorator reference
   - Validator reference

2. **Usage examples**
   - Basic usage
   - Advanced usage
   - Custom validators

3. **Migration guide**
   - From manual validation to decorators
   - From other libraries to Metal ORM

## File Structure

```
scripts/identifier/
├── index.mjs                    # Registry and public API
├── base-validator.mjs           # Base interfaces and utilities
├── checksum.mjs                  # Common checksum algorithms
├── validators/
│   ├── br/
│   │   ├── cpf.mjs              # CPF validator
│   │   ├── cnpj.mjs             # CNPJ validator
│   │   └── cep.mjs              # CEP validator
│   ├── us/
│   │   ├── ssn.mjs              # SSN validator
│   │   └── zip.mjs              # ZIP validator
│   └── eu/
│       └── vat.mjs              # VAT validator
└── utils/
    ├── normalize.mjs            # Normalization utilities
    └── format.mjs               # Formatting utilities

src/validators/
├── index.ts                     # TypeScript exports
├── decorators.ts                # Decorator factories
├── registry.ts                  # TypeScript registry
└── types.ts                     # TypeScript types

tests/unit/validators/
├── registry.test.ts             # Registry tests
├── br/
│   ├── cpf.test.ts              # CPF tests
│   ├── cnpj.test.ts             # CNPJ tests
│   └── cep.test.ts              # CEP tests
├── us/
│   ├── ssn.test.ts              # SSN tests
│   └── zip.test.ts              # ZIP tests
└── eu/
    └── vat.test.ts              # VAT tests

tests/integration/validators/
├── decorators.test.ts          # Decorator integration tests
└── auto-transform.test.ts       # Auto-transform tests
```

## Integration with Transformer Decorators

### Transformer Interface Implementation

```typescript
/**
 * Country identifier validator implements PropertyValidator interface
 */
class CountryIdentifierValidator implements PropertyValidator<string> {
  readonly name: string;
  private validator: CountryValidator;
  
  constructor(countryCode: string, identifierType: string) {
    this.name = `country-identifier-${countryCode}-${identifierType}`;
    this.validator = resolveValidator(countryCode, identifierType)!;
  }
  
  validate(value: string, context: TransformContext): ValidationResult {
    const result = this.validator.validate(value);
    return {
      isValid: result.isValid,
      error: result.error
    };
  }
  
  autoTransform?(value: string, context: TransformContext): AutoTransformResult<string> {
    const result = this.validator.autoCorrect?.(value);
    if (result?.success) {
      return {
        success: true,
        correctedValue: result.correctedValue,
        message: result.message
      };
    }
    return { success: false };
  }
}
```

### Registration in TransformerRegistry

```typescript
// Register built-in country identifier validators
TransformerRegistry.getInstance().registerValidator(
  new CountryIdentifierValidator('BR', 'cpf')
);
TransformerRegistry.getInstance().registerValidator(
  new CountryIdentifierValidator('BR', 'cnpj')
);
TransformerRegistry.getInstance().registerValidator(
  new CountryIdentifierValidator('BR', 'cep')
);
TransformerRegistry.getInstance().registerValidator(
  new CountryIdentifierValidator('US', 'ssn')
);
TransformerRegistry.getInstance().registerValidator(
  new CountryIdentifierValidator('US', 'zip')
);
TransformerRegistry.getInstance().registerValidator(
  new CountryIdentifierValidator('EU', 'vat')
);
```

## Custom Validators

### Registering Custom Validators

```typescript
import { registerValidator } from 'metal-orm/validators';

// Define a custom validator
const createCustomValidator = () => ({
  countryCode: 'XX',
  identifierType: 'custom-id',
  name: 'xx-custom-id',
  validate: (value: string) => {
    // Custom validation logic
    return { isValid: true };
  },
  normalize: (value: string) => value.replace(/\D/g, ''),
  format: (value: string) => value,
  autoCorrect: (value: string) => ({
    success: true,
    correctedValue: value.replace(/\D/g, ''),
    message: 'Removed non-numeric characters'
  })
});

// Register the validator
registerValidator('XX', 'custom-id', createCustomValidator);

// Use it in entities
@Entity()
class CustomEntity {
  @Column({ type: 'VARCHAR', args: [20] })
  @CountryIdentifier({ country: 'XX', type: 'custom-id' })
  customId!: string;
}
```

## Examples

### Complete Example: Brazilian Customer

```typescript
import { Entity, Column, PrimaryKey } from 'metal-orm';
import { CPF, CNPJ, CEP } from 'metal-orm/validators';

@Entity({ autoTransform: true })
class BrazilianCustomer {
  @PrimaryKey({ type: 'INT' })
  id!: number;
  
  @Column({ type: 'VARCHAR', args: [100] })
  name!: string;
  
  @Column({ type: 'VARCHAR', args: [14] })
  @Trim()
  @CPF({ strict: true })
  cpf!: string;
  
  @Column({ type: 'VARCHAR', args: [18] })
  @Trim()
  @CNPJ({ strict: true })
  cnpj!: string;
  
  @Column({ type: 'VARCHAR', args: [9] })
  @Trim()
  @CEP()
  cep!: string;
  
  @Column({ type: 'VARCHAR', args: [255] })
  @Email()
  email!: string;
}

// Usage
const customer = new BrazilianCustomer();
customer.name = 'João Silva';
customer.cpf = '123.456.789-09'; // Formatted input
customer.cnpj = '12.345.678/0001-90'; // Formatted input
customer.cep = '01310-100'; // Formatted input
customer.email = 'joao@example.com';

await session.save(customer);

// After save (normalized in database):
// cpf: '12345678909'
// cnpj: '12345678000190'
// cep: '01310100'

// After load (formatted in application):
// cpf: '123.456.789-09'
// cnpj: '12.345.678/0001-90'
// cep: '01310-100'
```

### Complete Example: US Customer

```typescript
import { Entity, Column, PrimaryKey } from 'metal-orm';
import { SSN, ZIP } from 'metal-orm/validators';

@Entity({ autoTransform: true })
class USCustomer {
  @PrimaryKey({ type: 'INT' })
  id!: number;
  
  @Column({ type: 'VARCHAR', args: [100] })
  name!: string;
  
  @Column({ type: 'VARCHAR', args: [11] })
  @Trim()
  @SSN({ strict: true })
  ssn!: string;
  
  @Column({ type: 'VARCHAR', args: [10] })
  @Trim()
  @ZIP()
  zipCode!: string;
  
  @Column({ type: 'VARCHAR', args: [255] })
  @Email()
  email!: string;
}

// Usage
const customer = new USCustomer();
customer.name = 'John Doe';
customer.ssn = '123-45-6789'; // Formatted input
customer.zipCode = '12345-6789'; // Formatted input
customer.email = 'john@example.com';

await session.save(customer);

// After save (normalized in database):
// ssn: '123456789'
// zipCode: '123456789'

// After load (formatted in application):
// ssn: '123-45-6789'
// zipCode: '12345-6789'
```

## Success Criteria

The feature is considered complete when:

1. ✅ A `VALIDATOR_FACTORIES` registry exists and can register/unregister country validators
2. ✅ The public function `resolveValidator()` correctly resolves validators by country and type
3. ✅ At least three country validators (BR-CPF, BR-CNPJ, US-SSN) are implemented and pass all unit tests
4. ✅ Decorators `@CPF()`, `@CNPJ()`, `@CEP()`, `@SSN()`, `@ZIP()`, `@VAT()` work correctly
5. ✅ Auto-transform mode normalizes and formats identifiers correctly
6. ✅ Existing transformer tests continue to pass (no regressions)
7. ✅ Documentation and example usage are updated
8. ✅ The code follows the project's style conventions and passes linting

## Future Enhancements

1. **Additional country validators**
   - Argentina (CUIT/CUIL)
   - Mexico (RFC, CURP)
   - Spain (DNI, NIF)
   - France (SIRET, SIREN)
   - Germany (Steuernummer)
   - UK (National Insurance Number)
   - Canada (SIN)
   - Australia (TFN)
   - Japan (My Number)
   - China (Resident ID)

2. **Advanced features**
   - Batch validation
   - Async validation (for API-based validation)
   - Caching of validation results
   - Validation statistics and reporting

3. **Integration with other Metal ORM features**
   - Query filters by country identifier
   - Indexing strategies for country identifiers
   - Migration support for country identifier columns

## Conclusion

The country-specific identifier validation system provides a robust, extensible solution for validating and normalizing country-specific identifiers in Metal ORM. By following the same registry pattern as the inflection system, it maintains consistency with the existing codebase while providing powerful new capabilities for data validation and transformation.
