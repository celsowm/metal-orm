import sqlite3 from 'sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { col } from '../../src/schema/column-types.js';
import {
    Entity,
    Column,
    PrimaryKey,
    BelongsTo,
    bootstrapEntities,
    selectFromEntity,
    getTableDefFromEntity
} from '../../src/decorators/index.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import {
    closeDb,
    execSql,
    runSql,
    createSqliteClient
} from '../e2e/sqlite-helpers.ts';
import { Pool } from '../../src/core/execution/pooling/pool.js';
import { createPooledExecutorFactory, type PooledConnectionAdapter } from '../../src/orm/pooled-executor-factory.js';
import { Orm } from '../../src/orm/orm.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { OrmSession } from '../../src/orm/orm-session.js';

describe('relation typing hydration pooled e2e', () => {
    afterEach(() => {
        clearEntityMetadata();
    });

    it('hydrates column selection with decorated Level 3 setup using pooled executor', async () => {
        @Entity()
        class RelationHydrationUser {
            @PrimaryKey(col.primaryKey(col.int()))
            id!: number;

            @Column(col.varchar(255))
            firstName!: string;

            @Column(col.varchar(255))
            email!: string;
        }

        @Entity()
        class RelationHydrationAuthor {
            @PrimaryKey(col.primaryKey(col.int()))
            id!: number;

            @Column(col.varchar(255))
            firstName!: string;

            @Column(col.varchar(255))
            email!: string;

            @Column(col.int())
            userId!: number;

            @BelongsTo({
                target: () => RelationHydrationUser,
                foreignKey: 'userId'
            })
            user!: RelationHydrationUser;
        }

        @Entity()
        class RelationHydrationPost {
            @PrimaryKey(col.primaryKey(col.int()))
            id!: number;

            @Column(col.varchar(255))
            title!: string;

            @Column(col.int())
            authorId!: number;

            @BelongsTo({
                target: () => RelationHydrationAuthor,
                foreignKey: 'authorId'
            })
            author!: RelationHydrationAuthor;
        }

        const sqlLog: string[] = [];

        const pool = new Pool<sqlite3.Database>(
            {
                create: async () => {
                    const db = new sqlite3.Database(':memory:');
                    return db;
                },
                destroy: async (db) => {
                    await closeDb(db);
                },
            },
            { max: 1 }
        );

        const adapter: PooledConnectionAdapter<sqlite3.Database> = {
            async query(conn, sql, params) {
                sqlLog.push(sql);
                const client = createSqliteClient(conn);
                return client.all(sql, params);
            },
            async beginTransaction(conn) {
                sqlLog.push('BEGIN');
                await execSql(conn, 'BEGIN');
            },
            async commitTransaction(conn) {
                sqlLog.push('COMMIT');
                await execSql(conn, 'COMMIT');
            },
            async rollbackTransaction(conn) {
                sqlLog.push('ROLLBACK');
                await execSql(conn, 'ROLLBACK');
            },
        };

        const factory = createPooledExecutorFactory({ pool, adapter });

        const orm = new Orm({
            dialect: new SqliteDialect(),
            executorFactory: factory
        });

        const session = new OrmSession({ orm, executor: factory.createExecutor() });

        try {
            bootstrapEntities();
            const userTable = getTableDefFromEntity(RelationHydrationUser);
            const authorTable = getTableDefFromEntity(RelationHydrationAuthor);
            const postTable = getTableDefFromEntity(RelationHydrationPost);

            expect(userTable).toBeDefined();
            expect(authorTable).toBeDefined();
            expect(postTable).toBeDefined();

            // Create tables using the pooled session
            await session.executor.executeSql(`
        CREATE TABLE ${userTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          firstName TEXT NOT NULL,
          email TEXT NOT NULL
        );
      `);

            await session.executor.executeSql(`
        CREATE TABLE ${authorTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          firstName TEXT NOT NULL,
          email TEXT NOT NULL,
          userId INTEGER NOT NULL
        );
      `);

            await session.executor.executeSql(`
        CREATE TABLE ${postTable!.name} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          authorId INTEGER NOT NULL
        );
      `);

            await session.executor.executeSql(
                `INSERT INTO ${userTable!.name} (firstName, email) VALUES (?, ?);`,
                ['Alice', 'alice@example.com']
            );

            await session.executor.executeSql(
                `INSERT INTO ${authorTable!.name} (firstName, email, userId) VALUES (?, ?, ?);`,
                ['Bob', 'bob@example.com', 1]
            );

            await session.executor.executeSql(
                `INSERT INTO ${postTable!.name} (title, authorId) VALUES (?, ?);`,
                ['First Decorated Post', 1]
            );

            // Reset SQL log
            sqlLog.length = 0;

            const posts = await selectFromEntity(RelationHydrationPost)
                .select('id', 'title')
                .include('author', { columns: ['firstName', 'email'] })
                .execute(session);

            expect(posts).toHaveLength(1);
            expect(posts[0].author.firstName).toBe('Bob');
            expect(posts[0].author.email).toBe('bob@example.com');

            expect(sqlLog).toHaveLength(1);
            expect(sqlLog[0]).toContain('LEFT JOIN "relation_hydration_authors"');
        } finally {
            await factory.dispose();
        }
    });
});
