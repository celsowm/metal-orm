import { SelectQueryBuilder, defineTable, col, hasMany, eq } from './dist/index.js';

const Users = defineTable('users', {
    id: col.primaryKey(col.int()),
    name: col.varchar(255),
    email: col.varchar(255)
});

const Orders = defineTable('orders', {
    id: col.primaryKey(col.int()),
    user_id: col.int(),
    total: col.decimal(10, 2),
    status: col.varchar(50)
});

Users.relations = {
    orders: hasMany(Orders, 'user_id')
};

export default new SelectQueryBuilder(Users)
    .selectRaw('*')
    .include('orders', {
        columns: ['id', 'total', 'status']
    })
    .where(eq(Users.columns.id, 1))
    .limit(10);
