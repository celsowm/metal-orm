# DTO (Data Transfer Objects)

MetalORM provides a comprehensive DTO module for building REST APIs with type-safe data transfer between layers. The DTO system integrates with the query builder, ORM runtime, and OpenAPI 3.1 schema generation.

## Core DTO Types

The DTO module provides four primary types for different operations:

```typescript
import { Dto, CreateDto, UpdateDto, WithRelations } from 'metal-orm/dto';
```

### Response DTOs

Use `Dto<T, TExclude>` to create response types that exclude sensitive fields:

```typescript
import { Dto } from 'metal-orm/dto';
import { usersTable } from './schema';

type UserResponse = Dto<typeof usersTable, 'passwordHash' | 'refreshToken'>;
// Result: { id: number; name: string; email: string; createdAt: Date; ... }
```

The second type parameter accepts field names to exclude from the response. This is ideal for hiding passwords, tokens, and internal IDs.

### Create DTOs

Use `CreateDto<T>` for insert operations. Auto-increment and computed columns are automatically excluded:

```typescript
import { CreateDto } from 'metal-orm/dto';
import { usersTable } from './schema';

type CreateUserDto = CreateDto<typeof usersTable>;
// Result: { name: string; email: string; bio?: string; ... }
// (id, createdAt, updatedAt are excluded if they are auto-generated)
```

### Update DTOs

Use `UpdateDto<T>` for partial updates. All fields become optional:

```typescript
import { UpdateDto } from 'metal-orm/dto';
import { usersTable } from './schema';

type UpdateUserDto = UpdateDto<typeof usersTable>;
// Result: { name?: string; email?: string; bio?: string; ... }
// (all fields are optional for PATCH semantics)
```

### DTOs with Relations

Use `WithRelations<TBase, TRelations>` to compose DTOs with nested relations:

```typescript
import { Dto, WithRelations } from 'metal-orm/dto';
import { usersTable, postsTable } from './schema';

type UserResponse = Dto<typeof usersTable, 'passwordHash'>;
type PostResponse = Dto<typeof postsTable, 'content'>;

type UserWithPosts = WithRelations<UserResponse, { posts: PostResponse[] }>;
// Result: UserResponse + { posts: PostResponse[] }
```

## Filter Types

MetalORM provides rich filter types for building query APIs:

```typescript
import { WhereInput, SimpleWhereInput, StringFilter, NumberFilter, BooleanFilter, DateFilter } from 'metal-orm/dto';
```

### WhereInput

Full filter type with all columns available:

```typescript
type UserFilter = WhereInput<typeof usersTable>;
// Supports: { name?: StringFilter; age?: NumberFilter; ... }
```

### SimpleWhereInput

Restricts filters to specific columns:

```typescript
type SimpleUserFilter = SimpleWhereInput<typeof usersTable, 'name' | 'email'>;
// Only supports: { name?: StringFilter; email?: StringFilter; }
```

### Column Filter Types

| Type | Operators |
|------|-----------|
| `StringFilter` | `equals`, `not`, `in`, `contains`, `startsWith`, `endsWith`, `mode` |
| `NumberFilter` | `equals`, `not`, `in`, `lt`, `lte`, `gt`, `gte` |
| `BooleanFilter` | `equals`, `not` |
| `DateFilter` | `equals`, `in`, `lt`, `lte`, `gt`, `gte` |

### Example Filter Request

```typescript
const filter: WhereInput<typeof usersTable> = {
  name: { contains: 'john', mode: 'insensitive' },
  email: { endsWith: '@example.com' },
  age: { gte: 18, lte: 65 },
  isActive: { equals: true },
};
```

## Applying Filters

Use `applyFilter()` to convert filter objects into SQL:

```typescript
import { selectFromEntity, applyFilter, WhereInput } from 'metal-orm/dto';
import { User } from './entities';

async function findUsers(db, filter: WhereInput<typeof User.table>) {
  let query = selectFromEntity(User);
  query = applyFilter(query, User.table, filter);
  return query.execute(db);
}
```

**Request:**
```json
{
  "name": { "contains": "john" },
  "email": { "endsWith": "@gmail.com" }
}
```

**Generated SQL:**
```sql
WHERE name LIKE '%john%' AND email LIKE '%@gmail.com'
```

## Transformation Utilities

The transform module provides helpers for DTO operations:

```typescript
import { toResponse, toResponseBuilder, withDefaults, exclude, pick, mapFields } from 'metal-orm/dto';
```

### Converting to Response DTOs

```typescript
const user = { id: 1, name: 'John', passwordHash: 'xxx', email: 'john@test.com' };
const response = toResponse(user, ['passwordHash']);
// Result: { id: 1, name: 'John', email: 'john@test.com' }
```

### Curried Response Builder

```typescript
const buildResponse = toResponseBuilder(['passwordHash', 'createdAt']);
const response = buildResponse(user);
```

### Merging Defaults

```typescript
const dto = { name: 'John' };
const withDefaults = withDefaults(dto, { isActive: true, role: 'user' });
// Result: { name: 'John', isActive: true, role: 'user' }
```

### Field Selection

```typescript
const user = { id: 1, name: 'John', email: 'john@test.com', age: 30 };
const picked = pick(user, 'id', 'name');
// Result: { id: 1, name: 'John' }

const excluded = exclude(user, 'age');
// Result: { id: 1, name: 'John', email: 'john@test.com' }
```

### Field Mapping

```typescript
const dto = { user_id: 1, user_name: 'John' };
const mapped = mapFields(dto, { user_id: 'id', user_name: 'name' });
// Result: { id: 1, name: 'John' }
```

## Pagination

MetalORM provides utilities for paginated responses:

```typescript
import { PagedResponse, toPagedResponse, calculateTotalPages, hasNextPage, hasPrevPage } from 'metal-orm/dto';
```

### PagedResponse Type

```typescript
type PagedResponse<T> = {
  items: T[];
  totalItems: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
};
```

### Converting to Paged Response

```typescript
const result = await selectFrom(users)
  .select({ id: users.columns.id, name: users.columns.name })
  .executePaged(session, { page: 1, pageSize: 20 });

const response = toPagedResponse(result, 1, 20);
// Result: PagedResponse<...>
```

### Pagination Utilities

```typescript
const totalPages = calculateTotalPages(100, 20); // 5
const next = hasNextPage(1, 100, 20); // true
const prev = hasPrevPage(1); // false
```

## OpenAPI 3.1 Schema Generation

MetalORM provides comprehensive OpenAPI 3.1 schema generation from your table definitions. See the [OpenAPI Schema Generation](./openapi.md) guide for complete documentation.

```typescript
import { dtoToOpenApiSchema, createDtoToOpenApiSchema, updateDtoToOpenApiSchema } from 'metal-orm/dto/openapi';

const userResponse = dtoToOpenApiSchema(usersTable, ['passwordHash']);
const createSchema = createDtoToOpenApiSchema(usersTable);
const updateSchema = updateDtoToOpenApiSchema(usersTable);
```

**Features include:**
- Response, Create, and Update DTO schemas
- Filter input schemas with operators
- Pagination request/response schemas
- Nested relation schemas with depth control
- Reusable component schema generation
- Complete OpenAPI document generation

## Integration with Express/Fastify

Here's a complete example integrating DTOs with a REST API:

```typescript
import { expressMiddleware } from 'metal-orm/dto';
import { applyFilter, toPagedResponse, dtoToOpenApiSchema } from 'metal-orm/dto';

app.get('/users', async (req, res) => {
  const { page = 1, pageSize = 20, ...filter } = req.query;

  const result = await selectFrom(usersTable)
    .select({ id: true, name: true, email: true })
    .orderBy(usersTable.columns.name)
    .executePaged(db, { page: Number(page), pageSize: Number(pageSize) });

  const response = toPagedResponse(result, Number(page), Number(pageSize));
  res.json(response);
});

app.get('/users/:id', async (req, res) => {
  const user = await selectFrom(usersTable)
    .select({ id: true, name: true, email: true })
    .where(eq(usersTable.columns.id, req.params.id))
    .executeTakeFirst(db);

  res.json(user);
});

app.post('/users', async (req, res) => {
  const createDto = req.body as CreateDto<typeof usersTable>;
  const user = await insertInto(usersTable)
    .values(createDto)
    .returning()
    .executeTakeFirst(db);

  const response = toResponse(user, ['passwordHash']);
  res.status(201).json(response);
});
```

## Module Exports

The complete module exports:

```typescript
// Core types
export { Dto, CreateDto, UpdateDto, WithRelations, PagedResponse };

// Filter types
export { WhereInput, SimpleWhereInput, StringFilter, NumberFilter, BooleanFilter, DateFilter };

// Runtime helpers
export { applyFilter };

// Transform utilities
export { toResponse, toResponseBuilder, withDefaults, withDefaultsBuilder, exclude, pick, mapFields };

// Pagination
export { toPagedResponse, toPagedResponseBuilder, calculateTotalPages, hasNextPage, hasPrevPage };

// OpenAPI
export * from './openapi/index.js';

## See Also

- [OpenAPI Schema Generation](./openapi.md) - Complete guide to generating OpenAPI 3.1 documentation
