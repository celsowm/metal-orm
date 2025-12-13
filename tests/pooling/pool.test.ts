import { describe, expect, it, vi } from 'vitest';

import { Pool } from '../../src/core/execution/pooling/pool.js';

describe('Pool', () => {
    it('acquires and releases resources', async () => {
        let nextId = 0;
        const destroy = vi.fn(async () => { });

        const pool = new Pool(
            {
                create: async () => ({ id: ++nextId }),
                destroy,
            },
            { max: 2, idleTimeoutMillis: 1_000 }
        );

        const a = await pool.acquire();
        const b = await pool.acquire();
        expect(a.resource.id).toBe(1);
        expect(b.resource.id).toBe(2);

        await a.release();
        await b.release();

        await pool.destroy();
        expect(destroy).toHaveBeenCalled();
    });
});

