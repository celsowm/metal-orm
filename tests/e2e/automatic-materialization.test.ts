import sqlite3 from 'sqlite3';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
    Entity,
    Column,
    PrimaryKey,
    HasMany,
    selectFromEntity,
    bootstrapEntities,
    getTableDefFromEntity
} from '../../src/decorators/index.js';
import { col } from '../../src/schema/column-types.js';
import { HasManyCollection } from '../../src/schema/types.js';
import { OrmSession } from '../../src/orm/orm-session.js';
import { eq } from '../../src/core/ast/expression.js';
import {
    closeDb,
    execSql,
    createSqliteClient
} from '../e2e/sqlite-helpers.ts';
import { Pool } from '../../src/core/execution/pooling/pool.js';
import { createPooledExecutorFactory, type PooledConnectionAdapter } from '../../src/orm/pooled-executor-factory.js';
import { Orm } from '../../src/orm/orm.js';
import { SqliteDialect } from '../../src/core/dialect/sqlite/index.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';

@Entity({ tableName: 'auto_mat_posts' })
class Post {
    @PrimaryKey(col.primaryKey(col.int()))
    id!: number;

    @Column(col.varchar(255))
    title!: string;

    @Column(col.int())
    user_id!: number;
}

@Entity({ tableName: 'auto_mat_users' })
class User {
    @PrimaryKey(col.primaryKey(col.int()))
    id!: number;

    @Column(col.varchar(255))
    email!: string;

    @HasMany({ target: () => Post, foreignKey: 'user_id' })
    posts!: HasManyCollection<Post>;

    getFullName() {
        return `User ${this.id}: ${this.email}`;
    }
}

describe('Automatic Materialization (SQLite)', () => {
    let session: OrmSession;
    let factory: any;

    beforeAll(async () => {
        bootstrapEntities();

        const pool = new Pool<sqlite3.Database>(
            {
                create: async () => {
                    return new sqlite3.Database(':memory:');
                },
                destroy: async (db) => {
                    await closeDb(db);
                },
            },
            { max: 1 }
        );

        const adapter: PooledConnectionAdapter<sqlite3.Database> = {
            async query(conn, sql, params) {
                const client = createSqliteClient(conn);
                return client.all(sql, params);
            },
            async beginTransaction(conn) {
                await execSql(conn, 'BEGIN');
            },
            async commitTransaction(conn) {
                await execSql(conn, 'COMMIT');
            },
            async rollbackTransaction(conn) {
                await execSql(conn, 'ROLLBACK');
            },
        };

        factory = createPooledExecutorFactory({ pool, adapter });

        const orm = new Orm({
            dialect: new SqliteDialect(),
            executorFactory: factory
        });

        session = new OrmSession({ orm, executor: factory.createExecutor() });

        // Setup Schema
        const userTable = getTableDefFromEntity(User);
        const postTable = getTableDefFromEntity(Post);

        if (!userTable || !postTable) throw new Error('Tables not found');

        await executeSchemaSqlFor(
            session.executor,
            new SQLiteSchemaDialect(),
            userTable,
            postTable
        );

        // Seed Data
        await session.executor.executeSql(
            `INSERT INTO ${userTable.name} (id, email) VALUES (?, ?);`,
            [1, 'user@example.com']
        );
        await session.executor.executeSql(
            `INSERT INTO ${userTable.name} (id, email) VALUES (?, ?);`,
            [2, 'admin@example.com']
        );
    });

    afterAll(async () => {
        if (factory) await factory.dispose();
    });

    it('should automatically materialize entities', async () => {
        const userTable = getTableDefFromEntity(User)!;
        const users = await selectFromEntity(User)
            .where(eq(userTable.columns.id, 1))
            .execute(session);

        expect(users).toHaveLength(1);
        expect(users[0]).toBeInstanceOf(User);
        expect(users[0].email).toBe('user@example.com');
        expect(users[0].getFullName()).toBe('User 1: user@example.com');
    });

    it('should return plain objects with executePlain', async () => {
        const userTable = getTableDefFromEntity(User)!;
        const users = await selectFromEntity(User)
            .where(eq(userTable.columns.id, 1))
            .executePlain(session);

        expect(users).toHaveLength(1);
        expect(users[0]).not.toBeInstanceOf(User);
        expect(users[0].email).toBe('user@example.com');
        expect((users[0] as any).getFullName).toBeUndefined();
    });

    it('should allow casting with executeAs', async () => {
        class AdminUser {
            id!: number;
            email!: string;
            isAdmin = true;
        }

        const userTable = getTableDefFromEntity(User)!;
        const admins = await selectFromEntity(User)
            .where(eq(userTable.columns.id, 2))
            .executeAs(AdminUser, session);

        expect(admins).toHaveLength(1);
        expect(admins[0]).toBeInstanceOf(AdminUser);
        expect(admins[0].isAdmin).toBe(true);
        expect(admins[0].email).toBe('admin@example.com');
    });
});
