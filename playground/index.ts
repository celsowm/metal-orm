import { QueryBuilder } from '../orm/builder';
import { Users } from '../orm/schema';
import { Timestamps, SoftDeletes } from '../orm/mixins';
import { MySqlDialect } from '../orm/dialect/mysql';

// Aplica os mixins à classe QueryBuilder
const UserQuery = SoftDeletes(Timestamps(QueryBuilder));

const query = new UserQuery(Users);

// Demonstra a nova API fluente `where`
const sql = query
    .select('users.id', 'users.name')
    .where('id', '=', 123) // API Nova e Melhorada
    .touch()
    .withTrashed()
    .toSql(new MySqlDialect());

console.log('SQL Gerado:', sql);

async function main() {
    // Demonstra a nova API no `execute`
    const stream = query
        .select('users.id', 'users.name')
        .where('role', '=', 'admin') // API Nova e Melhorada
        .execute(new MySqlDialect());

    for await (const user of stream) {
        console.log('Usuário recebido via stream:', user);
        // `user` agora é inferido corretamente como `{ id: number; name: string; }`
    }
}

main();