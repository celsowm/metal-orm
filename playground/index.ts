import { SelectQueryBuilder } from '../src/metal-orm/src/builder/select';
import { MySqlDialect } from '../src/metal-orm/src/dialect/mysql';
import { eq } from '../src/metal-orm/src/ast/expression';
import { Users } from './data/schema';

// 1. Initialize the query builder
const qb = new SelectQueryBuilder(Users);

// 2. Build the query using a fluent API
const query = qb
    .select({
        id: Users.columns.id,
        name: Users.columns.name,
    })
    .where(eq(Users.columns.role, 'admin'));

// 3. Generate the dialect-specific SQL
const dialect = new MySqlDialect();
const sql = query.toSql(dialect);

// 4. (Optional) Log the generated SQL
console.log('Generated SQL:', sql);
