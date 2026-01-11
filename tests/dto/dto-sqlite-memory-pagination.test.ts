import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import sqlite3 from 'sqlite3';

import { eq } from '../../src/core/ast/expression.js';
import { col } from '../../src/schema/column-types.js';
import { type HasManyCollection } from '../../src/schema/types.js';
import {
    bootstrapEntities,
    Column,
    Entity,
    HasMany,
    BelongsTo,
    PrimaryKey,
    getTableDefFromEntity,
    selectFromEntity,
    entityRef
} from '../../src/decorators/index.js';
import { insertInto } from '../../src/query/index.js';
import { executeSchemaSqlFor } from '../../src/core/ddl/schema-generator.js';
import { SQLiteSchemaDialect } from '../../src/core/ddl/dialects/sqlite-schema-dialect.js';
import { createSqliteSessionFromDb, closeDb } from '../e2e/sqlite-helpers.js';
import { Dto, WithRelations, toPagedResponse, type PagedResponse } from '../../src/dto/index.js';

@Entity()
class Department {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.notNull(col.varchar(100)))
    name!: string;

    @Column(col.varchar(255))
    description?: string;

    @Column(col.varchar(50))
    location!: string;

    @HasMany({
        target: () => Employee,
        foreignKey: 'departmentId'
    })
    employees!: HasManyCollection<Employee>;
}

@Entity()
class Employee {
    @PrimaryKey(col.int())
    id!: number;

    @Column(col.notNull(col.varchar(100)))
    firstName!: string;

    @Column(col.notNull(col.varchar(100)))
    lastName!: string;

    @Column(col.notNull(col.varchar(100)))
    position!: string;

    @Column(col.decimal(10, 2))
    salary!: number;

    @Column(col.int())
    departmentId!: number;

    @BelongsTo({
        target: () => Department,
        foreignKey: 'departmentId'
    })
    department?: Department;
}

type DepartmentResponse = Dto<typeof Department, never>;
type EmployeeResponse = Dto<typeof Employee, 'departmentId'>;
type EmployeeWithDepartment = WithRelations<EmployeeResponse, { department: DepartmentResponse }>;

describe('DTO Express Integration with SQLite Memory and Pagination', () => {
    let app: express.Express;
    let db: sqlite3.Database;

    beforeAll(async () => {
        bootstrapEntities();

        db = new sqlite3.Database(':memory:');
        const session = createSqliteSessionFromDb(db);

        const departmentTable = getTableDefFromEntity(Department)!;
        const employeeTable = getTableDefFromEntity(Employee)!;

        await executeSchemaSqlFor(
            session.executor,
            new SQLiteSchemaDialect(),
            departmentTable,
            employeeTable
        );

        const departmentValues = [
            { id: 1, name: 'Engineering', description: 'Software Development Department', location: 'Building A' },
            { id: 2, name: 'Marketing', description: 'Marketing and Sales Department', location: 'Building B' },
            { id: 3, name: 'Human Resources', description: 'HR Management Department', location: 'Building C' },
            { id: 4, name: 'Finance', description: 'Financial Planning Department', location: 'Building A' }
        ];

        const employeeValues = [
            { id: 1, firstName: 'John', lastName: 'Doe', position: 'Senior Developer', salary: 95000.00, departmentId: 1 },
            { id: 2, firstName: 'Jane', lastName: 'Smith', position: 'Tech Lead', salary: 115000.00, departmentId: 1 },
            { id: 3, firstName: 'Bob', lastName: 'Johnson', position: 'Marketing Manager', salary: 85000.00, departmentId: 2 },
            { id: 4, firstName: 'Alice', lastName: 'Williams', position: 'Marketing Specialist', salary: 65000.00, departmentId: 2 },
            { id: 5, firstName: 'Charlie', lastName: 'Brown', position: 'HR Coordinator', salary: 60000.00, departmentId: 3 },
            { id: 6, firstName: 'Diana', lastName: 'Miller', position: 'HR Manager', salary: 80000.00, departmentId: 3 },
            { id: 7, firstName: 'Eve', lastName: 'Davis', position: 'Financial Analyst', salary: 75000.00, departmentId: 4 },
            { id: 8, firstName: 'Frank', lastName: 'Garcia', position: 'Senior Financial Analyst', salary: 90000.00, departmentId: 4 },
            { id: 9, firstName: 'Grace', lastName: 'Martinez', position: 'Junior Developer', salary: 55000.00, departmentId: 1 },
            { id: 10, firstName: 'Henry', lastName: 'Anderson', position: 'Marketing Coordinator', salary: 55000.00, departmentId: 2 },
            { id: 11, firstName: 'Ivy', lastName: 'Thomas', position: 'HR Assistant', salary: 45000.00, departmentId: 3 },
            { id: 12, firstName: 'Jack', lastName: 'Jackson', position: 'Finance Assistant', salary: 50000.00, departmentId: 4 },
            { id: 13, firstName: 'Karen', lastName: 'White', position: 'DevOps Engineer', salary: 100000.00, departmentId: 1 },
            { id: 14, firstName: 'Leo', lastName: 'Harris', position: 'Content Marketing Manager', salary: 70000.00, departmentId: 2 },
            { id: 15, firstName: 'Mia', lastName: 'Clark', position: 'Recruiter', salary: 55000.00, departmentId: 3 },
            { id: 16, firstName: 'Nathan', lastName: 'Lewis', position: 'Senior Accountant', salary: 85000.00, departmentId: 4 },
            { id: 17, firstName: 'Olivia', lastName: 'Walker', position: 'QA Engineer', salary: 70000.00, departmentId: 1 },
            { id: 18, firstName: 'Paul', lastName: 'Hall', position: 'Digital Marketing Specialist', salary: 60000.00, departmentId: 2 },
            { id: 19, firstName: 'Quinn', lastName: 'Allen', position: 'Benefits Specialist', salary: 52000.00, departmentId: 3 },
            { id: 20, firstName: 'Rachel', lastName: 'Young', position: 'Budget Analyst', salary: 62000.00, departmentId: 4 }
        ];

        let compiled = insertInto(Department).values(departmentValues).compile(session.dialect);
        await session.executor.executeSql(compiled.sql, compiled.params);

        compiled = insertInto(Employee).values(employeeValues).compile(session.dialect);
        await session.executor.executeSql(compiled.sql, compiled.params);
    });

    afterAll(async () => {
        await closeDb(db);
    });

    beforeEach(() => {
        app = express();
        app.use(express.json());

        const d = entityRef(Department);
        const e = entityRef(Employee);
        const session = createSqliteSessionFromDb(db);

        app.get('/departments', async (req, res) => {
            const page = Math.max(1, parseInt((req.query.page as string) || '1'));
            const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) || '5')));

            const result = await selectFromEntity(Department)
                .select({
                    id: d.$.id,
                    name: d.$.name,
                    description: d.$.description,
                    location: d.$.location
                })
                .orderBy(d.$.name)
                .executePaged(session, { page, pageSize });

            res.json(toPagedResponse(result));
        });

        app.get('/departments/:id', async (req, res) => {
            const id = parseInt(req.params.id);

            const [department] = await selectFromEntity(Department)
                .select({
                    id: d.$.id,
                    name: d.$.name,
                    description: d.$.description,
                    location: d.$.location
                })
                .where(eq(d.$.id, id))
                .execute(session);

            if (!department) {
                return res.status(404).json({ error: 'Department not found' });
            }

            res.json(department);
        });

        app.get('/departments/:id/employees', async (req, res) => {
            const departmentId = parseInt(req.params.id);
            const page = Math.max(1, parseInt((req.query.page as string) || '1'));
            const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) || '5')));

            const [department] = await selectFromEntity(Department)
                .select({
                    id: d.$.id,
                    name: d.$.name
                })
                .where(eq(d.$.id, departmentId))
                .execute(session);

            if (!department) {
                return res.status(404).json({ error: 'Department not found' });
            }

            const result = await selectFromEntity(Employee)
                .select({
                    id: e.$.id,
                    firstName: e.$.firstName,
                    lastName: e.$.lastName,
                    position: e.$.position,
                    salary: e.$.salary
                })
                .where(eq(e.$.departmentId, departmentId))
                .orderBy(e.$.lastName)
                .executePaged(session, { page, pageSize });

            res.json({
                ...department,
                employees: result.items,
                pagination: toPagedResponse(result)
            });
        });

        app.get('/employees', async (req, res) => {
            const page = Math.max(1, parseInt((req.query.page as string) || '1'));
            const pageSize = Math.min(100, Math.max(1, parseInt((req.query.pageSize as string) || '5')));

            const result = await selectFromEntity(Employee)
                .select({
                    id: e.$.id,
                    firstName: e.$.firstName,
                    lastName: e.$.lastName,
                    position: e.$.position,
                    salary: e.$.salary
                })
                .orderBy(e.$.lastName)
                .executePaged(session, { page, pageSize });

            res.json(toPagedResponse(result));
        });

        app.get('/employees/:id', async (req, res) => {
            const id = parseInt(req.params.id);

            const [employee] = await selectFromEntity(Employee)
                .select({
                    id: e.$.id,
                    firstName: e.$.firstName,
                    lastName: e.$.lastName,
                    position: e.$.position,
                    salary: e.$.salary
                })
                .where(eq(e.$.id, id))
                .execute(session);

            if (!employee) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            res.json(employee);
        });

        app.get('/employees/:id/department', async (req, res) => {
            const id = parseInt(req.params.id);

            const [employee] = await selectFromEntity(Employee)
                .select({
                    id: e.$.id,
                    firstName: e.$.firstName,
                    lastName: e.$.lastName,
                    position: e.$.position,
                    salary: e.$.salary,
                    departmentId: e.$.departmentId
                })
                .where(eq(e.$.id, id))
                .execute(session);

            if (!employee) {
                return res.status(404).json({ error: 'Employee not found' });
            }

            const [department] = await selectFromEntity(Department)
                .select({
                    id: d.$.id,
                    name: d.$.name,
                    location: d.$.location
                })
                .where(eq(d.$.id, employee.departmentId))
                .execute(session);

            res.json({
                ...employee,
                department
            });
        });
    });

    describe('GET /departments (paginated)', () => {
        it('returns first page with default pageSize', async () => {
            const response = await request(app).get('/departments');

            expect(response.status).toBe(200);
            expect(response.body.items).toHaveLength(4);
            expect(response.body.totalItems).toBe(4);
            expect(response.body.page).toBe(1);
            expect(response.body.pageSize).toBe(5);
        });

        it('returns all departments on single page', async () => {
            const response = await request(app).get('/departments?pageSize=10');

            expect(response.status).toBe(200);
            expect(response.body.items).toHaveLength(4);
            expect(response.body.pageSize).toBe(10);
        });

        it('returns correct department data', async () => {
            const response = await request(app).get('/departments');

            const dept = response.body.items[0] as DepartmentResponse;
            expect(dept).toMatchObject({
                id: expect.any(Number),
                name: expect.any(String),
                location: expect.any(String)
            });
        });
    });

    describe('GET /departments/:id', () => {
        it('returns department by id', async () => {
            const response = await request(app).get('/departments/1');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                id: 1,
                name: 'Engineering',
                location: 'Building A'
            });
        });

        it('returns 404 for non-existent department', async () => {
            const response = await request(app).get('/departments/999');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Department not found' });
        });
    });

    describe('GET /departments/:id/employees (paginated)', () => {
        it('returns paginated employees for department', async () => {
            const response = await request(app).get('/departments/1/employees');

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Engineering');
            expect(response.body.employees).toHaveLength(5);
        });

        it('respects pagination parameters', async () => {
            const response = await request(app).get('/departments/1/employees?page=1&pageSize=2');

            expect(response.status).toBe(200);
            expect(response.body.employees).toHaveLength(2);
            expect(response.body.pagination.page).toBe(1);
            expect(response.body.pagination.pageSize).toBe(2);
            expect(response.body.pagination.totalItems).toBe(5);
            expect(response.body.pagination.totalPages).toBe(3);
            expect(response.body.pagination.hasNextPage).toBe(true);
            expect(response.body.pagination.hasPrevPage).toBe(false);
        });

        it('returns second page correctly', async () => {
            const response = await request(app).get('/departments/1/employees?page=2&pageSize=2');

            expect(response.status).toBe(200);
            expect(response.body.employees).toHaveLength(2);
            expect(response.body.pagination.page).toBe(2);
            expect(response.body.pagination.hasNextPage).toBe(true);
            expect(response.body.pagination.hasPrevPage).toBe(true);
        });

        it('returns 404 for non-existent department', async () => {
            const response = await request(app).get('/departments/999/employees');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Department not found' });
        });
    });

    describe('GET /employees (paginated)', () => {
        it('returns first page with default pagination', async () => {
            const response = await request(app).get('/employees');

            expect(response.status).toBe(200);
            expect(response.body.items).toHaveLength(5);
            expect(response.body.totalItems).toBe(20);
            expect(response.body.page).toBe(1);
        });

        it('respects custom pageSize', async () => {
            const response = await request(app).get('/employees?pageSize=7');

            expect(response.status).toBe(200);
            expect(response.body.items).toHaveLength(7);
            expect(response.body.pageSize).toBe(7);
            expect(response.body.totalPages).toBe(3);
        });

        it('navigates to different pages', async () => {
            const response = await request(app).get('/employees?page=3&pageSize=5');

            expect(response.status).toBe(200);
            expect(response.body.items).toHaveLength(5);
            expect(response.body.page).toBe(3);
            expect(response.body.hasPrevPage).toBe(true);
        });

        it('handles last page with fewer items', async () => {
            const response = await request(app).get('/employees?page=5&pageSize=5');

            expect(response.status).toBe(200);
            expect(response.body.items).toHaveLength(0);
            expect(response.body.totalItems).toBe(20);
        });

        it('returns typed employee response', async () => {
            const response = await request(app).get('/employees');

            const paged = response.body as PagedResponse<EmployeeResponse>;
            const employee = paged.items[0] as EmployeeResponse;
            expect(employee).toMatchObject({
                id: expect.any(Number),
                firstName: expect.any(String),
                lastName: expect.any(String),
                position: expect.any(String),
                salary: expect.any(Number)
            });
            expect('departmentId' in employee).toBe(false);
        });
    });

    describe('GET /employees/:id', () => {
        it('returns employee by id', async () => {
            const response = await request(app).get('/employees/1');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                id: 1,
                firstName: 'John',
                lastName: 'Doe',
                position: 'Senior Developer'
            });
        });

        it('returns 404 for non-existent employee', async () => {
            const response = await request(app).get('/employees/999');

            expect(response.status).toBe(404);
            expect(response.body).toEqual({ error: 'Employee not found' });
        });
    });

    describe('GET /employees/:id/department', () => {
        it('returns employee with department info', async () => {
            const response = await request(app).get('/employees/1/department');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                id: 1,
                firstName: 'John',
                lastName: 'Doe',
                department: {
                    id: 1,
                    name: 'Engineering'
                }
            });
        });

        it('returns typed employee with department', async () => {
            const response = await request(app).get('/employees/5/department');

            const data = response.body as EmployeeWithDepartment;
            expect(data.department).toMatchObject({
                id: expect.any(Number),
                name: expect.any(String),
                location: expect.any(String)
            });
        });
    });

    describe('Pagination metadata', () => {
        it('calculates totalPages correctly for employees', async () => {
            const response = await request(app).get('/employees?pageSize=3');

            expect(response.status).toBe(200);
            expect(response.body.totalPages).toBe(7);
        });

        it('shows hasNextPage correctly on middle pages', async () => {
            const response = await request(app).get('/employees?page=3&pageSize=5');

            expect(response.status).toBe(200);
            expect(response.body.hasNextPage).toBe(true);
            expect(response.body.hasPrevPage).toBe(true);
        });

        it('shows hasNextPage false on last page', async () => {
            const response = await request(app).get('/employees?page=4&pageSize=5');

            expect(response.status).toBe(200);
            expect(response.body.hasNextPage).toBe(false);
            expect(response.body.hasPrevPage).toBe(true);
        });
    });
});
