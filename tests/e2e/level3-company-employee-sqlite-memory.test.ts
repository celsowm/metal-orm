import { describe, expect, it } from 'vitest';
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
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import {
    closeDb,
    createSqliteSessionFromDb,
    runSql
} from './sqlite-helpers.ts';

@Entity()
class Company {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.varchar(255))
    name!: string;

    @Column(col.varchar(255))
    industry!: string;

    @Column(col.varchar(255))
    headquarters!: string;

    @HasMany({
        target: () => Employee,
        foreignKey: 'companyId'
    })
    employees!: HasManyCollection<Employee>;
}

@Entity()
class Employee {
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

    @BelongsTo({
        target: () => Company,
        foreignKey: 'companyId'
    })
    company?: Company;
}

describe('Level 3 - Company & Employee e2e (SQLite Memory)', () => {
    it('should perform comprehensive CRUD operations with belongsTo relationship', async () => {
        const db = new sqlite3.Database(':memory:');

        try {
            // Bootstrap entities and verify schema
            const tables = bootstrapEntities();
            const companyTable = getTableDefFromEntity(Company);
            const employeeTable = getTableDefFromEntity(Employee);

            expect(companyTable).toBeDefined();
            expect(employeeTable).toBeDefined();
            expect(tables).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ name: 'companys' }),
                    expect.objectContaining({ name: 'employees' })
                ])
            );

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                companyTable!,
                employeeTable!
            );

            // Test INSERT operations using manual SQL
            console.log('Testing INSERT operations...');

            // Insert companies
            await runSql(
                db,
                'INSERT INTO companys (name, industry, headquarters) VALUES (?, ?, ?);',
                ['TechCorp Solutions', 'Software Development', 'San Francisco, CA']
            );

            await runSql(
                db,
                'INSERT INTO companys (name, industry, headquarters) VALUES (?, ?, ?);',
                ['Global Industries', 'Manufacturing', 'Detroit, MI']
            );

            await runSql(
                db,
                'INSERT INTO companys (name, industry, headquarters) VALUES (?, ?, ?);',
                ['DataDriven Analytics', 'Data Science', 'Austin, TX']
            );

            // Insert employees
            await runSql(
                db,
                'INSERT INTO employees (firstName, lastName, position, salary, companyId) VALUES (?, ?, ?, ?, ?);',
                ['John', 'Smith', 'Senior Software Engineer', 95000.00, 1]
            );

            await runSql(
                db,
                'INSERT INTO employees (firstName, lastName, position, salary, companyId) VALUES (?, ?, ?, ?, ?);',
                ['Jane', 'Doe', 'Product Manager', 105000.00, 1]
            );

            await runSql(
                db,
                'INSERT INTO employees (firstName, lastName, position, salary, companyId) VALUES (?, ?, ?, ?, ?);',
                ['Mike', 'Johnson', 'Manufacturing Engineer', 78000.00, 2]
            );

            await runSql(
                db,
                'INSERT INTO employees (firstName, lastName, position, salary, companyId) VALUES (?, ?, ?, ?, ?);',
                ['Sarah', 'Williams', 'Data Scientist', 92000.00, 3]
            );

            const companyColumns = companyTable!.columns;
            const employeeColumns = employeeTable!.columns;

            // Test SELECT with belongsTo relationship
            console.log('Testing SELECT with belongsTo relationship...');

            const [employeeWithCompany] = await selectFromEntity(Employee)
                .select({
                    id: employeeColumns.id,
                    firstName: employeeColumns.firstName,
                    lastName: employeeColumns.lastName,
                    position: employeeColumns.position,
                    salary: employeeColumns.salary,
                    companyId: employeeColumns.companyId
                })
                .includeLazy('company')
                .where(eq(employeeColumns.firstName, 'John'))
                .execute(session);

            expect(employeeWithCompany).toBeDefined();
            expect(employeeWithCompany.firstName).toBe('John');
            expect(employeeWithCompany.company).toBeDefined();

            // Load the company relation
            const company = await (employeeWithCompany.company as any).load();
            expect(company).toBeDefined();
            expect(company!.name).toBe('TechCorp Solutions');
            expect(company!.industry).toBe('Software Development');

            // Test SELECT with multiple employees from same company
            console.log('Testing multiple employees from same company...');

            const employeesInTechCorp = await selectFromEntity(Employee)
                .select({
                    id: employeeColumns.id,
                    firstName: employeeColumns.firstName,
                    lastName: employeeColumns.lastName,
                    position: employeeColumns.position,
                    salary: employeeColumns.salary,
                    companyId: employeeColumns.companyId
                })
                .includeLazy('company')
                .where(eq(employeeColumns.companyId, 1))
                .orderBy(employeeColumns.firstName)
                .execute(session);

            expect(employeesInTechCorp).toHaveLength(2);
            expect(employeesInTechCorp.map(emp => emp.firstName)).toEqual(['Jane', 'John']);

            // Verify all employees have the correct company loaded
            for (const emp of employeesInTechCorp) {
                const empCompany = await (emp.company as any).load();
                expect(empCompany!.name).toBe('TechCorp Solutions');
            }

            // Test UPDATE operations using manual SQL
            console.log('Testing UPDATE operations...');

            await runSql(
                db,
                'UPDATE employees SET salary = ?, position = ? WHERE id = ?;',
                [102000.00, 'Lead Software Engineer', 1]
            );

            // Verify update persisted (use a new session to avoid identity map caching)
            const verificationSession = createSqliteSessionFromDb(db);
            const [verifiedEmployee] = await selectFromEntity(Employee)
                .select({
                    id: employeeColumns.id,
                    salary: employeeColumns.salary,
                    position: employeeColumns.position
                })
                .where(eq(employeeColumns.id, 1))
                .execute(verificationSession);

            expect(verifiedEmployee.salary).toBe(102000.00);
            expect(verifiedEmployee.position).toBe('Lead Software Engineer');

            // Test SELECT using string column names
            const [employeeByStringColumns] = await selectFromEntity(Employee)
                .select('id', 'firstName', 'lastName', 'salary')
                .where(eq(employeeColumns.id, 2))
                .execute(session);

            expect(employeeByStringColumns).toBeDefined();
            expect(employeeByStringColumns.firstName).toBe('Jane');
            expect(employeeByStringColumns.lastName).toBe('Doe');
            expect(employeeByStringColumns.salary).toBe(105000.00);

            // Test complex query with ordering
            console.log('Testing complex queries...');

            const [topEarner] = await selectFromEntity(Employee)
                .select({
                    id: employeeColumns.id,
                    firstName: employeeColumns.firstName,
                    lastName: employeeColumns.lastName,
                    salary: employeeColumns.salary,
                    position: employeeColumns.position
                })
                .orderBy(employeeColumns.salary, 'DESC')
                .limit(1)
                .execute(session);

            expect(topEarner).toBeDefined();
            expect(topEarner.firstName).toBe('Jane');
            expect(topEarner.salary).toBe(105000.00);

            // Test DELETE operations using manual SQL
            console.log('Testing DELETE operations...');

            await runSql(
                db,
                'DELETE FROM employees WHERE id = ?;',
                [4]
            );

            // Verify deletion
            const remainingEmployees = await selectFromEntity(Employee)
                .select({
                    id: employeeColumns.id
                })
                .execute(session);

            expect(remainingEmployees).toHaveLength(3);

            // Test aggregate operations
            console.log('Testing aggregate operations...');

            const employeesByCompany = await selectFromEntity(Company)
                .select({
                    id: companyColumns.id,
                    name: companyColumns.name,
                    industry: companyColumns.industry
                })
                .includeLazy('employees')
                .execute(session);

            expect(employeesByCompany).toHaveLength(3);

            // Verify company-employee relationships
            for (const company of employeesByCompany) {
                const employees = await company.employees.load();
                if (company.name === 'TechCorp Solutions') {
                    expect(employees).toHaveLength(2);
                } else if (company.name === 'Global Industries') {
                    expect(employees).toHaveLength(1);
                } else if (company.name === 'DataDriven Analytics') {
                    expect(employees).toHaveLength(0); // We deleted the employee
                }
            }

            console.log('All tests passed successfully!');

        } finally {
            await closeDb(db);
        }
    });

    it('should handle belongsTo relation with null references', async () => {
        const db = new sqlite3.Database(':memory:');

        try {
            // Bootstrap entities
            bootstrapEntities();
            const companyTable = getTableDefFromEntity(Company);
            const employeeTable = getTableDefFromEntity(Employee);

            const session = createSqliteSessionFromDb(db);
            await executeSchemaSqlFor(
                session.executor,
                new SQLiteSchemaDialect(),
                companyTable!,
                employeeTable!
            );
            const employeeColumns = employeeTable!.columns;

            // Insert employee without company (companyId = null)
            await runSql(
                db,
                'INSERT INTO employees (firstName, lastName, position, salary, companyId) VALUES (?, ?, ?, ?, NULL);',
                ['Orphan', 'Worker', 'Freelancer', 50000.00]
            );

            // Insert employee with invalid companyId
            await runSql(
                db,
                'INSERT INTO employees (firstName, lastName, position, salary, companyId) VALUES (?, ?, ?, ?, ?);',
                ['Invalid', 'Employee', 'Contractor', 45000.00, 99999]
            );

            // Test loading employee with null company reference
            const [employee] = await selectFromEntity(Employee)
                .select({
                    id: employeeColumns.id,
                    firstName: employeeColumns.firstName,
                    lastName: employeeColumns.lastName,
                    companyId: employeeColumns.companyId
                })
                .includeLazy('company')
                .where(eq(employeeColumns.firstName, 'Orphan'))
                .execute(session);

            expect(employee).toBeDefined();
            expect(employee.companyId).toBeNull();

            // The company relation should handle null gracefully
            const company = await (employee.company as any)?.load?.();
            expect(company).toBeNull(); // or undefined, depending on implementation

            console.log('Null reference test passed!');

        } finally {
            await closeDb(db);
        }
    });
});
