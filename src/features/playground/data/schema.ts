import { defineTable } from '../../../metal-orm/src/schema/table';
import { col } from '../../../metal-orm/src/schema/column';
import { hasMany, belongsTo } from '../../../metal-orm/src/schema/relation';

// We define columns first to avoid circular reference in variable usage if strict typing was enforced,
// but for this simple runtime, we can use the variables directly or use strings if needed.

// 1. Define Columns & Base Table
export const Orders = defineTable('orders', {
    id: col.primaryKey(col.int()),
    user_id: col.int(),
    total: col.int(),
    status: col.varchar(50)
});

export const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    role: col.varchar(50),
    settings: col.json(),
    deleted_at: col.varchar(50) 
}, {
    // 2. Define Relation
    // Users has many Orders (Foreign Key on Orders is 'user_id')
    orders: hasMany(Orders, 'user_id')
});

// Update Orders to have inverse relation
// Orders.relations.user = belongsTo(Users, 'user_id');
// (In a real app we'd do this cleaner, but this hacks the circular dependency for the demo)
(Orders as any).relations = {
    user: belongsTo(Users, 'user_id')
};
