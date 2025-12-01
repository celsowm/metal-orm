export const SEED_SQL = `
  DROP TABLE IF EXISTS project_assignments;
  DROP TABLE IF EXISTS projects;
  DROP TABLE IF EXISTS user_roles;
  DROP TABLE IF EXISTS roles;
  DROP TABLE IF EXISTS profiles;
  DROP TABLE IF EXISTS orders;
  DROP TABLE IF EXISTS users;

  -- Core tables
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    name TEXT,
    role TEXT,
    settings TEXT,
    deleted_at TEXT
  );

  CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    total INTEGER,
    status TEXT
  );

  CREATE TABLE profiles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    bio TEXT,
    twitter TEXT
  );

  CREATE TABLE roles (
    id INTEGER PRIMARY KEY,
    name TEXT,
    level TEXT
  );

  -- N:N join table with extra attributes ("rich association")
  CREATE TABLE user_roles (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    role_id INTEGER,
    assigned_at TEXT,  -- when the role was assigned
    is_active BOOLEAN  -- current vs historical
  );

  -- Projects for ternary relationship
  CREATE TABLE projects (
    id INTEGER PRIMARY KEY,
    name TEXT,
    client TEXT
  );

  -- Ternary link: user + project + role
  CREATE TABLE project_assignments (
    id INTEGER PRIMARY KEY,
    project_id INTEGER,
    user_id INTEGER,
    role_id INTEGER,
    assigned_at TEXT
  );

  -- Users
  INSERT INTO users VALUES (1, 'Alice Engineer', 'admin', '{"theme":"dark"}', NULL);
  INSERT INTO users VALUES (2, 'Bob Manager', 'user', '{"theme":"light"}', NULL);
  INSERT INTO users VALUES (3, 'Charlie Intern', 'user', '{"theme":"dark"}', '2023-01-01');
  INSERT INTO users VALUES (4, 'David CTO', 'admin', '{"notifications":true}', NULL);

  -- Orders
  INSERT INTO orders VALUES (101, 1, 500, 'completed');
  INSERT INTO orders VALUES (102, 1, 120, 'pending');
  INSERT INTO orders VALUES (103, 2, 900, 'completed');
  INSERT INTO orders VALUES (104, 3, 50, 'cancelled');
  INSERT INTO orders VALUES (105, 1, 300, 'completed');

  -- Profiles (1:1 with users)
  INSERT INTO profiles VALUES (1, 1, 'Lead Systems Engineer with API obsession', '@alice_engineer');
  INSERT INTO profiles VALUES (2, 2, 'Operations manager who optimizes everything', '@bob_ops');
  INSERT INTO profiles VALUES (3, 3, 'Intern documenting every experiment', '@charlie_docs');
  INSERT INTO profiles VALUES (4, 4, 'CTO crafting scalable futures', '@david_cto');

  -- Roles
  INSERT INTO roles VALUES (1, 'admin',   'platform');
  INSERT INTO roles VALUES (2, 'manager', 'operations');
  INSERT INTO roles VALUES (3, 'intern',  'learning');
  INSERT INTO roles VALUES (4, 'viewer',  'guest');   -- extra role for projects

  -- User roles (N:N with attributes on the edge)
  INSERT INTO user_roles VALUES (1, 1, 1, '2022-01-01', 1); -- Alice is Admin (active)
  INSERT INTO user_roles VALUES (2, 1, 2, '2022-06-01', 0); -- Alice was Manager (inactive)
  INSERT INTO user_roles VALUES (3, 2, 2, '2023-01-15', 1); -- Bob is Manager (active)
  INSERT INTO user_roles VALUES (4, 3, 3, '2023-08-20', 1); -- Charlie is Intern (active)

  -- Projects
  INSERT INTO projects VALUES (10, 'Alpha Redesign', 'Acme Corp');
  INSERT INTO projects VALUES (20, 'Beta Migration', 'Globex');

  -- Ternary: who has which role in which project
  INSERT INTO project_assignments VALUES (1, 10, 1, 2, '2023-09-01'); -- Alice is manager on Alpha
  INSERT INTO project_assignments VALUES (2, 10, 2, 4, '2023-09-05'); -- Bob is viewer on Alpha
  INSERT INTO project_assignments VALUES (3, 20, 3, 3, '2023-10-01'); -- Charlie is intern on Beta
  INSERT INTO project_assignments VALUES (4, 20, 1, 1, '2023-10-01'); -- Alice is admin on Beta
`;
