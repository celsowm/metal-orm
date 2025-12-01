export const SEED_SQL = `
  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, role TEXT, settings TEXT, deleted_at TEXT);
  CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, total INTEGER, status TEXT);
  
  INSERT INTO users VALUES (1, 'Alice Engineer', 'admin', '{"theme":"dark"}', NULL);
  INSERT INTO users VALUES (2, 'Bob Manager', 'user', '{"theme":"light"}', NULL);
  INSERT INTO users VALUES (3, 'Charlie Intern', 'user', '{"theme":"dark"}', '2023-01-01');
  INSERT INTO users VALUES (4, 'David CTO', 'admin', '{"notifications":true}', NULL);
  
  INSERT INTO orders VALUES (101, 1, 500, 'completed');
  INSERT INTO orders VALUES (102, 1, 120, 'pending');
  INSERT INTO orders VALUES (103, 2, 900, 'completed');
  INSERT INTO orders VALUES (104, 3, 50, 'cancelled');
  INSERT INTO orders VALUES (105, 1, 300, 'completed');
`;