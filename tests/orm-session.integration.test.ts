import { beforeEach, describe, expect, test } from 'vitest';
import { Orm } from '../src/orm/orm.js';
import { bootstrapEntities, Entity, PrimaryKey, Column } from '../src/decorators/index.js';
import { clearEntityMetadata } from '../src/orm/entity-metadata.js';
import { MySqlDialect } from '../src/core/dialect/mysql/index.js';
import { col } from '../src/schema/column.js';
import type { DbExecutor, QueryResult } from '../src/core/execution/db-executor.js';
import { rowsToQueryResult } from '../src/core/execution/db-executor.js';
import type { TableDef } from '../src/schema/table.js';
import { findPrimaryKey } from '../src/query-builder/hydration-planner.js';

@Entity()
class User {
    @PrimaryKey(col.varchar(36))
    id!: string;

    @Column(col.varchar(255))
    name!: string;
}

describe('OrmSession integration', () => {
    let tables: TableDef[] = [];

    beforeEach(() => {
        clearEntityMetadata();
        tables = bootstrapEntities();
    });

    test('persist + find uses identity map', async () => {
        const executor = new InMemoryExecutor(tables);
        const factory = {
            createExecutor: () => executor,
            createTransactionalExecutor: () => executor
        };

        const orm = new Orm({ dialect: new MySqlDialect(), executorFactory: factory });

        await orm.transaction(async (session) => {
            const user = new User();
            user.id = 'user-1';
            user.name = 'Alice';

            await session.persist(user);
            const first = await session.find(User, 'user-1');
            const second = await session.find(User, 'user-1');

            expect(first).toBe(user);
            expect(second).toBe(user);
            expect(executor.selectCount).toBeGreaterThanOrEqual(1);
        });
    });
});

class InMemoryExecutor implements DbExecutor {
    selectCount = 0;
    private readonly storage = new Map<string, Record<string, unknown>[]>();
    private readonly tableMap = new Map<string, TableDef>();
    beginCalls = 0;
    commitCalls = 0;
    rollbackCalls = 0;

    constructor(tables: TableDef[]) {
        for (const table of tables) {
            this.tableMap.set(table.name, table);
            this.storage.set(table.name, []);
        }
    }

    async executeSql(sql: string, params: unknown[] = []): Promise<QueryResult[]> {
        const normalized = sql.trim().toLowerCase();
        if (normalized.startsWith('insert')) {
            this.recordInsert(sql, params);
            return [rowsToQueryResult([])];
        }

        if (normalized.startsWith('select')) {
            this.selectCount += 1;
            return this.handleSelect(sql, params);
        }

        return [rowsToQueryResult([])];
    }

    private recordInsert(sql: string, params: unknown[]): void {
        const match = /insert into [`"]?(\w+)[`"]?\s*\(([^)]+)\)/i.exec(sql);
        if (!match) return;
        const tableName = match[1];
        const columns = match[2]
            .split(',')
            .map(column => column.trim().replace(/[`"]/g, ''));
        const row: Record<string, unknown> = {};
        columns.forEach((column, index) => {
            row[column] = params[index];
        });
        this.storage.get(tableName)?.push(row);
    }

    private handleSelect(sql: string, params: unknown[]): QueryResult[] {
        const match = /from\s+[`"]?(\w+)[`"]?/i.exec(sql);
        if (!match) return [rowsToQueryResult([])];
        const tableName = match[1];
        const table = this.tableMap.get(tableName);
        if (!table) return [rowsToQueryResult([])];

        const primaryKey = findPrimaryKey(table);
        const rows = this.storage.get(tableName) ?? [];
        const filtered = params.length ? rows.filter(row => row[primaryKey] === params[0]) : rows;
        const columns = Object.values(table.columns).map(column => column.name);
        const values = filtered.map(row => columns.map(column => row[column]));
        return [{ columns, values }];
    }

    async beginTransaction(): Promise<void> {
        this.beginCalls += 1;
    }

    async commitTransaction(): Promise<void> {
        this.commitCalls += 1;
    }

    async rollbackTransaction(): Promise<void> {
        this.rollbackCalls += 1;
    }
}
