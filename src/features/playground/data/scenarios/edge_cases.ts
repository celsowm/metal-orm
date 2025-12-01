import { eq, and, or, inList, jsonPath, isNull } from '../../../../metal-orm/src/ast/expression';
import { createLiteral } from '../../../../metal-orm/src/builder/select';
import { Users } from '../schema';
import { Scenario } from './types';

export const EDGE_CASE_SCENARIOS: Scenario[] = [
    {
        id: 'empty_in_list',
        category: 'Edge Cases',
        title: 'Empty IN List',
        description: 'Filtering with an empty list in IN clause. Should return no results or handle gracefully.',
        build: (qb) => qb
            .select({ name: Users.columns.name })
            .where(inList(Users.columns.id, []))
    },
    {
        id: 'deep_nested_logic',
        category: 'Edge Cases',
        title: 'Deeply Nested Logic',
        description: 'Complex nested AND/OR logic to test parser/compiler robustness.',
        build: (qb) => qb
            .select({ name: Users.columns.name })
            .where(
                or(
                    and(
                        eq(Users.columns.role, 'admin'),
                        or(
                            eq(Users.columns.name, 'Alice'),
                            eq(Users.columns.name, 'Bob')
                        )
                    ),
                    and(
                        eq(Users.columns.role, 'user'),
                        isNull(Users.columns.deleted_at)
                    )
                )
            )
    },
    {
        id: 'json_path_missing',
        category: 'Edge Cases',
        title: 'Non-existent JSON Path',
        description: 'Querying a JSON path that likely does not exist.',
        build: (qb) => qb
            .select({ name: Users.columns.name })
            .where(eq(jsonPath(Users.columns.settings, '$.non_existent_key'), createLiteral('some_value')))
    },
    {
        id: 'zero_limit',
        category: 'Edge Cases',
        title: 'Zero Limit',
        description: 'Limit 0 should return empty result set.',
        build: (qb) => qb
            .select({ name: Users.columns.name })
            .limit(0)
    }
];
