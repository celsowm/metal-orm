import { eq } from '@orm/ast/expression';
import { Users } from '../schema';
import { Scenario } from './types';

export const HYDRATION_SCENARIOS: Scenario[] = [
    {
        id: 'user_with_orders',
        category: 'Hydration',
        title: 'Nested User Graph',
        description: 'Eager-load orders for a single user and hydrate a JSON graph from flat SQL rows.',
        build: (qb) => qb
            .include('orders', { columns: ['id', 'total', 'status', 'user_id'] })
            .where(eq(Users.columns.id, 1))
    }
];
