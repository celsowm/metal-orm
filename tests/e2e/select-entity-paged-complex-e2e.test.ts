import { describe, expect, it, afterEach } from 'vitest';
import sqlite3 from 'sqlite3';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import type { HasManyCollection } from '../../src/schema/types.js';
import {
    bootstrapEntities,
    Column,
    Entity,
    HasMany,
    BelongsTo,
    PrimaryKey,
    getTableDefFromEntity,
    selectFromEntity
} from '../../src/decorators/index.js';
import { clearEntityMetadata } from '../../src/orm/entity-metadata.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
    closeDb,
    createSqliteSessionFromDb,
    runSql
} from './sqlite-helpers.ts';

describe('selectFromEntity complex E2E: 2-level relations + executePaged + ordering', () => {
    afterEach(() => {
        clearEntityMetadata();
    });

    it('should paginate with 2-level includes and order by parent column ASC', async () => {
        @Entity()
        class ComplexCompany {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            industry!: string;

            @HasMany({
                target: () => ComplexEmployee,
                foreignKey: 'companyId'
            })
            employees!: HasManyCollection<ComplexEmployee>;

            @HasMany({
                target: () => ComplexDepartment,
                foreignKey: 'companyId'
            })
            departments!: HasManyCollection<ComplexDepartment>;
        }

        @Entity()
        class ComplexDepartment {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            location!: string;

            @Column(col.int())
            companyId!: number;

            @BelongsTo({
                target: () => ComplexCompany,
                foreignKey: 'companyId'
            })
            company?: ComplexCompany;

            @HasMany({
                target: () => ComplexEmployee,
                foreignKey: 'departmentId'
            })
            employees!: HasManyCollection<ComplexEmployee>;
        }

        @Entity()
        class ComplexEmployee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            firstName!: string;

            @Column(col.varchar(255))
            lastName!: string;

            @Column(col.varchar(100))
            position!: string;

            @Column(col.decimal(10, 2))
            salary!: number;

            @Column(col.int())
            companyId!: number;

            @Column(col.int())
            departmentId!: number;

            @BelongsTo({
                target: () => ComplexCompany,
                foreignKey: 'companyId'
            })
            company?: ComplexCompany;

            @BelongsTo({
                target: () => ComplexDepartment,
                foreignKey: 'departmentId'
            })
            department?: ComplexDepartment;
        }

        const db = new sqlite3.Database(':memory:');

        try {
            bootstrapEntities();
            const companyTable = getTableDefFromEntity(ComplexCompany);
            const employeeTable = getTableDefFromEntity(ComplexEmployee);
            const departmentTable = getTableDefFromEntity(ComplexDepartment);

            if (!companyTable || !employeeTable || !departmentTable) {
                throw new Error('Failed to bootstrap entity tables');
            }

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                companyTable,
                employeeTable,
                departmentTable
            );

            for (let i = 1; i <= 5; i++) {
                await runSql(db,
                    `INSERT INTO ${companyTable.name} (name, industry) VALUES (?, ?)`,
                    [`Company ${i}`, i % 2 === 0 ? 'Tech' : 'Finance']
                );
                await runSql(db,
                    `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                    [`Dept ${i}A`, `Building ${String.fromCharCode(64 + i)}`, i]
                );
                await runSql(db,
                    `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                    [`Dept ${i}B`, `Building ${String.fromCharCode(64 + i)}`, i]
                );
                for (let j = 1; j <= 3; j++) {
                    await runSql(db,
                        `INSERT INTO ${employeeTable.name} (firstName, lastName, position, salary, companyId, departmentId) VALUES (?, ?, ?, ?, ?, ?)`,
                        [`First${i}-${j}`, `Last${i}-${j}`, `Position ${j}`, 50000 + (i * 10000) + (j * 1000), i, (i - 1) * 2 + j]
                    );
                }
            }

            const result = await selectFromEntity(ComplexEmployee)
                .include('company', { columns: ['name', 'industry'] })
                .include('department', { columns: ['name', 'location'] })
                .orderBy(employeeTable.columns.firstName, 'ASC')
                .executePaged(session, { page: 1, pageSize: 10 });

            expect(result.items).toHaveLength(10);
            expect(result.totalItems).toBe(15);
            expect(result.page).toBe(1);
            expect(result.pageSize).toBe(10);

            const names = result.items.map(e => e.firstName);
            expect(names).toEqual(names.sort());

            for (const emp of result.items) {
                expect(emp.company).toBeDefined();
                expect(emp.company!.name).toContain('Company');
                expect(emp.department).toBeDefined();
                expect(emp.department!.name).toContain('Dept');
            }
        } finally {
            await closeDb(db);
        }
    });

    it('should paginate with 2-level includes and order by relation column DESC', async () => {
        @Entity()
        class ComplexCompany {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            industry!: string;

            @HasMany({
                target: () => ComplexEmployee,
                foreignKey: 'companyId'
            })
            employees!: HasManyCollection<ComplexEmployee>;
        }

        @Entity()
        class ComplexDepartment {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            location!: string;

            @Column(col.int())
            companyId!: number;

            @BelongsTo({
                target: () => ComplexCompany,
                foreignKey: 'companyId'
            })
            company?: ComplexCompany;
        }

        @Entity()
        class ComplexEmployee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            firstName!: string;

            @Column(col.varchar(255))
            lastName!: string;

            @Column(col.varchar(100))
            position!: string;

            @Column(col.decimal(10, 2))
            salary!: number;

            @Column(col.int())
            companyId!: number;

            @Column(col.int())
            departmentId!: number;

            @BelongsTo({
                target: () => ComplexCompany,
                foreignKey: 'companyId'
            })
            company?: ComplexCompany;

            @BelongsTo({
                target: () => ComplexDepartment,
                foreignKey: 'departmentId'
            })
            department?: ComplexDepartment;
        }

        const db = new sqlite3.Database(':memory:');

        try {
            bootstrapEntities();
            const companyTable = getTableDefFromEntity(ComplexCompany);
            const employeeTable = getTableDefFromEntity(ComplexEmployee);
            const departmentTable = getTableDefFromEntity(ComplexDepartment);

            if (!companyTable || !employeeTable || !departmentTable) {
                throw new Error('Failed to bootstrap entity tables');
            }

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                companyTable,
                employeeTable,
                departmentTable
            );

            const companyNames = ['ZetaCorp', 'AlphaCorp', 'BetaInc'];
            const industries = ['Tech', 'Finance', 'Health'];
            for (let i = 1; i <= 3; i++) {
                await runSql(db,
                    `INSERT INTO ${companyTable.name} (name, industry) VALUES (?, ?)`,
                    [companyNames[i - 1], industries[i - 1]]
                );
            }

            await runSql(db,
                `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                ['Engineering', 'Building A', 1]
            );
            await runSql(db,
                `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                ['HR', 'Building A', 2]
            );
            await runSql(db,
                `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                ['Sales', 'Building B', 3]
            );

            for (let i = 1; i <= 6; i++) {
                const deptId = [1, 1, 2, 2, 3, 3][i - 1];
                await runSql(db,
                    `INSERT INTO ${employeeTable.name} (firstName, lastName, position, salary, companyId, departmentId) VALUES (?, ?, ?, ?, ?, ?)`,
                    ['Alice', 'Smith', 'Manager', 80000, deptId, deptId]
                );
            }

            const result = await selectFromEntity(ComplexEmployee)
                .include('department', { columns: ['name'] })
                .include('company', { columns: ['name'] })
                .orderBy(companyTable.columns.name, 'DESC')
                .executePaged(session, { page: 1, pageSize: 10 });

            expect(result.items).toHaveLength(6);
            const companyNamesResult = result.items.map(e => e.company!.name);
            expect(companyNamesResult).toEqual(companyNamesResult.sort().reverse());
        } finally {
            await closeDb(db);
        }
    });

    it('should paginate with 2-level includes and order by second-level relation column', async () => {
        @Entity()
        class ComplexCompany {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            industry!: string;

            @HasMany({
                target: () => ComplexEmployee,
                foreignKey: 'companyId'
            })
            employees!: HasManyCollection<ComplexEmployee>;
        }

        @Entity()
        class ComplexDepartment {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            location!: string;

            @Column(col.int())
            companyId!: number;

            @BelongsTo({
                target: () => ComplexCompany,
                foreignKey: 'companyId'
            })
            company?: ComplexCompany;

            @HasMany({
                target: () => ComplexEmployee,
                foreignKey: 'departmentId'
            })
            employees!: HasManyCollection<ComplexEmployee>;
        }

        @Entity()
        class ComplexEmployee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            firstName!: string;

            @Column(col.varchar(255))
            lastName!: string;

            @Column(col.varchar(100))
            position!: string;

            @Column(col.decimal(10, 2))
            salary!: number;

            @Column(col.int())
            companyId!: number;

            @Column(col.int())
            departmentId!: number;

            @BelongsTo({
                target: () => ComplexCompany,
                foreignKey: 'companyId'
            })
            company?: ComplexCompany;

            @BelongsTo({
                target: () => ComplexDepartment,
                foreignKey: 'departmentId'
            })
            department?: ComplexDepartment;
        }

        const db = new sqlite3.Database(':memory:');

        try {
            bootstrapEntities();
            const companyTable = getTableDefFromEntity(ComplexCompany);
            const employeeTable = getTableDefFromEntity(ComplexEmployee);
            const departmentTable = getTableDefFromEntity(ComplexDepartment);

            if (!companyTable || !employeeTable || !departmentTable) {
                throw new Error('Failed to bootstrap entity tables');
            }

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                companyTable,
                employeeTable,
                departmentTable
            );

            await runSql(db,
                `INSERT INTO ${companyTable.name} (name, industry) VALUES (?, ?)`,
                ['MegaCorp', 'Conglomerate']
            );

            const locations = ['New York', 'Chicago', 'Austin', 'Seattle'];
            for (let i = 1; i <= 4; i++) {
                await runSql(db,
                    `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                    [`Dept ${i}`, locations[i - 1], 1]
                );
            }

            for (let i = 1; i <= 8; i++) {
                const deptId = ((i - 1) % 4) + 1;
                await runSql(db,
                    `INSERT INTO ${employeeTable.name} (firstName, lastName, position, salary, companyId, departmentId) VALUES (?, ?, ?, ?, ?, ?)`,
                    [`Emp${i}`, `Worker`, 'Staff', 60000, 1, deptId]
                );
            }

            const result = await selectFromEntity(ComplexEmployee)
                .include('department', { columns: ['name', 'location'] })
                .include('company')
                .orderBy(departmentTable.columns.location, 'ASC')
                .executePaged(session, { page: 1, pageSize: 10 });

            expect(result.items).toHaveLength(8);
            const locationsResult = result.items.map(e => e.department!.location);
            expect(locationsResult).toEqual(locationsResult.sort());
        } finally {
            await closeDb(db);
        }
    });

    it('should handle pagination with filters and ordering by multiple columns', async () => {
        @Entity()
        class ComplexCompany {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            industry!: string;

            @HasMany({
                target: () => ComplexEmployee,
                foreignKey: 'companyId'
            })
            employees!: HasManyCollection<ComplexEmployee>;

            @HasMany({
                target: () => ComplexDepartment,
                foreignKey: 'companyId'
            })
            departments!: HasManyCollection<ComplexDepartment>;
        }

        @Entity()
        class ComplexDepartment {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            location!: string;

            @Column(col.int())
            companyId!: number;

            @HasMany({
                target: () => ComplexEmployee,
                foreignKey: 'departmentId'
            })
            employees!: HasManyCollection<ComplexEmployee>;
        }

        @Entity()
        class ComplexEmployee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            firstName!: string;

            @Column(col.varchar(255))
            lastName!: string;

            @Column(col.varchar(100))
            position!: string;

            @Column(col.decimal(10, 2))
            salary!: number;

            @Column(col.int())
            companyId!: number;

            @Column(col.int())
            departmentId!: number;

            @BelongsTo({
                target: () => ComplexCompany,
                foreignKey: 'companyId'
            })
            company?: ComplexCompany;

            @BelongsTo({
                target: () => ComplexDepartment,
                foreignKey: 'departmentId'
            })
            department?: ComplexDepartment;
        }

        const db = new sqlite3.Database(':memory:');

        try {
            bootstrapEntities();
            const companyTable = getTableDefFromEntity(ComplexCompany);
            const employeeTable = getTableDefFromEntity(ComplexEmployee);
            const departmentTable = getTableDefFromEntity(ComplexDepartment);

            if (!companyTable || !employeeTable || !departmentTable) {
                throw new Error('Failed to bootstrap entity tables');
            }

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                companyTable,
                employeeTable,
                departmentTable
            );

            for (let i = 1; i <= 3; i++) {
                await runSql(db,
                    `INSERT INTO ${companyTable.name} (name, industry) VALUES (?, ?)`,
                    [`TechCompany ${i}`, 'Technology']
                );
            }

            for (let i = 1; i <= 3; i++) {
                await runSql(db,
                    `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                    [`Engineering ${i}`, `Office ${i}`, i]
                );
            }

            const employees = [
                { first: 'Charlie', last: 'Alpha', dept: 1, salary: 70000 },
                { first: 'Alice', last: 'Beta', dept: 1, salary: 80000 },
                { first: 'Bob', last: 'Alpha', dept: 2, salary: 75000 },
                { first: 'Alice', last: 'Gamma', dept: 2, salary: 85000 },
                { first: 'Charlie', last: 'Beta', dept: 3, salary: 72000 },
                { first: 'Bob', last: 'Gamma', dept: 3, salary: 78000 },
            ];

            for (const emp of employees) {
                await runSql(db,
                    `INSERT INTO ${employeeTable.name} (firstName, lastName, position, salary, companyId, departmentId) VALUES (?, ?, ?, ?, ?, ?)`,
                    [emp.first, emp.last, 'Developer', emp.salary, emp.dept, emp.dept]
                );
            }

            const result = await selectFromEntity(ComplexEmployee)
                .include('company', { columns: ['name', 'industry'] })
                .include('department', { columns: ['name'] })
                .where(eq(companyTable.columns.industry, 'Technology'))
                .orderBy(employeeTable.columns.firstName, 'ASC')
                .orderBy(employeeTable.columns.lastName, 'ASC')
                .executePaged(session, { page: 1, pageSize: 10 });

            expect(result.items).toHaveLength(6);
            expect(result.totalItems).toBe(6);

            const firstNames = result.items.map(e => e.firstName);
            expect(firstNames).toEqual(firstNames.sort());
        } finally {
            await closeDb(db);
        }
    });

    it('should correctly page results when ordering by numeric column DESC', async () => {
        @Entity()
        class ComplexDepartment {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            location!: string;

            @Column(col.int())
            companyId!: number;

            @HasMany({
                target: () => ComplexEmployee,
                foreignKey: 'departmentId'
            })
            employees!: HasManyCollection<ComplexEmployee>;
        }

        @Entity()
        class ComplexEmployee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            firstName!: string;

            @Column(col.varchar(255))
            lastName!: string;

            @Column(col.varchar(100))
            position!: string;

            @Column(col.decimal(10, 2))
            salary!: number;

            @Column(col.int())
            companyId!: number;

            @Column(col.int())
            departmentId!: number;

            @BelongsTo({
                target: () => ComplexDepartment,
                foreignKey: 'departmentId'
            })
            department?: ComplexDepartment;
        }

        const db = new sqlite3.Database(':memory:');

        try {
            bootstrapEntities();
            const employeeTable = getTableDefFromEntity(ComplexEmployee);
            const departmentTable = getTableDefFromEntity(ComplexDepartment);

            if (!employeeTable || !departmentTable) {
                throw new Error('Failed to bootstrap entity tables');
            }

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                employeeTable,
                departmentTable
            );

            await runSql(db,
                `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                ['Engineering', 'HQ', 1]
            );

            const salaries = [45000, 55000, 65000, 75000, 85000, 95000, 105000];
            for (let i = 0; i < salaries.length; i++) {
                await runSql(db,
                    `INSERT INTO ${employeeTable.name} (firstName, lastName, position, salary, companyId, departmentId) VALUES (?, ?, ?, ?, ?, ?)`,
                    [`Employee${i + 1}`, `Last`, 'Staff', salaries[i], 1, 1]
                );
            }

            const page1 = await selectFromEntity(ComplexEmployee)
                .include('department')
                .orderBy(employeeTable.columns.salary, 'DESC')
                .executePaged(session, { page: 1, pageSize: 3 });

            expect(page1.items).toHaveLength(3);
            expect(page1.totalItems).toBe(7);
            expect(page1.items[0].salary).toBe(105000);
            expect(page1.items[1].salary).toBe(95000);
            expect(page1.items[2].salary).toBe(85000);

            const page2 = await selectFromEntity(ComplexEmployee)
                .include('department')
                .orderBy(employeeTable.columns.salary, 'DESC')
                .executePaged(session, { page: 2, pageSize: 3 });

            expect(page2.items).toHaveLength(3);
            expect(page2.items[0].salary).toBe(75000);
            expect(page2.items[1].salary).toBe(65000);
            expect(page2.items[2].salary).toBe(55000);

            const page3 = await selectFromEntity(ComplexEmployee)
                .include('department')
                .orderBy(employeeTable.columns.salary, 'DESC')
                .executePaged(session, { page: 3, pageSize: 3 });

            expect(page3.items).toHaveLength(1);
            expect(page3.items[0].salary).toBe(45000);
        } finally {
            await closeDb(db);
        }
    });

    it('should correctly handle null relations during paginated query with includes', async () => {
        @Entity()
        class ComplexDepartment {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            name!: string;

            @Column(col.varchar(100))
            location!: string;

            @Column(col.int())
            companyId!: number;
        }

        @Entity()
        class ComplexEmployee {
            @PrimaryKey(col.int())
            id!: number;

            @Column(col.varchar(255))
            firstName!: string;

            @Column(col.varchar(255))
            lastName!: string;

            @Column(col.varchar(100))
            position!: string;

            @Column(col.decimal(10, 2))
            salary!: number;

            @Column(col.int())
            companyId!: number;

            @Column(col.int())
            departmentId!: number;

            @BelongsTo({
                target: () => ComplexDepartment,
                foreignKey: 'departmentId'
            })
            department?: ComplexDepartment;
        }

        const db = new sqlite3.Database(':memory:');

        try {
            bootstrapEntities();
            const employeeTable = getTableDefFromEntity(ComplexEmployee);
            const departmentTable = getTableDefFromEntity(ComplexDepartment);

            if (!employeeTable || !departmentTable) {
                throw new Error('Failed to bootstrap entity tables');
            }

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                employeeTable,
                departmentTable
            );

            await runSql(db,
                `INSERT INTO ${departmentTable.name} (name, location, companyId) VALUES (?, ?, ?)`,
                ['Unassigned', 'TBD', 1]
            );

            await runSql(db,
                `INSERT INTO ${employeeTable.name} (firstName, lastName, position, salary, companyId, departmentId) VALUES (?, ?, ?, ?, ?, ?)`,
                ['John', 'Doe', 'Intern', 30000, 1, 1]
            );
            await runSql(db,
                `INSERT INTO ${employeeTable.name} (firstName, lastName, position, salary, companyId, departmentId) VALUES (?, ?, ?, ?, ?, ?)`,
                ['Jane', 'Smith', 'Manager', 90000, 1, null]
            );

            const result = await selectFromEntity(ComplexEmployee)
                .include('department', { columns: ['name'] })
                .orderBy(employeeTable.columns.firstName, 'ASC')
                .executePaged(session, { page: 1, pageSize: 10 });

            expect(result.items).toHaveLength(2);
            expect(result.totalItems).toBe(2);

            const john = result.items.find(e => e.firstName === 'John');
            expect(john!.department).toBeDefined();
            expect(john!.department!.name).toBe('Unassigned');

            const jane = result.items.find(e => e.firstName === 'Jane');
            expect(jane!.department).toBeDefined();
            expect(jane!.department!.name).toBeUndefined();
        } finally {
            await closeDb(db);
        }
    });
});
