import { describe, it, expect, beforeEach } from 'vitest';
import { getSetup, createUsersTable, createPostsTable, seedUsers, cleanDatabase } from './helpers.js';

/**
 * Tests demonstrating relational queries with the Metal ORM on MySQL.
 * Uses the singleton pattern for optimal performance.
 */
describe('MySQL Relational Operations', () => {
    // Clean database before each test to ensure isolation
    beforeEach(async () => {
        await cleanDatabase();
    });
    it('should handle foreign key relationships', async () => {
        const { connection } = await getSetup();

        await createUsersTable(connection);
        await createPostsTable(connection);

        // Insert a user
        await connection.execute(
            'INSERT INTO users (name, email) VALUES (?, ?)',
            ['Author', 'author@example.com']
        );

        // Get the user ID
        const [users] = await connection.execute('SELECT id FROM users WHERE name = ?', ['Author']);
        const userId = (users as any)[0].id;

        // Insert posts for this user
        await connection.execute(
            'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
            [userId, 'First Post', 'Hello World']
        );
        await connection.execute(
            'INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)',
            [userId, 'Second Post', 'Another post']
        );

        // Query with JOIN
        const [posts] = await connection.execute(`
      SELECT p.*, u.name as author_name, u.email as author_email
      FROM posts p
      INNER JOIN users u ON p.user_id = u.id
      WHERE u.name = ?
    `, ['Author']);

        expect(posts).toHaveLength(2);
        expect((posts as any)[0].author_name).toBe('Author');
        expect((posts as any)[0].title).toBe('First Post');
        expect((posts as any)[1].title).toBe('Second Post');
    });

    it('should cascade delete with foreign keys', async () => {
        const { connection } = await getSetup();

        await createUsersTable(connection);
        await createPostsTable(connection);

        // Insert user and posts
        await connection.execute(
            'INSERT INTO users (name) VALUES (?)',
            ['Test User']
        );
        const [users] = await connection.execute('SELECT id FROM users WHERE name = ?', ['Test User']);
        const userId = (users as any)[0].id;

        await connection.execute(
            'INSERT INTO posts (user_id, title) VALUES (?, ?)',
            [userId, 'Post 1']
        );
        await connection.execute(
            'INSERT INTO posts (user_id, title) VALUES (?, ?)',
            [userId, 'Post 2']
        );

        // Verify posts exist
        const [beforeDelete] = await connection.execute('SELECT COUNT(*) as count FROM posts');
        expect((beforeDelete as any)[0].count).toBe(2);

        // Delete the user - should cascade delete posts
        await connection.execute('DELETE FROM users WHERE id = ?', [userId]);

        // Verify posts were deleted
        const [afterDelete] = await connection.execute('SELECT COUNT(*) as count FROM posts');
        expect((afterDelete as any)[0].count).toBe(0);
    });

    it('should handle multiple users with posts', async () => {
        const { connection } = await getSetup();

        await createUsersTable(connection);
        await createPostsTable(connection);

        // Create multiple users
        await seedUsers(connection, [
            { name: 'Alice', email: 'alice@example.com' },
            { name: 'Bob', email: 'bob@example.com' },
        ]);

        const [users] = await connection.execute('SELECT id, name FROM users ORDER BY name');
        const alice = (users as any)[0];
        const bob = (users as any)[1];

        // Create posts for each user
        await connection.execute(
            'INSERT INTO posts (user_id, title) VALUES (?, ?)',
            [alice.id, 'Alice Post 1']
        );
        await connection.execute(
            'INSERT INTO posts (user_id, title) VALUES (?, ?)',
            [alice.id, 'Alice Post 2']
        );
        await connection.execute(
            'INSERT INTO posts (user_id, title) VALUES (?, ?)',
            [bob.id, 'Bob Post 1']
        );

        // Count posts per user
        const [alicePosts] = await connection.execute(
            'SELECT COUNT(*) as count FROM posts WHERE user_id = ?',
            [alice.id]
        );
        expect((alicePosts as any)[0].count).toBe(2);

        const [bobPosts] = await connection.execute(
            'SELECT COUNT(*) as count FROM posts WHERE user_id = ?',
            [bob.id]
        );
        expect((bobPosts as any)[0].count).toBe(1);
    });
});
