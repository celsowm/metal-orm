import { describe, it } from 'vitest';
import { defineTable } from '../src/schema/table.js';
import { col } from '../src/schema/column-types.js';
import { SelectQueryBuilder } from '../src/query-builder/select.js';
import { jsonSet } from '../src/core/functions/json.ts';

describe('Type Safety Improvements', () => {
    it('should have better types for JSON functions', () => {
        const users = defineTable('users', {
            id: col.primaryKey(col.int()),
            data: col.json()
        });

        const expr = jsonSet<number>(users.columns.data, '$.score', 10);
        // This is mostly a compile-time test
    });

    it('should enforce compatible types in set operations', () => {
        const t1 = defineTable('t1', { id: col.int(), name: col.varchar(255) });
        const q1 = new SelectQueryBuilder(t1).select('id', 'name');

        // This should pass if types are compatible
        q1.union(q1);
    });

    it('should have generic hooks', () => {
        interface MyEntity { id: number; name: string; }
        interface MyContext { userId: number; }

        const table = defineTable<any, MyEntity, MyContext>('users',
            { id: col.int() },
            {},
            {
                beforeInsert: (ctx, entity) => {
                    // ctx should be MyContext, entity should be MyEntity
                    const x: MyEntity = entity;
                    const y: MyContext = ctx;
                }
            }
        );
    });
});
