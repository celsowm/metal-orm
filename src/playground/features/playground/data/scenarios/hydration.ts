import { eq } from '../../../../../core/ast/expression';
import { Users } from '../schema';
import { createScenario } from './types';

export const HYDRATION_SCENARIOS = [
    createScenario({
        id: 'user_with_orders',
        category: 'Hydration',
        title: 'Nested User Graph',
        description: 'Eager-load orders for a single user and hydrate a JSON graph from flat SQL rows.',
        build: (qb) => qb
            .include('orders', { columns: ['id', 'total', 'status', 'user_id'] })
            .where(eq(Users.columns.id, 1))
    }),
    createScenario({
        id: 'user_projects_with_pivot',
        category: 'Hydration',
        title: 'Projects with Pivot Data',
        description: 'Include projects for a user along with pivot metadata stored in `_pivot`.',
        build: (qb) => qb
            .include('projects', {
                columns: ['id', 'name', 'client'],
                pivot: { columns: ['assigned_at', 'role_id'] }
            })
            .where(eq(Users.columns.id, 1))
    })
];
