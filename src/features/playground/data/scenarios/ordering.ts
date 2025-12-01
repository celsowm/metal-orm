import { eq } from '../../../../metal-orm/src/ast/expression';
import { createLiteral } from '../../../../metal-orm/src/builder/select';
import { Users, Orders } from '../schema';
import { Scenario } from './types';

export const ORDERING_SCENARIOS: Scenario[] = [
    {
        id: 'order_recent_completed',
        category: 'Ordering',
        title: 'Order by Completed Total',
        description: 'Sort completed orders first by total (DESC) then by user name (ASC).',
        build: (qb) => qb
            .select({
                user: Users.columns.name,
                status: Orders.columns.status,
                total: Orders.columns.total
            })
            .joinRelation('orders')
            .where(eq(Orders.columns.status, createLiteral('completed')))
            .orderBy(Orders.columns.total, 'DESC')
            .orderBy(Users.columns.name, 'ASC')
            .limit(5)
    }
];
