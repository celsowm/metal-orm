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
 * import { Dto, WithRelations, CreateDto, UpdateDto, SimpleWhereInput, applyFilter, PagedResponse, toPagedResponse } from 'metal-orm/dto';
 *
 * // Using Entity classes
 * type UserResponse = Dto<User, 'passwordHash'>;
 * type PostResponse = Dto<Post, 'authorId'>;
 * type UserWithPosts = WithRelations<UserResponse, { posts: PostResponse[] }>;
 * type CreateUserDto = CreateDto<User>;
 * type UpdateUserDto = UpdateDto<User>;
 * type UserFilter = SimpleWhereInput<User, 'name' | 'email'>;
 *
 * // Enhanced pagination
 * type UsersPagedResponse = PagedResponse<UserResponse>;
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
 *
 * // Apply enhanced pagination
 * const basic = await qb.executePaged(session, { page: 2, pageSize: 20 });
 * const response = toPagedResponse(basic);
 * // → { items: [...], totalItems: 150, page: 2, pageSize: 20,
 * //     totalPages: 8, hasNextPage: true, hasPrevPage: true }
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
  UpdateDto,
  PagedResponse
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

// Pagination utilities
export {
  toPagedResponse,
  toPagedResponseBuilder,
  calculateTotalPages,
  hasNextPage as hasNextPageMeta,
  hasPrevPage as hasPrevPageMeta,
  computePaginationMetadata
} from './pagination-utils.js';

// OpenAPI 3.1 Schema generation
export * from './openapi/index.js';
