import { useEffect, useRef, useState } from 'react';
import { SEED_SQL } from '../data/seed';

export const useSqlite = () => {
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const dbRef = useRef<any>(null);

    useEffect(() => {
        const initDB = async () => {
            try {
                if (!(window as any).initSqlJs) {
                    console.error("sql.js not loaded");
                    return;
                }
                const SQL = await (window as any).initSqlJs({
                    locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });
                const db = new SQL.Database();
                db.run(SEED_SQL);
                dbRef.current = db;
                setIsReady(true);
            } catch (e) {
                console.error("Failed to load DB", e);
                setError("Failed to initialize SQLite engine.");
            }
        };
        initDB();
    }, []);

    const executeSql = (sql: string): any[] => {
        if (!dbRef.current) return [];
        try {
            const stmt = dbRef.current.prepare(sql);
            const results = [];
            while(stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            setError(null);
            return results;
        } catch (err: any) {
            setError(err.message);
            return [];
        }
    };

    return { isReady, error, executeSql };
};