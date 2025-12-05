import { defineTable } from '../../src/schema/table.js';
import { col } from '../../src/schema/column.js';
import { hasMany, hasOne, belongsTo, belongsToMany } from '../../src/schema/relation.js';

export const Users = defineTable('users', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  role: col.varchar(50),
  settings: col.json(),
  deleted_at: col.varchar(50)
});

export const Orders = defineTable('orders', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  total: col.int(),
  status: col.varchar(50)
});

export const Profiles = defineTable('profiles', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  bio: col.varchar(255),
  twitter: col.varchar(100)
});

export const Roles = defineTable('roles', {
  id: col.primaryKey(col.int()),
  name: col.varchar(50),
  level: col.varchar(50)
});

export const UserRoles = defineTable('user_roles', {
  id: col.primaryKey(col.int()),
  user_id: col.int(),
  role_id: col.int(),
  assigned_at: col.varchar(50),
  is_active: col.boolean()
});

export const Projects = defineTable('projects', {
  id: col.primaryKey(col.int()),
  name: col.varchar(255),
  client: col.varchar(255)
});

export const ProjectAssignments = defineTable('project_assignments', {
  id: col.primaryKey(col.int()),
  project_id: col.int(),
  user_id: col.int(),
  role_id: col.int(),
  assigned_at: col.varchar(50)
});

Users.relations = {
  orders: hasMany(Orders, 'user_id'),
  profiles: hasMany(Profiles, 'user_id'),
  profile: hasOne(Profiles, 'user_id'),
  userRoles: hasMany(UserRoles, 'user_id'),
  projects: belongsToMany(Projects, ProjectAssignments, {
    pivotForeignKeyToRoot: 'user_id',
    pivotForeignKeyToTarget: 'project_id'
  })
};

Orders.relations = {
  user: belongsTo(Users, 'user_id')
};

Profiles.relations = {
  user: belongsTo(Users, 'user_id')
};

Roles.relations = {
  userRoles: hasMany(UserRoles, 'role_id'),
  projectAssignments: hasMany(ProjectAssignments, 'role_id')
};

UserRoles.relations = {
  user: belongsTo(Users, 'user_id'),
  role: belongsTo(Roles, 'role_id')
};

Projects.relations = {
  projectAssignments: hasMany(ProjectAssignments, 'project_id')
};

ProjectAssignments.relations = {
  project: belongsTo(Projects, 'project_id'),
  user: belongsTo(Users, 'user_id'),
  role: belongsTo(Roles, 'role_id')
};
