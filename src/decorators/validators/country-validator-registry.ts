import type { CountryValidator, CountryValidatorFactory } from './country-validators.js';

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
