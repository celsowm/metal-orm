import { defineTable } from '../../../metal-orm/src/schema/table';
import { col } from '../../../metal-orm/src/schema/column';
import { hasMany, belongsTo } from '../../../metal-orm/src/schema/relation';

export const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    role: col.varchar(50),
    settings: col.json(),
    deleted_at: col.varchar(50)
});

export const Roles = defineTable('roles', {
    id: col.primaryKey(col.int()),
    name: col.varchar(50),
    level: col.varchar(50)
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

export const UserRoles = defineTable('user_roles', {
    id: col.primaryKey(col.int()),
    user_id: col.int(),
    role_id: col.int()
});

Users.relations = {
    orders: hasMany(Orders, 'user_id'),
    profiles: hasMany(Profiles, 'user_id'),
    userRoles: hasMany(UserRoles, 'user_id')
};

Orders.relations = {
    user: belongsTo(Users, 'user_id')
};

Profiles.relations = {
    user: belongsTo(Users, 'user_id')
};

Roles.relations = {
    userRoles: hasMany(UserRoles, 'role_id')
};

UserRoles.relations = {
    user: belongsTo(Users, 'user_id'),
    role: belongsTo(Roles, 'role_id')
};
