import { IDatabaseClient, QueryResult } from "../common/IDatabaseClient";

export type SupportedDialect = 'mysql' | 'sqlite' | 'mssql';

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
