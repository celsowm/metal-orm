import { describe, it, expect } from 'vitest';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column.js';
import {
    eq, and, or, gt, gte, exists, neq,
    caseWhen, windowFunction
} from '../../../src/core/ast/expression.js';
import { sum } from '../../../src/core/ast/aggregate-functions.js';

// 1. Define Schema
const users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.notNull(col.varchar(255)),
    email: col.unique(col.varchar(255)),
    lastLogin: col.timestamp(),
    metadata: col.json(),
});

const posts = defineTable('posts', {
    id: col.primaryKey(col.int()),
    userId: col.notNull(col.int()),
    title: col.notNull(col.varchar(255)),
    content: col.varchar(5000), // replaced text w/ varchar
    createdAt: col.timestamp(),
    views: col.default(col.int(), 0),
});

const comments = defineTable('comments', {
    id: col.primaryKey(col.int()),
    postId: col.notNull(col.int()),
    userId: col.notNull(col.int()),
    content: col.varchar(1000),
    createdAt: col.timestamp(),
    likes: col.default(col.int(), 0),
});

const roles = defineTable('roles', {
    id: col.primaryKey(col.int()),
    name: col.unique(col.varchar(50)),
});

const userRoles = defineTable('user_roles', {
    userId: col.primaryKey(col.int()),
    roleId: col.primaryKey(col.int()),
});

// CTE Definitions as Tables for reference
const activeUsersCTE = defineTable('active_users', {
    id: col.int(),
    name: col.varchar(255),
    email: col.varchar(255),
    metadata: col.json(),
    lastLogin: col.timestamp()
});

const viralPostsCTE = defineTable('viral_posts', {
    id: col.int(),
    userId: col.int(),
    views: col.int()
});

const karmaStatsCTE = defineTable('karma_stats', {
    userId: col.int(),
    totalKarma: col.int()
});

const dialect = new SqliteDialect();

describe('Very Complex and Nested Query', () => {
    it('should generate valid SQL for a highly complex scenario', () => {

        const thirtyDaysAgo = '2023-10-01'; // Use string for date

        // CTE 1: Active Users
        const activeUsersQuery = new SelectQueryBuilder(users)
            .selectRaw('id', 'name', 'email', 'metadata', 'lastLogin')
            .where(gt(users.columns.lastLogin, thirtyDaysAgo));

        // CTE 2: Viral Posts (posts with > 100 views)
        const viralPostsQuery = new SelectQueryBuilder(posts)
            .selectRaw('id', 'userId', 'views')
            .where(gt(posts.columns.views, 100));

        // Subquery: Calculate total comment karma per user
        // We will join this as a derived table
        const commentKarmaQuery = new SelectQueryBuilder(comments)
            .select({
                userId: comments.columns.userId,
                // Use cast as any to bypass strict typing for now if FunctionNode != ColumnDef
                totalKarma: sum(comments.columns.likes) as any
            })
            .groupBy(comments.columns.userId);

        // Main Query
        const query = new SelectQueryBuilder(activeUsersCTE)
            .with('active_users', activeUsersQuery)
            .with('viral_posts', viralPostsQuery)
            .select({
                userId: activeUsersCTE.columns.id,
                userName: activeUsersCTE.columns.name,
                userEmail: activeUsersCTE.columns.email,
                roleName: roles.columns.name,
                totalKarma: karmaStatsCTE.columns.totalKarma
            })
            // Manually selecting raw columns for things not in TableDef or standard helpers
            .selectRaw('json_extract(active_users.metadata, "$.theme") as themePreference')
            // Window Function via windowFunction helper
            .select({
                rank: windowFunction('RANK', [], [], [
                    { column: karmaStatsCTE.columns.totalKarma, direction: 'DESC' }
                ])
            })
            // Case Expression
            .select({
                statusLabel: caseWhen([
                    { when: gt(karmaStatsCTE.columns.totalKarma, 1000), then: 'Legend' },
                    { when: gt(karmaStatsCTE.columns.totalKarma, 500), then: 'Pro' }
                ], 'Rookie')
            })
            // Join with Roles
            .innerJoin(userRoles, eq(userRoles.columns.userId, activeUsersCTE.columns.id))
            .innerJoin(roles, eq(roles.columns.id, userRoles.columns.roleId))
            // Join with Karma Stats Subquery - aliased as 'karma_stats'
            // We use .joinRelation or manual join. Here manual join is needed as it's a subquery.
            // But SelectQueryBuilder.join... expects TableDef. 
            // We can trick it by creating a TableDef for the aliases, which we did with karmaStatsCTE.
            // But we need to pass the subquery itself.
            // MetalORM's builder structure seems to separate CTE/WITH from JOINs.
            // If we want to join a subquery, we usually join on a CTE name or use .join(subquery) (if supported)
            // Looking at docs, joins usually take TableDef. 
            // Let's use the CTE approach for karmaStats too.
            .with('karma_stats', commentKarmaQuery)
            .leftJoin(
                karmaStatsCTE,
                eq(karmaStatsCTE.columns.userId, activeUsersCTE.columns.id)
            )
            // Filter: Must have at least one viral post
            .where(and(
                // EXISTS check against the Viral Posts CTE
                exists(
                    new SelectQueryBuilder(viralPostsCTE)
                        .selectRaw('1')
                        .where(eq(viralPostsCTE.columns.userId, activeUsersCTE.columns.id))
                        .getAST()
                ),
                // Role check
                or(
                    eq(roles.columns.name, 'admin'),
                    eq(roles.columns.name, 'moderator')
                ),
                // Complex nested boolean logic: NOT (Banned AND LowKarma)
                // => Name != Banned OR Karma >= 0
                or(
                    neq(activeUsersCTE.columns.name, 'BannedUser'),
                    gte(karmaStatsCTE.columns.totalKarma, 0)
                )
            ))
            .orderBy(activeUsersCTE.columns.name, 'ASC')
            .limit(10);

        const { sql, params } = query.compile(dialect);

        // Basic Assertions to verify structure
        expect(sql).toContain('WITH');
        expect(sql).toContain('active_users');
        expect(sql).toContain('viral_posts');
        expect(sql).toContain('karma_stats');
        expect(sql).toContain('SELECT');
        expect(sql).toContain('RANK() OVER');
        expect(sql).toContain('CASE WHEN');
        expect(sql).toContain('json_extract');
        expect(sql).toContain('EXISTS');
        expect(sql).toContain('JOIN');

        expect(sql).toContain('FROM "active_users"');
        expect(sql).toContain('INNER JOIN "user_roles"');
        expect(sql).toContain('LEFT JOIN "karma_stats"');
    });
});
