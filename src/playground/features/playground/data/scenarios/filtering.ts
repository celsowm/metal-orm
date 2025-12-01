import { eq, and, or, gt, like, jsonPath, isNull, isNotNull, inList } from '../../../../../ast/expression';
import { createLiteral } from '../../../../../builder/select';
import { Users, Orders } from '../schema';
import { createScenario } from './types';

export const FILTERING_SCENARIOS = [
    createScenario({
        id: 'filter_basic',
        category: 'Filtering',
        title: 'Active Admins',
        description: 'Filtering records using a WHERE clause with type-safe operators.',
        build: (qb) => qb
            .select({ name: Users.columns.name, role: Users.columns.role })
            .where(eq(Users.columns.role, createLiteral('admin')))
    }),
    createScenario({
        id: 'search',
        category: 'Filtering',
        title: 'Text Search (LIKE)',
        description: 'Using pattern matching to find users starting with "Alice".',
        build: (qb) => qb
            .select({ name: Users.columns.name, role: Users.columns.role })
            .where(like(Users.columns.name, 'Alice%'))
    }),
    createScenario({
        id: 'json_filter',
        category: 'Filtering',
        title: 'JSON Extract',
        description: 'Extracting values from JSON columns using dialect-specific syntax.',
        build: (qb) => qb
            .select({ name: Users.columns.name, settings: Users.columns.settings })
            .where(eq(jsonPath(Users.columns.settings, '$.theme'), createLiteral('dark')))
    }),
    createScenario({
        id: 'advanced_filter',
        category: 'Filtering',
        title: 'Nulls & Lists',
        description: 'Advanced filtering using IN(...) clause and IS NULL checks.',
        build: (qb) => qb
            .select({ name: Users.columns.name, role: Users.columns.role })
            .where(
                and(
                    inList(Users.columns.role, ['admin', 'manager']),
                    isNull(Users.columns.deleted_at)
                )
            )
    }),
    createScenario({
        id: 'complex_filter',
        category: 'Filtering',
        title: 'Logical Groups',
        description: 'Using Nested AND/OR to filter for Admins OR users with specific ID.',
        build: (qb) => qb
            .select({ name: Users.columns.name, role: Users.columns.role })
            .where(
                or(
                    eq(Users.columns.role, createLiteral('admin')),
                    and(
                        eq(Users.columns.role, createLiteral('user')),
                        eq(Users.columns.id, createLiteral(2))
                    )
                )
            )
    }),
    createScenario({
        id: 'soft_deleted_users',
        category: 'Filtering',
        title: 'Soft Deleted Users',
        description: 'Reveal users that were soft-deleted via a non-null deleted_at.',
        build: (qb) => qb
            .select({ name: Users.columns.name, deletedAt: Users.columns.deleted_at })
            .where(isNotNull(Users.columns.deleted_at))
    }),
    createScenario({
        id: 'high_value_admins',
        category: 'Filtering',
        title: 'High Value Admins',
        description: 'Filter admins with completed orders exceeding 200 via a joined WHERE clause.',
        build: (qb) => qb
            .select({
                name: Users.columns.name,
                role: Users.columns.role,
                total: Orders.columns.total
            })
            .joinRelation('orders')
            .where(
                and(
                    eq(Users.columns.role, createLiteral('admin')),
                    gt(Orders.columns.total, createLiteral(200)),
                    eq(Orders.columns.status, createLiteral('completed'))
                )
            )
    })
];
