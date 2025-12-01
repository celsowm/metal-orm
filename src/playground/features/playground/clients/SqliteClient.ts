import { IDatabaseClient, QueryResult } from "../common/IDatabaseClient";
import { SEED_SQL } from "../data/seed";
import sqlite3 from 'sqlite3';

export class SqliteClient implements IDatabaseClient {
    isReady: boolean = false;
    error: string | null = null;
    private db: sqlite3.Database | null = null;

    constructor() {
        this.initDB();
    }

    private async initDB() {
        try {
            this.db = new sqlite3.Database(':memory:');
            const statements = SEED_SQL.trim().split(';').map(s => s.trim()).filter(s => s.length > 0);
            for (const statement of statements) {
                await new Promise<void>((resolve, reject) => {
                    this.db!.run(statement, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
            this.isReady = true;
        } catch (e) {
            console.error("Failed to load DB", e);
            this.error = "Failed to initialize SQLite database.";
        }
    }

    public async executeSql(sql: string): Promise<QueryResult[]> {
        if (!this.db) {
            this.error = "Database not ready.";
            return [];
        }

        return new Promise((resolve, reject) => {
            this.db!.all(sql, (err, rows) => {
                if (err) {
                    this.error = err.message;
                    resolve([]);
                } else {
                    this.error = null;
                    if (rows.length === 0) {
                        resolve([]);
                    } else {
                        const columns = Object.keys(rows[0]);
                        const values = rows.map(row => columns.map(col => row[col]));
                        resolve([{
                            columns,
                            values,
                        }]);
                    }
                }
            });
        });
    }
}
