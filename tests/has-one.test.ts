import { describe, expect, it } from 'vitest';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { hydrateRows } from '../src/orm/hydration.js';
import { OrmContext, DbExecutor } from '../src/orm/orm-context.js';
import { createEntityFromRow } from '../src/orm/entity.js';
import { SqliteDialect } from '../src/core/dialect/sqlite/index.js';
import type { HasOneReference } from '../src/schema/types.js';
import { Users, Profiles } from './fixtures/schema.ts';

describe('has-one relations', () => {
  it('hydrates the relation as a single object', () => {
    const builder = new SelectQueryBuilder(Users)
      .select({
        id: Users.columns.id,
        name: Users.columns.name
      })
      .include('profile', {
        columns: ['id', 'user_id', 'bio', 'twitter']
      });

    const plan = builder.getHydrationPlan();
    if (!plan) {
      throw new Error('Hydration plan should exist for has-one include');
    }

    const rows = [{
      id: 1,
      name: 'Alice',
      profile__id: 101,
      profile__user_id: 1,
      profile__bio: 'Curator',
      profile__twitter: '@alice'
    }];

    const hydrated = hydrateRows(rows, plan);
    expect(hydrated).toHaveLength(1);
    expect(Array.isArray(hydrated[0].profile)).toBe(false);
    expect(hydrated[0].profile).toEqual({
      id: 101,
      user_id: 1,
      bio: 'Curator',
      twitter: '@alice'
    });
  });

  it('reuses hydration data when accessing has-one via the ORM', async () => {
    const executed: string[] = [];
    const executor: DbExecutor = {
      async executeSql(sql) {
        executed.push(sql);
        return [];
      }
    };

    const ctx = new OrmContext({
      dialect: new SqliteDialect(),
      executor
    });

    const row = {
      id: 2,
      name: 'Bob',
      role: 'editor',
      settings: '{}',
      deleted_at: null,
      profile: {
        id: 202,
        user_id: 2,
        bio: 'Writes docs',
        twitter: '@bob'
      }
    };

    const user = createEntityFromRow(ctx, Users, row);
    const profileRef = user.profile as HasOneReference<any>;
    expect(profileRef.get()?.id).toBe(202);

    const profile = await profileRef.load();
    expect(profile?.bio).toBe('Writes docs');
    expect(executed).toHaveLength(0);
  });
});
