/**
 * DTO (Data Transfer Object) module for metal-orm.
 *
 * Provides type utilities and runtime helpers for building REST APIs
 * with automatic DTO generation from entity/table definitions.
 *
 * Supports both TableDef and Entity classes as type sources.
 *
 * @example
 * ```ts
 * import { Dto, WithRelations, CreateDto, UpdateDto, SimpleWhereInput, applyFilter } from 'metal-orm/dto';
 *
 * // Using Entity classes
 * type UserResponse = Dto<User, 'passwordHash'>;
 * type PostResponse = Dto<Post, 'authorId'>;
 * type UserWithPosts = WithRelations<UserResponse, { posts: PostResponse[] }>;
 * type CreateUserDto = CreateDto<User>;
 * type UpdateUserDto = UpdateDto<User>;
 * type UserFilter = SimpleWhereInput<User, 'name' | 'email'>;
 *
 * // Using TableDef directly
 * type UserResponse = Dto<typeof UserTable, 'passwordHash'>;
 * type PostResponse = Dto<typeof PostTable, 'authorId'>;
 * type UserWithPosts = WithRelations<UserResponse, { posts: PostResponse[] }>;
 * type CreateUserDto = CreateDto<typeof UserTable>;
 * type UpdateUserDto = UpdateDto<typeof UserTable>;
 * type UserFilter = SimpleWhereInput<typeof UserTable, 'name' | 'email'>;
 *
 * // Apply filter in controller
 * let query = selectFromEntity(User);
 * query = applyFilter(query, User, where);
 * ```
 *
 * @packageDocumentation
 */

// DTO type utilities
export type {
  Simplify,
  Dto,
  WithRelations,
  CreateDto,
  UpdateDto
} from './dto-types.js';

// Filter types
export type {
  StringFilter,
  NumberFilter,
  BooleanFilter,
  DateFilter,
  FieldFilter,
  WhereInput,
  SimpleWhereInput,
  FilterOperator,
  FilterValue
} from './filter-types.js';

// Runtime filter application
export {
  applyFilter,
  buildFilterExpression
} from './apply-filter.js';

// Transformation utilities
export {
  toResponse,
  toResponseBuilder,
  withDefaults,
  withDefaultsBuilder,
  exclude,
  pick,
  mapFields
} from './transform.js';
