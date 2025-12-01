import { useEffect, useState, useMemo } from 'react';
import { SupportedDialect } from './useMetalORM';
import { IDatabaseClient } from '../common/IDatabaseClient';
import { SqliteClient } from '../clients/SqliteClient';
import { MockClient } from '../clients/MockClient';

export const useDatabaseClient = (dialect: SupportedDialect): IDatabaseClient => {
    const [client, setClient] = useState<IDatabaseClient>(new MockClient('SQLite'));

    useEffect(() => {
        let newClient: IDatabaseClient;
        switch (dialect) {
            case 'SQLite':
                newClient = new SqliteClient();
                break;
            case 'MySQL':
            case 'SQL Server':
                newClient = new MockClient(dialect);
                break;
            default:
                throw new Error('Unsupported dialect');
        }

        const interval = setInterval(() => {
            if (newClient.isReady) {
                setClient(newClient);
                clearInterval(interval);
            }
        }, 100);

        return () => clearInterval(interval);
    }, [dialect]);

    return client;
};
