import { SelectQueryBuilder, createColumn, createLiteral } from '../../src/metal-orm/src/builder/select';
import { eq, count, and, or, gt, isNull, inList, like, jsonPath } from '../../src/metal-orm/src/ast/expression';
import { Users, Orders } from './schema';

export interface Scenario {
    id: string;
    title: string;
    description: string;
    category: string;
    build: (builder: SelectQueryBuilder<any>) => SelectQueryBuilder<any>;
}

const Basics: Scenario[] = [
    {
        id: 'basic',
        category: 'Basics',
        title: 'Hello World',
        description: 'A basic projection query fetching specific columns from the Users table.',
        build: (qb) => qb.select({ id: Users.columns.id, name: Users.columns.name }).limit(5)
    }
];

const Filtering: Scenario[] = [
    {
        id: 'filter_basic',
        category: 'Filtering',
        title: 'Active Admins',
        description: 'Filtering records using a WHERE clause with type-safe operators.',
        build: (qb) => qb
            .select({ name: Users.columns.name, role: Users.columns.role })
            .where(eq(Users.columns.role, createLiteral('admin')))
    },
    {
        id: 'search',
        category: 'Filtering',
        title: 'Text Search (LIKE)',
        description: 'Using pattern matching to find users starting with "Alice".',
        build: (qb) => qb
            .select({ name: Users.columns.name, role: Users.columns.role })
            .where(like(Users.columns.name, 'Alice%'))
    },
    {
        id: 'json_filter',
        category: 'Filtering',
        title: 'JSON Extract',
        description: 'Extracting values from JSON columns using dialect-specific syntax.',
        build: (qb) => qb
            .select({ name: Users.columns.name, settings: Users.columns.settings })
            .where(eq(jsonPath(Users.columns.settings, '$.theme'), createLiteral('dark')))
    },
    {
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
    },
    {
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
    }
];

const Relationships: Scenario[] = [
    {
        id: 'smart_join',
        category: 'Relationships',
        title: 'Smart Join (1:N)',
        description: 'Using defined schema relationships to join tables automatically without manual ON clauses.',
        build: (qb) => qb
            .select({ user: Users.columns.name, total: Orders.columns.total })
            .joinRelation('orders')
            .where(gt(Orders.columns.total, createLiteral(100)))
    },
    {
        id: 'join',
        category: 'Relationships',
        title: 'Manual Join',
        description: 'Performing a manual INNER JOIN with explicit conditions.',
        build: (qb) => qb
            .select({ user: Users.columns.name, amount: Orders.columns.total, status: Orders.columns.status })
            .innerJoin(Orders, eq(Users.columns.id, Orders.columns.user_id))
            .where(eq(Orders.columns.status, createLiteral('completed')))
    }
];

const Aggregation: Scenario[] = [
    {
        id: 'analytics',
        category: 'Aggregation',
        title: 'Sales Analytics',
        description: 'Aggregating sales data using GROUP BY and sorting with ORDER BY DESC.',
        build: (qb) => qb
            .select({
                user: Users.columns.name,
                orderCount: count(Orders.columns.id)
            })
            .joinRelation('orders')
            .groupBy(Users.columns.name)
            .orderBy(Users.columns.name, 'DESC')
    }
];

const Pagination: Scenario[] = [
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

export const SCENARIOS: Scenario[] = [
    ...Basics,
    ...Filtering,
    ...Relationships,
    ...Aggregation,
    ...Pagination
];
