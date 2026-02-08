import { Connection, Request } from 'tedious';

const REQUIRED_ENV = ['PGE_DIGITAL_HOST', 'PGE_DIGITAL_USER', 'PGE_DIGITAL_PASSWORD'];

const hasDbEnv = REQUIRED_ENV.every((name) => !!process.env[name]);

if (!hasDbEnv) {
  console.error('Missing required environment variables:', REQUIRED_ENV.filter(n => !process.env[n]));
  process.exit(1);
}

const parseBool = (value, fallback) => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

async function queryTableSchema(connection, tableName) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.IS_NULLABLE,
        c.CHARACTER_MAXIMUM_LENGTH,
        c.NUMERIC_PRECISION,
        c.NUMERIC_SCALE,
        COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') as IS_IDENTITY,
        CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as IS_PRIMARY_KEY
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN (
        SELECT ku.TABLE_CATALOG, ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
      ) pk ON c.TABLE_CATALOG = pk.TABLE_CATALOG 
        AND c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
        AND c.TABLE_NAME = pk.TABLE_NAME 
        AND c.COLUMN_NAME = pk.COLUMN_NAME
      WHERE c.TABLE_NAME = '${tableName}'
      ORDER BY c.ORDINAL_POSITION
    `;

    const request = new Request(query, (err, rowCount) => {
      if (err) reject(err);
    });

    const columns = [];
    request.on('row', (columns_data) => {
      const col = {};
      columns_data.forEach((c) => {
        col[c.metadata.colName] = c.value;
      });
      columns.push(col);
    });

    request.on('requestCompleted', () => {
      resolve(columns);
    });

    connection.execSql(request);
  });
}

async function queryForeignKeys(connection, tableName) {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT 
        fk.name AS FK_NAME,
        tp.name AS PARENT_TABLE,
        cp.name AS PARENT_COLUMN,
        tr.name AS REFERENCED_TABLE,
        cr.name AS REFERENCED_COLUMN
      FROM sys.foreign_keys fk
      INNER JOIN sys.tables tp ON fk.parent_object_id = tp.object_id
      INNER JOIN sys.tables tr ON fk.referenced_object_id = tr.object_id
      INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
      INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id AND fkc.parent_column_id = cp.column_id
      INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
      WHERE tp.name = '${tableName}' OR tr.name = '${tableName}'
    `;

    const request = new Request(query, (err, rowCount) => {
      if (err) reject(err);
    });

    const fks = [];
    request.on('row', (columns) => {
      const fk = {};
      columns.forEach((c) => {
        fk[c.metadata.colName] = c.value;
      });
      fks.push(fk);
    });

    request.on('requestCompleted', () => {
      resolve(fks);
    });

    connection.execSql(request);
  });
}

async function main() {
  const { PGE_DIGITAL_HOST, PGE_DIGITAL_USER, PGE_DIGITAL_PASSWORD } = process.env;
  const database = process.env.PGE_DIGITAL_DATABASE ?? 'PGE_DIGITAL';
  const encrypt = parseBool(process.env.PGE_DIGITAL_ENCRYPT, true);
  const trustServerCertificate = parseBool(process.env.PGE_DIGITAL_TRUST_CERT, true);
  const port = Number(process.env.PGE_DIGITAL_PORT ?? '1433');

  const tablesToInspect = ['carga', 'registro_tramitacao', 'tramitacao', 'usuario', 
    'processo_administrativo', 'classificacao', 'especializada', 'acervo', 
    'processo_judicial', 'parte', 'pessoa', 'tipo_polo'];

  const connection = await new Promise((resolve, reject) => {
    const conn = new Connection({
      server: PGE_DIGITAL_HOST,
      authentication: {
        type: 'default',
        options: {
          userName: PGE_DIGITAL_USER,
          password: PGE_DIGITAL_PASSWORD,
        },
      },
      options: {
        database,
        encrypt,
        trustServerCertificate,
        port: Number.isFinite(port) ? port : 1433,
      },
    });

    conn.on('connect', (err) => (err ? reject(err) : resolve(conn)));
    conn.connect();
  });

  console.log(`Connected to ${database} on ${PGE_DIGITAL_HOST}\n`);

  for (const tableName of tablesToInspect) {
    try {
      console.log(`\n=== Table: ${tableName} ===`);
      
      const columns = await queryTableSchema(connection, tableName);
      if (columns.length === 0) {
        console.log('  Table not found or no columns');
        continue;
      }

      console.log('Columns:');
      columns.forEach(col => {
        const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
        const pk = col.IS_PRIMARY_KEY ? ' [PK]' : '';
        const identity = col.IS_IDENTITY ? ' [IDENTITY]' : '';
        let dataType = col.DATA_TYPE;
        if (col.CHARACTER_MAXIMUM_LENGTH && col.CHARACTER_MAXIMUM_LENGTH > 0) {
          dataType += `(${col.CHARACTER_MAXIMUM_LENGTH})`;
        } else if (col.NUMERIC_PRECISION) {
          dataType += `(${col.NUMERIC_PRECISION},${col.NUMERIC_SCALE || 0})`;
        }
        console.log(`  ${col.COLUMN_NAME}: ${dataType} ${nullable}${pk}${identity}`);
      });

      const fks = await queryForeignKeys(connection, tableName);
      if (fks.length > 0) {
        console.log('Foreign Keys:');
        fks.forEach(fk => {
          console.log(`  ${fk.PARENT_TABLE}.${fk.PARENT_COLUMN} -> ${fk.REFERENCED_TABLE}.${fk.REFERENCED_COLUMN}`);
        });
      }
    } catch (err) {
      console.error(`Error inspecting ${tableName}:`, err.message);
    }
  }

  connection.close();
  console.log('\n=== Done ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
