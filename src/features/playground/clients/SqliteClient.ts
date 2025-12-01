import { IDatabaseClient, QueryResult } from "../common/IDatabaseClient";
import { SEED_SQL } from "../data/seed";

export class SqliteClient implements IDatabaseClient {
    isReady: boolean = false;
    error: string | null = null;
    private db: any = null;

    constructor() {
        this.initDB();
    }

    private async initDB() {
        try {
            if (!(window as any).initSqlJs) {
                console.error("sql.js not loaded");
                this.error = "SQLite engine script not loaded.";
                return;
            }
            const SQL = await (window as any).initSqlJs({
                locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
            });
            const db = new SQL.Database();
            db.run(SEED_SQL);
            this.db = db;
            this.isReady = true;
        } catch (e) {
            console.error("Failed to load DB", e);
            this.error = "Failed to initialize SQLite engine.";
        }
    }

    public async executeSql(sql: string): Promise<QueryResult[]> {
        if (!this.db) {
            this.error = "Database not ready.";
            return [];
        }
        try {
            const results = this.db.exec(sql);
            this.error = null;
            return results.map((res: any) => ({
                columns: res.columns,
                values: res.values,
            }));
        } catch (err: any) {
            this.error = err.message;
            return [];
        }
    }
}
