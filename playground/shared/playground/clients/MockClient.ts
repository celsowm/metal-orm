import { IDatabaseClient, QueryResult } from "../common/IDatabaseClient.js";
import { DialectName } from '@orm/core/sql/sql.js';

export type SupportedDialect = DialectName;

export class MockClient implements IDatabaseClient {
    isReady: boolean = true;
    error: string | null = null;

    constructor(dialect: SupportedDialect) {
        this.error = `${dialect} is not supported yet.`;
    }

    public async executeSql(sql: string, _params: unknown[] = []): Promise<QueryResult[]> {
        return [];
    }
}
