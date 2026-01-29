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
    BelongsToMany,
    bootstrapEntities,
    selectFromEntity,
    getTableDefFromEntity
} from '../../../src/decorators/index.js';
import type { HasManyCollection, ManyToManyCollection } from '../../../src/schema/types.js';
import { executeSchemaSqlFor } from '../../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { createSqliteSessionFromDb, closeDb, runSql } from '../../e2e/sqlite-helpers.ts';

// ============================================================================
// Entity definitions for auto-alias tests (defined at module scope for proper type inference)
// ============================================================================

// Acervo use case: BelongsTo + BelongsToMany to same table
@Entity({ tableName: 'usuario_acervo' })
class UsuarioAcervo {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    nome!: string;
}

@Entity({ tableName: 'acervo_destinatario' })
class AcervoDestinatario {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.int())
    acervo_id!: number;

    @Column(col.int())
    usuario_id!: number;
}

@Entity({ tableName: 'acervo' })
class Acervo {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    nome!: string;

    @Column(col.int())
    procurador_titular_id!: number;

    @BelongsTo({ target: () => UsuarioAcervo, foreignKey: 'procurador_titular_id' })
    procuradorTitular!: UsuarioAcervo;

    @BelongsToMany({
        target: () => UsuarioAcervo,
        pivotTable: () => AcervoDestinatario,
        pivotForeignKeyToRoot: 'acervo_id',
        pivotForeignKeyToTarget: 'usuario_id'
    })
    usuarios!: ManyToManyCollection<UsuarioAcervo>;
}

// Multiple BelongsTo to same table
@Entity({ tableName: 'person' })
class Person {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    name!: string;
}

@Entity({ tableName: 'task' })
class Task {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    title!: string;

    @Column(col.int())
    creator_id!: number;

    @Column(col.int())
    assignee_id!: number;

    @BelongsTo({ target: () => Person, foreignKey: 'creator_id' })
    creator!: Person;

    @BelongsTo({ target: () => Person, foreignKey: 'assignee_id' })
    assignee!: Person;
}

// Multiple HasMany to same table
@Entity({ tableName: 'comment' })
class Comment {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    text!: string;

    @Column(col.int())
    post_id!: number;

    @Column(col.int())
    review_id!: number;
}

@Entity({ tableName: 'post' })
class Post {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    title!: string;

    @HasMany({ target: () => Comment, foreignKey: 'post_id' })
    postComments!: HasManyCollection<Comment>;

    @HasMany({ target: () => Comment, foreignKey: 'review_id' })
    reviewComments!: HasManyCollection<Comment>;
}

// Mixed relation types to same table
@Entity({ tableName: 'org_member' })
class OrgMember {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    name!: string;

    @Column(col.int())
    org_id!: number;
}

@Entity({ tableName: 'org_member_pivot' })
class OrgMemberPivot {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.int())
    org_id!: number;

    @Column(col.int())
    user_id!: number;
}

@Entity({ tableName: 'organization' })
class Organization {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    name!: string;

    @Column(col.int())
    owner_id!: number;

    @BelongsTo({ target: () => OrgMember, foreignKey: 'owner_id' })
    owner!: OrgMember;

    @HasMany({ target: () => OrgMember, foreignKey: 'org_id' })
    employees!: HasManyCollection<OrgMember>;

    @BelongsToMany({
        target: () => OrgMember,
        pivotTable: () => OrgMemberPivot,
        pivotForeignKeyToRoot: 'org_id',
        pivotForeignKeyToTarget: 'user_id'
    })
    members!: ManyToManyCollection<OrgMember>;
}

// Self-referencing entity
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

// Bootstrap all entities once
bootstrapEntities();

// ============================================================================
// Tests
// ============================================================================

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

describe('Multiple relations to same table (auto-alias)', () => {
    it('should auto-alias BelongsTo + BelongsToMany pointing to same table (Acervo use case)', () => {
        // Uses entities defined at module scope: Acervo, UsuarioAcervo, AcervoDestinatario
        const qb = selectFromEntity(Acervo)
            .select('id', 'nome')
            .include('procuradorTitular', { columns: ['id', 'nome'] })
            .include('usuarios', { columns: ['id', 'nome'] });

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        console.log('BelongsTo + BelongsToMany SQL:', sql);

        // First join uses table name
        expect(sql).toContain('LEFT JOIN [usuario_acervo] ON');
        // Second join uses alias to avoid collision
        expect(sql).toContain('LEFT JOIN [usuario_acervo] AS [usuarios]');
        // Column references use correct table aliases
        expect(sql).toContain('[usuario_acervo].[id] AS [procuradorTitular__id]');
        expect(sql).toContain('[usuarios].[id] AS [usuarios__id]');
    });

    it('should auto-alias multiple BelongsTo relations pointing to same table', () => {
        // Uses entities defined at module scope: Task, Person
        const qb = selectFromEntity(Task)
            .select('id', 'title')
            .include('creator', { columns: ['id', 'name'] })
            .include('assignee', { columns: ['id', 'name'] });

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        console.log('Multiple BelongsTo SQL:', sql);

        // First join uses table name
        expect(sql).toContain('LEFT JOIN [person] ON');
        // Second join must use alias
        expect(sql).toContain('LEFT JOIN [person] AS [assignee]');
        // Columns reference correct tables
        expect(sql).toContain('[person].[id] AS [creator__id]');
        expect(sql).toContain('[assignee].[id] AS [assignee__id]');
    });

    it('should auto-alias multiple HasMany relations pointing to same table', () => {
        // Uses entities defined at module scope: Post, Comment
        const qb = selectFromEntity(Post)
            .select('id', 'title')
            .include('postComments', { columns: ['id', 'text'] })
            .include('reviewComments', { columns: ['id', 'text'] });

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        console.log('Multiple HasMany SQL:', sql);

        // First join uses table name
        expect(sql).toContain('LEFT JOIN [comment] ON');
        // Second join must use alias
        expect(sql).toContain('LEFT JOIN [comment] AS [reviewComments]');
        // Columns reference correct tables
        expect(sql).toContain('[comment].[id] AS [postComments__id]');
        expect(sql).toContain('[reviewComments].[id] AS [reviewComments__id]');
    });

    it('should auto-alias mixed relation types pointing to same table', () => {
        // Uses entities defined at module scope: Organization, OrgMember, OrgMemberPivot
        const qb = selectFromEntity(Organization)
            .select('id', 'name')
            .include('owner', { columns: ['id', 'name'] })
            .include('employees', { columns: ['id', 'name'] })
            .include('members', { columns: ['id', 'name'] });

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        console.log('Mixed relations SQL:', sql);

        // First join uses table name
        expect(sql).toContain('LEFT JOIN [org_member] ON');
        // Subsequent joins must use aliases
        expect(sql).toContain('AS [employees]');
        expect(sql).toContain('AS [members]');
        // All columns should reference the correct table/alias
        expect(sql).toContain('[org_member].[id] AS [owner__id]');
        expect(sql).toContain('[employees].[id] AS [employees__id]');
        expect(sql).toContain('[members].[id] AS [members__id]');
    });
});

describe('Self-Join Same Exposed Names Error with selectFromEntity, include, and execute', () => {
    it('should generate SQL with selectFromEntity that auto-aliases self-reference', () => {
        // Uses Employee entity defined at module scope
        const qb = selectFromEntity(Employee)
            .select('id', 'name', 'manager_id')
            .include('manager', { columns: ['id', 'name'] });

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // With auto-alias fix, the join uses an alias
        expect(sql).toContain('FROM [employees]');
        expect(sql).toContain('LEFT JOIN [employees] AS [manager]');

        console.log('selectFromEntity + include SQL (fixed with alias):', sql);
    });

    it('should execute successfully with self-referencing entity after auto-alias fix', async () => {
        // Uses Employee entity defined at module scope
        const db = new sqlite3.Database(':memory:');

        try {
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

            // After the auto-alias fix, this should execute successfully
            // The join now uses: LEFT JOIN employees AS manager
            const result = await selectFromEntity(Employee)
                .select('id', 'name', 'manager_id')
                .include('manager', { columns: ['id', 'name'] })
                .execute(session);

            expect(result).toBeDefined();
            expect(result.length).toBe(2);
            expect(result[0].manager).toBeDefined();

            console.log('Successfully executed self-referencing query with auto-alias fix');
        } finally {
            await closeDb(db);
        }
    });

    it('should show the problematic SQL generated by direct SelectQueryBuilder self-join', () => {
        // Uses Employee entity defined at module scope
        const employeeTable = getTableDefFromEntity(Employee);
        expect(employeeTable).toBeDefined();

        // Build query using the query builder directly (lower level)
        // Note: Direct SelectQueryBuilder doesn't have auto-alias, only selectFromEntity does
        const qb = new SelectQueryBuilder(employeeTable!)
            .select({
                id: employeeTable!.columns.id,
                name: employeeTable!.columns.name,
                manager_id: employeeTable!.columns.manager_id
            })
            // Manually join to the same table - this still causes issues without alias
            .leftJoin(
                employeeTable!,
                eq(employeeTable!.columns.manager_id, employeeTable!.columns.id)
            );

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // This shows the exact SQL that causes the error (direct query builder, no auto-alias)
        console.log('Direct query builder self-join SQL:', sql);

        // The SQL has the table appearing twice without aliases
        expect(sql).toContain('FROM [employees]');
        expect(sql).toContain('LEFT JOIN [employees]');
    });

    it('should auto-alias multiple includes on self-referencing entity', () => {
        // Uses Employee entity defined at module scope
        const qb = selectFromEntity(Employee)
            .select('id', 'name')
            .include('manager', { columns: ['id', 'name'] })
            .include('subordinates', { columns: ['id', 'name'] });

        const mssql = new SqlServerDialect();
        const sql = qb.toSql(mssql);

        // With auto-alias fix, both joins use aliases
        expect(sql).toContain('LEFT JOIN [employees] AS [manager]');
        expect(sql).toContain('LEFT JOIN [employees] AS [subordinates]');

        console.log('Multiple includes self-join SQL:', sql);
    });
});
