import { eq, gt, like, inList } from '../../../src/metal-orm/src/ast/expression';
import { Users, Orders, Profiles, Roles, UserRoles } from '../schema';
import { Scenario } from './types';

export const RELATIONSHIP_SCENARIOS: Scenario[] = [
    {
        id: 'smart_join',
        category: 'Relationships',
        title: 'Smart Join (1:N)',
        description: 'Using defined schema relationships to join tables automatically without manual ON clauses.',
        build: (qb) => qb
            .select({ user: Users.columns.name, total: Orders.columns.total })
            .joinRelation('orders')
            .where(gt(Orders.columns.total, 100))
    },
    {
        id: 'join',
        category: 'Relationships',
        title: 'Manual Join',
        description: 'Performing a manual INNER JOIN with explicit conditions.',
        build: (qb) => qb
            .select({ user: Users.columns.name, amount: Orders.columns.total, status: Orders.columns.status })
            .innerJoin(Orders, eq(Users.columns.id, Orders.columns.user_id))
            .where(eq(Orders.columns.status, 'completed'))
    },
    {
        id: 'profile_inspection',
        category: 'Relationships',
        title: 'Profile Inspection (1:1)',
        description: 'Join every user with their profile and filter by bio keywords.',
        build: (qb) => qb
            .select({
                user: Users.columns.name,
                bio: Profiles.columns.bio,
                twitter: Profiles.columns.twitter
            })
            .joinRelation('profiles')
            .where(like(Profiles.columns.bio, '%Engineer%'))
    },
    {
        id: 'role_filter',
        category: 'Relationships',
        title: 'Role-Based Filter (N:N)',
        description: 'Traverse the pivot table to surface admins and managers.',
        build: (qb) => qb
            .select({
                user: Users.columns.name,
                role: Roles.columns.name
            })
            .innerJoin(UserRoles, eq(UserRoles.columns.user_id, Users.columns.id))
            .innerJoin(Roles, eq(Roles.columns.id, UserRoles.columns.role_id))
            .where(inList(Roles.columns.name, ['admin', 'manager']))
            .orderBy(Users.columns.name, 'ASC')
    }
];
