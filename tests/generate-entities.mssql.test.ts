import { expect, test } from 'vitest';
import { spawnSync } from 'node:child_process';

// Skips automatically when required env vars are missing to avoid accidental outbound calls.
const hasEnv =
  !!process.env.PGE_DIGITAL_HOST &&
  !!process.env.PGE_DIGITAL_USER &&
  !!process.env.PGE_DIGITAL_PASSWORD;

const maybe = hasEnv ? test : test.skip;

maybe('generates entities from SQL Server using env connection', () => {
  const { PGE_DIGITAL_HOST, PGE_DIGITAL_USER, PGE_DIGITAL_PASSWORD } = process.env;
  const url = `mssql://${encodeURIComponent(PGE_DIGITAL_USER!)}:${encodeURIComponent(
    PGE_DIGITAL_PASSWORD!
  )}@${PGE_DIGITAL_HOST}/PGE_DIGITAL?encrypt=true&trustServerCertificate=true`;

  const result = spawnSync(
    'node',
    [
      'scripts/generate-entities.mjs',
      '--dialect=mssql',
      '--url',
      url,
      '--schema=dbo',
      '--include=nota_versao',
      '--dry-run'
    ],
    { encoding: 'utf8' }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `non-zero exit ${result.status}`);
  }

  const out = result.stdout || '';
  expect(out).toContain('class NotaVersao');
  expect(out).toContain('@Entity');
  expect(out).toContain("tableName: 'nota_versao'");
  expect(out).toContain('@PrimaryKey(col.notNull(col.autoIncrement(col.int())))');
  expect(out).toContain("@Column(col.notNull(col.date()))\n  data!: Date;");
  expect(out).toContain("@Column(col.notNull(col.int()))\n  sprint!: number;");
  expect(out).toContain("@Column(col.notNull(col.boolean()))\n  ativo!: boolean;");
  expect(out).toContain("@Column(col.notNull(col.varchar(255)))\n  mensagem!: string;");
  expect(out).toContain("@Column(col.datetime())\n  data_exclusao?: Date;");
  expect(out).toContain("@Column(col.datetime())\n  data_inativacao?: Date;");
  expect(out).not.toContain('TODO: review type');
});
