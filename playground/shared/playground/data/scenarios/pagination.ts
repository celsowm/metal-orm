import { Users } from '../schema.js';
import { Scenario } from './types.js';

export const PAGINATION_SCENARIOS: Scenario[] = [
    {
        id: 'pagination',
        category: 'Pagination',
        title: 'Basic Pagination',
        description: 'Implement basic pagination with LIMIT and OFFSET.',
        build: (qb) => qb
            .select({ name: Users.columns.name, role: Users.columns.role })
            .orderBy(Users.columns.name, 'ASC')
            .limit(2)
            .offset(1)
    }
];
