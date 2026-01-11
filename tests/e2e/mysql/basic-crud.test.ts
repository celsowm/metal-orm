import { describe, it, expect, beforeEach } from 'vitest';
import { getSetup, createUsersTable, seedUsers, getAllRows, countRows, cleanDatabase } from './helpers.js';

/**
 * Basic CRUD operations test demonstrating the optimized MySQL singleton pattern.
 * 
 * Notice:
 * - MySQL server auto-initializes on first test
 * - Database is automatically cleaned before each test for isolation
 * - All tests share the same MySQL server instance (faster!)
 */
describe('MySQL Basic CRUD Operations', () => {
    // Clean database before each test to ensure isolation
    beforeEach(async () => {
        await cleanDatabase();
    });
    it('should create a table and insert data', async () => {
        const { connection } = await getSetup();

        await createUsersTable(connection);

        await connection.execute(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            ['John Doe', 'john@example.com']
        );

        const [rows] = await connection.execute('SELECT * FROM users');
        expect(rows).toHaveLength(1);
        expect((rows as any)[0].name).toBe('John Doe');
        expect((rows as any)[0].email).toBe('john@example.com');
    });

    it('should handle multiple inserts', async () => {
        const { connection } = await getSetup();

        await createUsersTable(connection);

        await seedUsers(connection, [
            { name: 'Alice', email: 'alice@example.com' },
            { name: 'Bob', email: 'bob@example.com' },
            { name: 'Charlie' },
        ]);

        const count = await countRows(connection, 'users');
        expect(count).toBe(3);

        const users = await getAllRows(connection, 'users');
        expect(users).toHaveLength(3);
        expect(users[2]).toMatchObject({ name: 'Charlie' });
    });

    it('should update records', async () => {
        const { connection } = await getSetup();

        await createUsersTable(connection);
        await seedUsers(connection, [{ name: 'Original Name', email: 'test@example.com' }]);

        await connection.execute(
            'UPDATE users SET name = ? WHERE email = ?',
            ['Updated Name', 'test@example.com']
        );

        const [rows] = await connection.execute('SELECT * FROM users WHERE email = ?', ['test@example.com']);
        expect((rows as any)[0].name).toBe('Updated Name');
    });

    it('should delete records', async () => {
        const { connection } = await getSetup();

        await createUsersTable(connection);
        await seedUsers(connection, [
            { name: 'User 1' },
            { name: 'User 2' },
            { name: 'User 3' },
        ]);

        await connection.execute('DELETE FROM users WHERE name = ?', ['User 2']);

        const count = await countRows(connection, 'users');
        expect(count).toBe(2);

        const users = await getAllRows(connection, 'users');
        expect(users.map((u: any) => u.name)).toEqual(['User 1', 'User 3']);
    });

    it('should verify test isolation (clean database between tests)', async () => {
        const { connection } = await getSetup();

        // This test verifies that the database is clean
        // If the previous tests' data persisted, this would fail

        await createUsersTable(connection);
        const count = await countRows(connection, 'users');
        expect(count).toBe(0); // Database should be empty at start of each test
    });
});
