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
});
