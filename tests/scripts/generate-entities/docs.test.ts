import { describe, expect, it } from 'vitest';

const { renderEntityFile } = await import('../../../scripts/generate-entities.mjs');

describe('generate-entities docs', () => {
  it('emits @defaultValue and @remarks metadata', () => {
    const schema = {
      tables: [
        {
          name: 'users',
          columns: [
            { name: 'id', type: 'int', notNull: true, autoIncrement: true },
            { name: 'token', type: 'uuid', default: 'uuid_generate_v4()', notNull: true },
            { name: 'created_at', type: 'timestamp', default: 'now()', notNull: true }
          ],
          primaryKey: ['id']
        },
        {
          name: 'profiles',
          columns: [
            { name: 'id', type: 'int', notNull: true },
            {
              name: 'user_id',
              type: 'int',
              references: { table: 'users', column: 'id', onDelete: 'CASCADE', onUpdate: 'NO ACTION' }
            }
          ],
          primaryKey: ['id']
        }
      ]
    };

    const output = renderEntityFile(schema, {});

    expect(output).toContain('@defaultValue uuid_generate_v4()');
    expect(output).toContain('@defaultValue now()');
    expect(output).toContain('@remarks Auto-increment identity column');
    expect(output).toContain('@remarks References users.id (on delete CASCADE, on update NO ACTION)');
  });
});
