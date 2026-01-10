/**
 * DTO (Data Transfer Object) module for metal-orm.
 *
 * Provides type utilities and runtime helpers for building REST APIs
 * with automatic DTO generation from entity/table definitions.
 *
 * @example
 * ```ts
 * import { Dto, WithRelations, CreateDto, UpdateDto, SimpleWhereInput, applyFilter } from 'metal-orm/dto';
 *
 * // Response DTOs - exclude sensitive fields
 * type UserResponse = Dto<typeof User, 'passwordHash'>;
 * type PostResponse = Dto<typeof Post, 'authorId'>;
 *
 * // Compose with relations
 * type UserWithPosts = WithRelations<UserResponse, { posts: PostResponse[] }>;
 *
 * // Input DTOs
 * type CreateUserDto = CreateDto<typeof User>;
 * type UpdateUserDto = UpdateDto<typeof User>;
 *
 * // Filters - restrict to specific fields
 * type UserFilter = SimpleWhereInput<typeof User, 'name' | 'email'>;
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
