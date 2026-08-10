import { writeFileSync, existsSync, unlinkSync } from 'fs';
import { execFileSync } from 'node:child_process';
import { Connection, Request, TYPES } from 'tedious';

import { createTediousExecutor } from '../../../src/core/execution/executors/mssql-executor.js';
import {
  getTestConfigPath,
  mssqlConfigFromEnv,
  removeTestConfigFile,
  type MssqlConfig,
} from '../mssql-helpers.js';

const CONFIG_FILE = process.env.MSSQL_CONFIG_FILE ?? getTestConfigPath();

const isCi = !!process.env.CI || !!process.env.GITHUB_ACTIONS;

// Local SQL Server test containers (azuresqledge / sqlserver) to stop after the run.
const LOCAL_SQLSERVER_CONTAINERS = ['iridium_test_sqlserver', 'tsql_test_sqlserver'];

const stopLocalContainers = (): void => {
  if (isCi) return;
  for (const name of LOCAL_SQLSERVER_CONTAINERS) {
    try {
      execFileSync('podman', ['stop', name], { stdio: 'ignore', timeout: 30000 });
      console.log(`🧹 Stopped SQL Server container "${name}"`);
    } catch {
      // container not present / podman unavailable — ignore
    }
  }
};

const openConnection = (cfg: MssqlConfig, database: string): Promise<Connection> =>
  new Promise<Connection>((resolve, reject) => {
    const conn = new Connection({
      server: cfg.host,
      authentication: {
        type: 'default',
        options: { userName: cfg.username, password: cfg.password },
      },
      options: {
        database,
        encrypt: cfg.encrypt,
        trustServerCertificate: cfg.trustServerCertificate,
        port: cfg.port,
        connectTimeout: 15000,
      },
    });
    conn.on('connect', (err) => (err ? reject(err) : resolve(conn)));
    conn.on('error', (err) => reject(err));
    conn.connect();
  });

export async function setup(): Promise<void> {
  removeTestConfigFile();

  const cfg = mssqlConfigFromEnv();
  let available = false;

  try {
    const master = await openConnection({ ...cfg, database: 'master' }, 'master');
    const masterExecutor = createTediousExecutor(master, { Request, TYPES });

    await masterExecutor.executeSql(
      `IF DB_ID('${cfg.database}') IS NULL BEGIN CREATE DATABASE [${cfg.database}]; END`
    );
    master.close();

    const conn = await openConnection(cfg, cfg.database);
    const executor = createTediousExecutor(conn, { Request, TYPES });

    await seedShared(executor);

    await executor.executeSql('SELECT 1');
    conn.close();

    available = true;
    console.log(`✅ MSSQL ready on ${cfg.host}:${cfg.port} (db: ${cfg.database})`);
  } catch (err) {
    available = false;
    console.warn(`⚠️  MSSQL not available (${(err as Error)?.message}); mssql tests will be skipped.`);
  }

  const config: MssqlConfig = { ...cfg, available };
  writeFileSync(CONFIG_FILE, JSON.stringify(config));
}

async function seedShared(executor: ReturnType<typeof createTediousExecutor>): Promise<void> {
  await executor.executeSql(`
    IF OBJECT_ID('dbo.vw_afastamento_pessoa', 'V') IS NOT NULL DROP VIEW dbo.vw_afastamento_pessoa;
    IF OBJECT_ID('dbo.afastamento_pessoa', 'U') IS NOT NULL DROP TABLE dbo.afastamento_pessoa;
    CREATE TABLE dbo.afastamento_pessoa (
      id INT NOT NULL PRIMARY KEY,
      pessoa_id INT NULL,
      data_inicio DATE NULL,
      data_fim DATE NULL,
      tipo_afastamento VARCHAR(255) NULL,
      descricao VARCHAR(500) NULL
    );

    INSERT INTO dbo.afastamento_pessoa (id, pessoa_id, data_inicio, data_fim, tipo_afastamento, descricao) VALUES
      (1, 1, '2021-03-15', '2021-06-15', 'LICENCA', 'Licenca medica'),
      (2, 2, '2023-05-01', '2023-08-01', 'FERIAS', 'Ferias'),
      (3, 3, '2023-10-10', '2023-11-10', 'LICENCA', 'Licenca paternidade'),
      (4, 4, '2020-01-05', '2020-02-05', 'OUTRO', 'Afastamento diverso');

    EXEC('CREATE VIEW dbo.vw_afastamento_pessoa AS
      SELECT id, pessoa_id, data_inicio, data_fim, tipo_afastamento, descricao
      FROM dbo.afastamento_pessoa');
  `);
}

export async function teardown(): Promise<void> {
  stopLocalContainers();
  if (existsSync(CONFIG_FILE)) {
    unlinkSync(CONFIG_FILE);
  }
}
