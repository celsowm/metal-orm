import { eq, count, sum } from '../../../../../core/ast/expression';
import { createLiteral } from '../../../../../query-builder/select';
import { Users, Orders } from '../schema';
import { Scenario } from './types';

export const AGGREGATION_SCENARIOS = [
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
    },
    {
        id: 'revenue_by_role',
        category: 'Aggregation',
        title: 'Revenue by Role',
        description: 'Summing completed order totals and grouping the result by user role.',
        build: (qb) => qb
            .select({
                role: Users.columns.role,
                revenue: sum(Orders.columns.total)
            })
            .joinRelation('orders')
            .where(eq(Orders.columns.status, createLiteral('completed')))
            .groupBy(Users.columns.role)
            .orderBy(Users.columns.role, 'ASC')
    }
];
