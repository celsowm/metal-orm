import { expectTypeOf, describe, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import { defineTable } from '../../src/schema/table.js';
import { createEntityFromRow } from '../../src/orm/entity.js';
import { EntityContext } from '../../src/orm/entity-context.js';
import { EntityInstance, RelationMap } from '../../src/schema/types.js';

// Minimal fake EntityContext for typing assertions
const fakeCtx: EntityContext = {
  dialect: {} as any,
  executor: {} as any,
  getEntity: () => undefined,
  setEntity: () => {},
  trackNew: () => {},
  trackManaged: () => {},
  markDirty: () => {},
  markRemoved: () => {},
  registerRelationChange: () => {},
  getEntitiesForTable: () => [],
};

const Users = defineTable('users', {
  id: col.primaryKey(col.int()),
  birthday: col.date<Date>(),
  name: col.varchar(255),
});

type UserEntity = {
  id: number;
  birthday: Date;
  name: string;
  $load<K extends keyof RelationMap<typeof Users>>(relation: K): Promise<RelationMap<typeof Users>[K]>;
} & EntityInstance<typeof Users>;

describe('createEntityFromRow typing', () => {
  it('infers EntityInstance by default', () => {
    const user = createEntityFromRow(fakeCtx, Users, { id: 1, birthday: new Date(), name: 'Ada' });
    expectTypeOf(user.id).toMatchTypeOf<number>();
    expectTypeOf(user.birthday).toMatchTypeOf<Date>();
  });

  it('allows explicit TResult generic to avoid casts', () => {
    const user = createEntityFromRow<typeof Users, UserEntity>(fakeCtx, Users, {
      id: 1,
      birthday: new Date(),
      name: 'Ada',
    });

    expectTypeOf(user).toMatchTypeOf<UserEntity>();
  });

  it('accepts lazyRelations and preserves TResult', () => {
    const user = createEntityFromRow<typeof Users, UserEntity>(fakeCtx, Users, {
      id: 1,
      birthday: new Date(),
      name: 'Ada',
    }, []); // no relations but should still keep TResult

    expectTypeOf(user).toMatchTypeOf<UserEntity>();
  });
});


