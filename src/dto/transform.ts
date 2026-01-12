/**
 * DTO transformation utilities for working with DTO instances.
 *
 * These helpers make it easier to convert between DTO types, apply defaults,
 * and handle auto-generated fields without manual object construction.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Transform utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Transforms a CreateDto or UpdateDto into a ResponseDto by merging with auto-generated fields.
 *
 * @example
 * ```ts
 * const newUser: UserResponse = toResponse(body, {
 *   id: newId,
 *   createdAt: new Date().toISOString()
 * });
 *
 * // Or use the curried form for reuse
 * const createUserResponse = toResponseBuilder<UserCreateDto, UserResponse>({
 *   id: () => nextId++,
 *   createdAt: () => new Date().toISOString()
 * });
 * const user = createUserResponse(body);
 * ```
 */
export function toResponse<TInput, TOutput>(
  input: TInput,
  autoFields: Partial<TOutput>
): TOutput {
  return {
    ...input,
    ...autoFields
  } as unknown as TOutput;
}

/**
 * Creates a toResponse function with pre-configured auto-fields.
 * Useful for reusing same transformation logic across multiple endpoints.
 *
 * @example
 * ```ts
 * const userResponseBuilder = toResponseBuilder<CreateUserDto, UserResponse>({
 *   id: () => generateId(),
 *   createdAt: () => new Date().toISOString(),
 *   active: true
 * });
 *
 * app.post('/users', (req, res) => {
 *   const user = userResponseBuilder(req.body);
 *   res.status(201).json(user);
 * });
 * ```
 */
export function toResponseBuilder<TInput, TOutput>(
  autoFields: Partial<TOutput> | (() => Partial<TOutput>)
): (input: TInput) => TOutput {
  return (input: TInput) => {
    const fields: Partial<TOutput> =
      typeof autoFields === 'function' ? (autoFields as () => Partial<TOutput>)() : autoFields;
    return {
      ...input,
      ...fields
    } as unknown as TOutput;
  };
}

/**
 * Merges default values into a DTO. Returns a complete object with all defaults applied.
 *
 * @example
 * ```ts
 * const user = withDefaults(body, {
 *   active: true,
 *   createdAt: new Date().toISOString()
 * });
 * ```
 */
export function withDefaults<T>(dto: Partial<T>, defaults: T): T {
  return {
    ...defaults,
    ...dto
  };
}

/**
 * Creates a withDefaults function with pre-configured defaults.
 *
 * @example
 * ```ts
 * const userWithDefaults = withDefaultsBuilder<CreateUserDto>({
 *   active: true
 * });
 *
 * app.post('/users', (req, res) => {
 *   const userInput = userWithDefaults(req.body);
 *   // ...
 * });
 * ```
 */
export function withDefaultsBuilder<T>(
  defaults: T | (() => T)
): (dto: Partial<T>) => T {
  return (dto: Partial<T>) => {
    const resolvedDefaults: T =
      typeof defaults === 'function' ? (defaults as () => T)() : defaults;
    return {
      ...resolvedDefaults,
      ...dto
    };
  };
}

/**
 * Excludes specified fields from an object. Useful for removing sensitive fields
 * from database results before sending to the client.
 *
 * @example
 * ```ts
 * const userFromDb = await db.select().from(users).where(...).first();
 * const userResponse = exclude(userFromDb, 'passwordHash', 'apiKey');
 * ```
 */
export function exclude<T extends object, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Omit<T, K> {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
}

/**
 * Picks only specified fields from an object. Useful for creating DTOs from
 * larger database entities.
 *
 * @example
 * ```ts
 * const userFromDb = await db.select().from(users).where(...).first();
 * const userResponse = pick(userFromDb, 'id', 'name', 'email');
 * ```
 */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  ...keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = obj[key];
  }
  return result;
}

/**
 * Maps field names from one DTO to another. Useful when your DTO has different
 * field names than your entity (e.g., camelCase vs snake_case).
 *
 * @example
 * ```ts
 * type ApiUser = { firstName: string; lastName: string };
 * type DbUser = { first_name: string; last_name: string };
 *
 * const dbUser = mapFields(apiUser, {
 *   firstName: 'first_name',
 *   lastName: 'last_name'
 * });
 * ```
 */
export function mapFields<T extends object>(
  obj: T,
  fieldMap: Partial<Record<keyof T, string>>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const keys = Object.keys(fieldMap) as (keyof T)[];
  for (const sourceKey of keys) {
    const targetKey = fieldMap[sourceKey];
    if (targetKey) {
      result[targetKey] = obj[sourceKey];
    }
  }
  // Copy any unmapped fields
  for (const [key, value] of Object.entries(obj)) {
    if (!(key in fieldMap)) {
      result[key] = value;
    }
  }
  return result;
}
