import { vi } from 'vitest';

vi.mock('../dist/index.js', async () => {
    const actual = await vi.importActual('../dist/index.js');
    return {
        ...actual,
        getSchemaIntrospector: () => ({
            introspect: async () => ({
                tables: [
                    {
                        name: 'users',
                        columns: [
                            { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNotNull: true, defaultValue: null },
                            { name: 'name', type: 'TEXT', isPrimaryKey: false, isNotNull: true, defaultValue: null },
                        ],
                        primaryKey: ['id'],
                        foreignKeys: [],
                    },
                    {
                        name: 'posts',
                        columns: [
                            { name: 'id', type: 'INTEGER', isPrimaryKey: true, isNotNull: true, defaultValue: null },
                            { name: 'title', type: 'TEXT', isPrimaryKey: false, isNotNull: true, defaultValue: null },
                            { name: 'user_id', type: 'INTEGER', isPrimaryKey: false, isNotNull: false, defaultValue: null },
                        ],
                        primaryKey: ['id'],
                        foreignKeys: [
                            { column: 'user_id', referencesTable: 'users', referencesColumn: 'id' },
                        ],
                    },
                ],
            }),
        }),
    };
});

vi.mock('../scripts/generate-level3.mjs', async () => {
    const actual = await vi.importActual('../scripts/generate-level3.mjs');
    return {
        ...actual,
        getDriver: () => ({}),
        createExecutor: (driver: any) => ({
            executeSql: async (sql: string, params: any[]): Promise<any> => {
                return [];
            }
        })
    };
});
