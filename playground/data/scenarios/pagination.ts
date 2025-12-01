import { Users } from '../schema';
import { Scenario } from './types';

export const PAGINATION_SCENARIOS: Scenario[] = [
    {
        id: 'pagination',
        category: 'Pagination',
        title: 'Pagination Strategy',
        description: 'Handling large datasets efficiently with LIMIT and OFFSET.',
        build: (qb) => qb
            .select({ id: Users.columns.id, name: Users.columns.name })
            .limit(2)
            .offset(1)
    }
];
