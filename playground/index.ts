import { QueryBuilder } from '../orm/builder';
import { Users } from '../orm/schema';
import { Timestamps, SoftDeletes } from '../orm/mixins';
import { MySqlDialect } from '../orm/dialect/mysql';

// Aplica mixins para compor funcionalidades
const UserQueryWithMixins = SoftDeletes(Timestamps(QueryBuilder));

const query = new UserQueryWithMixins(Users);

// Demonstra a nova API `where` encadeada e com múltiplos operadores
const sql = query
    .select('users.id', 'users.name', 'users.role')
    .where('role', 'IN', ['admin', 'editor']) // TOp: ArrayOps, TVal: readonly string[]
    .where('name', 'LIKE', 'A%')               // TOp: TextOps, TVal: string
    .where('id', '>', 10)                      // TOp: NumericOps, TVal: number
    .touch()
    .withTrashed()
    .toSql(new MySqlDialect());

console.log('SQL Gerado:', sql);

async function main() {
    const stream = query
        .select('users.id', 'users.name')
        .where('role', '=', 'admin')
        .execute(new MySqlDialect());

    for await (const user of stream) {
        console.log('Usuário recebido via stream:', user);
        // `user` é inferido como `{ id: number; name: string; }`
    }
}

main().catch(console.error);
