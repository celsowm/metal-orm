import { describe, it, expect } from 'vitest';

const { renderEntityFile } = await import('../../../scripts/generate-entities.mjs');

describe('generate-entities hasOne detection', () => {
  it('emits @HasOne when foreign key is uniquely constrained', () => {
    const schema = {
      tables: [
        {
          name: 'users',
          columns: [{ name: 'id', type: 'int', notNull: true }],
          primaryKey: ['id']
        },
        {
          name: 'profiles',
          columns: [
            { name: 'id', type: 'int', notNull: true },
            {
              name: 'user_id',
              type: 'int',
              references: { table: 'users', column: 'id' }
            }
          ],
          primaryKey: ['id'],
          indexes: [{ name: 'profiles_user_id_unique', unique: true, columns: [{ column: 'user_id' }] }]
        }
      ]
    };

    const out = renderEntityFile(schema, {});

    expect(out).toContain("import { col, Entity, Column, PrimaryKey, HasOne, BelongsTo, HasOneReference, bootstrapEntities, getTableDefFromEntity } from 'metal-orm';");
    expect(out).toContain("@BelongsTo({ target: () => User, foreignKey: 'user_id' })");
    expect(out).toContain("@HasOne({ target: () => Profile, foreignKey: 'user_id' })");
    expect(out).toContain('profile!: HasOneReference<Profile>;');
    expect(out).not.toContain('profiles!: HasManyCollection<Profile>;');
  });

  it('keeps @HasMany when foreign key is not unique', () => {
    const schema = {
      tables: [
        {
          name: 'users',
          columns: [{ name: 'id', type: 'int', notNull: true }],
          primaryKey: ['id']
        },
        {
          name: 'posts',
          columns: [
            { name: 'id', type: 'int', notNull: true },
            {
              name: 'user_id',
              type: 'int',
              references: { table: 'users', column: 'id' }
            }
          ],
          primaryKey: ['id']
        }
      ]
    };

    const out = renderEntityFile(schema, {});

    expect(out).toContain("import { col, Entity, Column, PrimaryKey, HasMany, BelongsTo, HasManyCollection, bootstrapEntities, getTableDefFromEntity } from 'metal-orm';");
    expect(out).toContain("@HasMany({ target: () => Post, foreignKey: 'user_id' })");
    expect(out).toContain('posts!: HasManyCollection<Post>;');
    expect(out).not.toContain('@HasOne({ target: () => Post, foreignKey: \'user_id\' })');
  });
});
