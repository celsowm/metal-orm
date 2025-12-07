import { describe, it, expect } from 'vitest';
import { main } from '../scripts/generate-level3.mjs';
import fs from 'fs';
import path from 'path';

describe('Generation Script', () => {
  it('should generate entity files from a schema', async () => {
    const outputDir = './gen-test';
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    // Call the main function with arguments
    await main(['--dialect=sqlite', `--output=${outputDir}`]);

    const usersContent = fs.readFileSync(path.join(outputDir, 'Users.ts'), 'utf-8');
    const postsContent = fs.readFileSync(path.join(outputDir, 'Posts.ts'), 'utf-8');

    expect(usersContent).toContain('@Entity({ tableName: \'users\' })');
    expect(usersContent).toContain('export class Users {');
    expect(usersContent).toContain('@PrimaryKey(col.int())');
    expect(usersContent).toContain('id!: number;');
    expect(usersContent).toContain('@Column(col.string())');
    expect(usersContent).toContain('name!: string;');
    expect(usersContent).toContain('@HasMany({ target: () => Posts, foreignKey: \'user_id\' })');
    expect(usersContent).toContain('posts!: Posts[];');

    expect(postsContent).toContain('@Entity({ tableName: \'posts\' })');
    expect(postsContent).toContain('export class Posts {');
    expect(postsContent).toContain('@PrimaryKey(col.int())');
    expect(postsContent).toContain('id!: number;');
    expect(postsContent).toContain('@Column(col.string())');
    expect(postsContent).toContain('title!: string;');
    expect(postsContent).toContain('@Column(col.int())');
    expect(postsContent).toContain('user_id?: number | null;');
    expect(postsContent).toContain('@BelongsTo({ target: () => Users, foreignKey: \'user_id\' })');
    expect(postsContent).toContain('users!: Users;');

    fs.rmSync(outputDir, { recursive: true, force: true });
  });
});
