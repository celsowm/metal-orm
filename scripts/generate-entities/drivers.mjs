import { createPostgresExecutor, createMysqlExecutor, createSqliteExecutor, createMssqlExecutor } from '../../dist/index.js';

const parseSqlServerOptionValue = value => {
  if (!value) return value;
  if (/^-?\d+$/.test(value)) return Number(value);
  if (/^(true|false)$/i.test(value)) return value.toLowerCase() === 'true';
  return value;
};

const parseSqlServerConnectionConfig = connectionString => {
  if (!connectionString) {
    throw new Error('Missing connection string for SQL Server');
  }
  const url = new URL(connectionString);
  const config = {
    server: url.hostname,
    authentication: {
      type: 'default',
      options: {
        userName: decodeURIComponent(url.username || ''),
        password: decodeURIComponent(url.password || '')
      }
    },
    options: {}
  };

  const database = url.pathname ? url.pathname.replace(/^\//, '') : '';
  if (database) {
    config.options.database = database;
  }
  if (url.port) {
    config.options.port = Number(url.port);
  }

  for (const [key, value] of url.searchParams) {
    config.options[key] = parseSqlServerOptionValue(value);
  }

  return config;
};

const getTediousParameterType = (value, TYPES) => {
  if (value === null || value === undefined) {
    return TYPES.NVarChar;
  }
  if (typeof value === 'number') {
    return Number.isInteger(value) ? TYPES.Int : TYPES.Float;
  }
  if (typeof value === 'bigint') {
    return TYPES.BigInt;
  }
  if (typeof value === 'boolean') {
    return TYPES.Bit;
  }
  if (value instanceof Date) {
    return TYPES.DateTime;
  }
  if (Buffer.isBuffer(value)) {
    return TYPES.VarBinary;
  }
  return TYPES.NVarChar;
};

export const loadDriver = async (dialect, url, dbPath) => {
  switch (dialect) {
    case 'postgres': {
      const mod = await import('pg');
      const { Client } = mod;
      const client = new Client({ connectionString: url });
      await client.connect();
      const executor = createPostgresExecutor(client);
      return { executor, cleanup: async () => client.end() };
    }
    case 'mysql': {
      const mod = await import('mysql2/promise');
      const conn = await mod.createConnection(url);
      const executor = createMysqlExecutor({
        query: (...args) => conn.execute(...args),
        beginTransaction: () => conn.beginTransaction(),
        commit: () => conn.commit(),
        rollback: () => conn.rollback()
      });
      return { executor, cleanup: async () => conn.end() };
    }
    case 'sqlite': {
      const mod = await import('sqlite3');
      const sqlite3 = mod.default || mod;
      const db = new sqlite3.Database(dbPath);
      const execAll = (sql, params) =>
        new Promise((resolve, reject) => {
          db.all(sql, params || [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
          });
        });
      const executor = createSqliteExecutor({
        all: execAll,
        beginTransaction: () => execAll('BEGIN'),
        commitTransaction: () => execAll('COMMIT'),
        rollbackTransaction: () => execAll('ROLLBACK')
      });
      const cleanup = async () =>
        new Promise((resolve, reject) => db.close(err => (err ? reject(err) : resolve())));
      return { executor, cleanup };
    }
    case 'mssql': {
      const mod = await import('tedious');
      const { Connection, Request, TYPES } = mod;
      const config = parseSqlServerConnectionConfig(url);
      const connection = new Connection(config);

      await new Promise((resolve, reject) => {
        const onConnect = err => {
          connection.removeListener('error', onError);
          if (err) return reject(err);
          resolve();
        };
        const onError = err => {
          connection.removeListener('connect', onConnect);
          reject(err);
        };
        connection.once('connect', onConnect);
        connection.once('error', onError);
        connection.connect();
      });

      const execQuery = (sql, params) =>
        new Promise((resolve, reject) => {
          const rows = [];
          const request = new Request(sql, err => {
            if (err) return reject(err);
            resolve({ recordset: rows });
          });
          request.on('row', columns => {
            const row = {};
            for (const column of columns) {
              row[column.metadata.colName] = column.value;
            }
            rows.push(row);
          });
          params?.forEach((value, index) => {
            request.addParameter(`p${index + 1}`, getTediousParameterType(value, TYPES), value);
          });
          connection.execSql(request);
        });

      const executor = createMssqlExecutor({
        query: execQuery,
        beginTransaction: () =>
          new Promise((resolve, reject) => {
            connection.beginTransaction(err => (err ? reject(err) : resolve()));
          }),
        commit: () =>
          new Promise((resolve, reject) => {
            connection.commitTransaction(err => (err ? reject(err) : resolve()));
          }),
        rollback: () =>
          new Promise((resolve, reject) => {
            connection.rollbackTransaction(err => (err ? reject(err) : resolve()));
          })
      });

      const cleanup = async () =>
        new Promise((resolve, reject) => {
          const onEnd = () => {
            connection.removeListener('error', onError);
            resolve();
          };
          const onError = err => {
            connection.removeListener('end', onEnd);
            reject(err);
          };
          connection.once('end', onEnd);
          connection.once('error', onError);
          connection.close();
        });

      return { executor, cleanup };
    }
    default:
      throw new Error(`Unsupported dialect ${dialect}`);
  }
};
