import { describe, it, expect, beforeEach } from 'vitest';
import sqlite3 from 'sqlite3';
import { SelectQueryBuilder } from '../../../src/query-builder/select.js';
import { defineTable } from '../../../src/schema/table.js';
import { col } from '../../../src/schema/column-types.js';
import { eq } from '../../../src/core/ast/expression.js';
import { SqlServerDialect } from '../../../src/core/dialect/mssql/index.js';
import { MySqlDialect } from '../../../src/core/dialect/mysql/index.js';
import { PostgresDialect } from '../../../src/core/dialect/postgres/index.js';
import { SqliteDialect } from '../../../src/core/dialect/sqlite/index.js';
import {
    Entity,
    Column,
    PrimaryKey,
    HasMany,
    BelongsTo,
    bootstrapEntities,
    selectFromEntity,
    getTableDefFromEntity
} from '../../../src/decorators/index.js';
import type { HasManyCollection } from '../../../src/schema/types.js';
import { executeSchemaSqlFor } from '../../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { createSqliteSessionFromDb, closeDb, runSql } from '../../e2e/sqlite-helpers.ts';

/**
 * This test reproduces the SQL Server error:
 * "The objects \"usuario\" and \"usuario\" in the FROM clause have the same exposed names.
 * Use correlation names to distinguish them."
 *
 * This error occurs when:
 * 1. A table is used in the FROM clause
 * 2. The SAME table is joined again without an alias
 * 3. SQL Server cannot distinguish between the two instances
 *
 * The fix is to always use aliases when self-joining tables.
 */
describe('Self-Join Same Exposed Names Error', () => {
    // Define a simple table - simulating the "usuario" table from the error
    const usuario = defineTable('usuario', {
        id: col.primaryKey(col.int()),
        nome: col.varchar(255),
        email: col.varchar(255),
        supervisor_id: col.int(), // Self-referencing foreign key
    });

    it('should generate SQL that causes "same exposed names" error without alias (SQL Server)', () => {
        // This is the problematic pattern: joining the same table without aliases
        // SQL Server will fail with:
        // "The objects "usuario" and "usuario" in the FROM clause have the same exposed names"
        const qb = new SelectQueryBuilder(usuario)
            .select({
                id: usuario.columns.id,
                nome: usuario.columns.nome,
            })
            // Joining the same table without alias - this is the problem!
            .leftJoin(usuario, eq(usuario.columns.supervisor_id, usuario.columns.id));

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // This SQL will fail on SQL Server because both tables have the same exposed name "usuario"
        // Expected problematic SQL: SELECT ... FROM [usuario] LEFT JOIN [usuario] ON ...
        expect(sql).toContain('FROM [usuario]');
        expect(sql).toContain('LEFT JOIN [usuario]');

        // The SQL should show the problem: same table name used twice without aliases
        console.log('Problematic SQL (will fail on SQL Server):', sql);
    });

    it('should demonstrate the fix: using aliases to distinguish tables', () => {
        // The fix: use .as() to create table aliases
        // Note: The join table doesn't get the alias rendered in the FROM clause,
        // but the column references use the alias correctly
        const qb = new SelectQueryBuilder(usuario)
            .as('u') // Alias the main table
            .select({
                id: usuario.columns.id,
                nome: usuario.columns.nome,
            })
            // Join the same table - the alias is used in column references
            .leftJoin(
                usuario,
                eq({ ...usuario.columns.supervisor_id, table: 'u' }, { ...usuario.columns.id, table: 'usuario' })
            );

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // The main table has the alias, and column references use the aliases correctly
        expect(sql).toContain('FROM [usuario] AS [u]');
        // The join uses the original table name (no alias) but columns are qualified correctly
        expect(sql).toContain('LEFT JOIN [usuario]');
        expect(sql).toContain('[u].[supervisor_id]');

        console.log('Fixed SQL (will work on SQL Server):', sql);
    });

    it('should show the error occurs with multiple dialects when self-joining without alias', () => {
        const qb = new SelectQueryBuilder(usuario)
            .select({
                id: usuario.columns.id,
                nome: usuario.columns.nome,
            })
            .innerJoin(usuario, eq(usuario.columns.supervisor_id, usuario.columns.id));

        const mssql = new SqlServerDialect();
        const mysql = new MySqlDialect();
        const postgres = new PostgresDialect();
        const sqlite = new SqliteDialect();

        const mssqlSql = qb.toSql(mssql);
        const mysqlSql = qb.toSql(mysql);
        const postgresSql = qb.toSql(postgres);
        const sqliteSql = qb.toSql(sqlite);

        // All dialects will generate SQL with the same table name appearing twice
        // This demonstrates the issue is dialect-agnostic in the generated SQL
        expect(mssqlSql).toContain('[usuario]');
        expect(mysqlSql).toContain('`usuario`');
        expect(postgresSql).toContain('"usuario"');
        expect(sqliteSql).toContain('"usuario"');

        console.log('SQL Server:', mssqlSql);
        console.log('MySQL:', mysqlSql);
        console.log('PostgreSQL:', postgresSql);
        console.log('SQLite:', sqliteSql);
    });

    it('should demonstrate correct self-join pattern with proper aliases', () => {
        // Proper self-join pattern using the .as() method and column references
        const qb = new SelectQueryBuilder(usuario)
            .as('funcionario')
            .select({
                funcionario_id: { ...usuario.columns.id, table: 'funcionario' },
                funcionario_nome: { ...usuario.columns.nome, table: 'funcionario' },
            })
            .selectSubquery(
                'supervisor_nome',
                new SelectQueryBuilder(usuario)
                    .as('supervisor')
                    .select({ nome: { ...usuario.columns.nome, table: 'supervisor' } })
                    .where(eq({ ...usuario.columns.id, table: 'supervisor' }, { ...usuario.columns.supervisor_id, table: 'funcionario' }))
                    .getAST()
            );

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // The main table should be aliased
        expect(sql).toContain('FROM [usuario] AS [funcionario]');

        console.log('Self-join with subquery:', sql);
    });

    it('should force the error by joining same table multiple times without aliases', () => {
        // Extreme case: joining the same table multiple times
        // This will definitely trigger the "same exposed names" error
        const qb = new SelectQueryBuilder(usuario)
            .select({
                id: usuario.columns.id,
            })
            // First self-join without alias
            .leftJoin(usuario, eq(usuario.columns.supervisor_id, usuario.columns.id))
            // Second self-join without alias
            .leftJoin(usuario, eq(usuario.columns.supervisor_id, usuario.columns.id));

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // Count occurrences of the table name - should appear 3 times (FROM + 2 JOINs)
        // SQL Server uses [usuario] format
        const matches = sql.match(/\[usuario\]/g);
        expect(matches?.length).toBeGreaterThanOrEqual(3);

        console.log('Multiple self-joins without aliases (will definitely fail):', sql);

        // This demonstrates the exact error condition:
        // "The objects "usuario" and "usuario" in the FROM clause have the same exposed names"
        expect(sql).toContain('FROM [usuario]');
        expect(sql).toContain('LEFT JOIN [usuario]');
    });
});

describe('Self-Join Same Exposed Names Error with selectFromEntity, include, and execute', () => {
    it('should generate SQL with selectFromEntity that causes "same exposed names" error', () => {
        // Define self-referencing entity using decorators
        @Entity()
        class Employee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.int())
            manager_id!: number;

            @BelongsTo({ target: () => Employee, foreignKey: 'manager_id' })
            manager?: Employee;

            @HasMany({ target: () => Employee, foreignKey: 'manager_id' })
            subordinates!: HasManyCollection<Employee>;
        }

        bootstrapEntities();

        // Using selectFromEntity with self-referencing entity
        // This will generate SQL that joins the same table without proper aliases
        const qb = selectFromEntity(Employee)
            .select('id', 'name', 'manager_id')
            .include('manager', { columns: ['id', 'name'] });

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // This SQL will have the same table appearing multiple times
        // which causes the "same exposed names" error on SQL Server
        expect(sql).toContain('FROM [employees]');
        expect(sql).toContain('LEFT JOIN [employees]');

        console.log('selectFromEntity + include SQL (problematic):', sql);
    });

    it('should demonstrate the execute fails with "ambiguous column name" error (SQLite equivalent of same exposed names)', async () => {
        // Define self-referencing entity using decorators
        @Entity()
        class Employee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.int())
            manager_id!: number;

            @BelongsTo({ target: () => Employee, foreignKey: 'manager_id' })
            manager?: Employee;

            @HasMany({ target: () => Employee, foreignKey: 'manager_id' })
            subordinates!: HasManyCollection<Employee>;
        }

        const db = new sqlite3.Database(':memory:');

        try {
            bootstrapEntities();
            const employeeTable = getTableDefFromEntity(Employee);
            expect(employeeTable).toBeDefined();

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                employeeTable!
            );

            // Insert test data - employees with managers
            await runSql(db, 'INSERT INTO employees (id, name, manager_id) VALUES (?, ?, ?)', [1, 'CEO', 1]);
            await runSql(db, 'INSERT INTO employees (id, name, manager_id) VALUES (?, ?, ?)', [2, 'Manager 1', 1]);

            // This should fail with SQLite's equivalent of "same exposed names" error:
            // "SQLITE_ERROR: ambiguous column name: employees.id"
            // This is because the self-join generates SQL without proper table aliases
            await expect(
                selectFromEntity(Employee)
                    .select('id', 'name', 'manager_id')
                    .include('manager', { columns: ['id', 'name'] })
                    .execute(session)
            ).rejects.toThrow(/ambiguous column name/);

            console.log('Successfully demonstrated the error: SQLite "ambiguous column name" is the equivalent of SQL Server "same exposed names"');
        } finally {
            await closeDb(db);
        }
    });

    it('should show the problematic SQL generated by include with self-referencing relation', () => {
        // Define self-referencing entity using decorators
        @Entity()
        class Employee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.int())
            manager_id!: number;

            @BelongsTo({ target: () => Employee, foreignKey: 'manager_id' })
            manager?: Employee;

            @HasMany({ target: () => Employee, foreignKey: 'manager_id' })
            subordinates!: HasManyCollection<Employee>;
        }

        bootstrapEntities();

        // Get the table definition
        const employeeTable = getTableDefFromEntity(Employee);
        expect(employeeTable).toBeDefined();

        // Build query using the query builder directly (lower level)
        const qb = new SelectQueryBuilder(employeeTable!)
            .select({
                id: employeeTable!.columns.id,
                name: employeeTable!.columns.name,
                manager_id: employeeTable!.columns.manager_id
            })
            // Manually join to the same table - simulating what include does
            .leftJoin(
                employeeTable!,
                eq(employeeTable!.columns.manager_id, employeeTable!.columns.id)
            );

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // This shows the exact SQL that causes the error
        console.log('Direct query builder self-join SQL:', sql);

        // The SQL has the table appearing twice without aliases
        expect(sql).toContain('FROM [employees]');
        expect(sql).toContain('LEFT JOIN [employees]');

        // This is the problematic pattern that causes:
        // "The objects "employees" and "employees" in the FROM clause have the same exposed names"
    });

    it('should force the error with multiple includes on self-referencing entity', () => {
        // Define self-referencing entity using decorators
        @Entity()
        class Employee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.int())
            manager_id!: number;

            @BelongsTo({ target: () => Employee, foreignKey: 'manager_id' })
            manager?: Employee;

            @HasMany({ target: () => Employee, foreignKey: 'manager_id' })
            subordinates!: HasManyCollection<Employee>;
        }

        bootstrapEntities();

        // Using multiple includes on self-referencing relations
        // This will generate multiple joins to the same table
        const qb = selectFromEntity(Employee)
            .select('id', 'name')
            .include('manager', { columns: ['id', 'name'] })
            .include('subordinates', { columns: ['id', 'name'] });

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // This SQL will have multiple joins to the same table
        // which definitely triggers the "same exposed names" error
        const joinCount = (sql.match(/LEFT JOIN \[employees\]/g) || []).length;
        expect(joinCount).toBeGreaterThanOrEqual(1);

        console.log('Multiple includes self-join SQL:', sql);
        console.log(`Number of LEFT JOIN [employees]: ${joinCount}`);
    });
});
