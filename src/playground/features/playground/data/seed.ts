export const SEED_SQL = `
  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT, settings TEXT, deleted_at TEXT);
  CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, total INTEGER, status TEXT);
  CREATE TABLE profiles (id INTEGER PRIMARY KEY, user_id INTEGER, bio TEXT, twitter TEXT);
  CREATE TABLE roles (id INTEGER PRIMARY KEY, name TEXT, level TEXT);
  CREATE TABLE user_roles (id INTEGER PRIMARY KEY, user_id INTEGER, role_id INTEGER);

  INSERT INTO users VALUES (1, 'Alice Engineer', 'admin', '{"theme":"dark"}', NULL);
  INSERT INTO users VALUES (2, 'Bob Manager', 'user', '{"theme":"light"}', NULL);
  INSERT INTO users VALUES (3, 'Charlie Intern', 'user', '{"theme":"dark"}', '2023-01-01');
  INSERT INTO users VALUES (4, 'David CTO', 'admin', '{"notifications":true}', NULL);

  INSERT INTO orders VALUES (101, 1, 500, 'completed');
  INSERT INTO orders VALUES (102, 1, 120, 'pending');
  INSERT INTO orders VALUES (103, 2, 900, 'completed');
  INSERT INTO orders VALUES (104, 3, 50, 'cancelled');
  INSERT INTO orders VALUES (105, 1, 300, 'completed');

  INSERT INTO profiles VALUES (1, 1, 'Lead Systems Engineer with API obsession', '@alice_engineer');
  INSERT INTO profiles VALUES (2, 2, 'Operations manager who optimizes everything', '@bob_ops');
  INSERT INTO profiles VALUES (3, 3, 'Intern documenting every experiment', '@charlie_docs');
  INSERT INTO profiles VALUES (4, 4, 'CTO crafting scalable futures', '@david_cto');

  INSERT INTO roles VALUES (1, 'admin', 'platform');
  INSERT INTO roles VALUES (2, 'manager', 'operations');
  INSERT INTO roles VALUES (3, 'intern', 'learning');

  INSERT INTO user_roles VALUES (1, 1, 1);
  INSERT INTO user_roles VALUES (2, 1, 2);
  INSERT INTO user_roles VALUES (3, 2, 2);
  INSERT INTO user_roles VALUES (4, 3, 3);
  INSERT INTO user_roles VALUES (5, 4, 1);
`;
