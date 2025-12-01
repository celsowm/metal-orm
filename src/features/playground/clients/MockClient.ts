import { IDatabaseClient, QueryResult } from "../common/IDatabaseClient";
import { SupportedDialect } from "../hooks/useMetalORM";

export class MockClient implements IDatabaseClient {
    isReady: boolean = true;
    error: string | null = null;

    constructor(dialect: SupportedDialect) {
        this.error = `${dialect} is not supported yet.`;
    }

    public async executeSql(sql: string): Promise<QueryResult[]> {
        return [];
    }
}
