import { Users } from '../schema.js';
import { createScenario } from './types.js';

export const BASIC_SCENARIOS = [
    createScenario({
        id: 'basic',
        category: 'Basics',
        title: 'Hello World',
        description: 'A basic projection query fetching specific columns from the Users table.',
        build: (qb) => qb.select({ id: Users.columns.id, name: Users.columns.name }).limit(5)
    }),
    createScenario({
        id: 'aliased_projection',
        category: 'Basics',
        title: 'Aliased Projection',
        description: 'Expose friendly aliases when projecting columns for DTOs.',
        build: (qb) => qb
            .select({
                userId: Users.columns.id,
                userName: Users.columns.name,
                userRole: Users.columns.role
            })
            .limit(4)
    })
];
