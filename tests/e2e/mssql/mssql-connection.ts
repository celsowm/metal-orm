import { Connection, Request, TYPES } from 'tedious';

import { createTediousExecutor } from '../../../src/core/execution/executors/mssql-executor.js';
import {
  createSession,
  readMssqlConfig,
  removeTestConfigFile,
  type MssqlConfig,
  type MssqlSetup,
} from '../mssql-helpers.js';

let connection: Connection | null = null;
let setup: MssqlSetup | null = null;
let config: MssqlConfig | null = null;

const openConnection = (cfg: MssqlConfig, database: string): Promise<Connection> =>
  new Promise<Connection>((resolve, reject) => {
    const conn = new Connection({
      server: cfg.host,
      authentication: {
        type: 'default',
        options: {
          userName: cfg.username,
          password: cfg.password,
        },
      },
      options: {
        database,
        encrypt: cfg.encrypt,
        trustServerCertificate: cfg.trustServerCertificate,
        port: cfg.port,
        connectTimeout: 30000,
      },
    });
    conn.on('connect', (err) => (err ? reject(err) : resolve(conn)));
    conn.on('error', (err) => reject(err));
    conn.connect();
  });

export async function initFromConfig(): Promise<void> {
  if (connection) return;

  config = readMssqlConfig();

  connection = await openConnection(config, config.database);

  const executor = createTediousExecutor(connection, { Request, TYPES });
  const session = createSession(executor);

  setup = { connection, executor, session, config };
}

export async function getSetup(): Promise<MssqlSetup> {
  if (!setup) {
    await initFromConfig();
  }
  if (!setup) {
    throw new Error('MSSQL not initialized. Call initFromConfig() first.');
  }
  return setup;
}

export async function getSession() {
  const s = await getSetup();
  return s.session;
}

export async function closeConnection(): Promise<void> {
  if (connection) {
    connection.close();
    connection = null;
    setup = null;
    removeTestConfigFile();
  }
}

export async function cleanDatabase(): Promise<void> {
  if (!connection || !config) return;
  const { executor } = await getSetup();

  const payload = await executor.executeSql(
    `SELECT TABLE_NAME AS name FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_SCHEMA = 'dbo'`
  );
  const result = payload.resultSets?.[0] ?? payload[0];
  const colIndex = result.columns.indexOf('name');
  const names = result.values
    .map((row: unknown[]) => (row[colIndex] as string))
    .filter(Boolean);

  const PROTECTED = new Set(['afastamento_pessoa']);

  for (const name of names) {
    if (PROTECTED.has(name)) continue;
    const safe = name.replace(/[^\w]/g, '');
    await executor.executeSql(`IF OBJECT_ID('dbo.[${safe}]', 'U') IS NOT NULL EXEC('DROP TABLE dbo.[${safe}]')`);
  }
}
