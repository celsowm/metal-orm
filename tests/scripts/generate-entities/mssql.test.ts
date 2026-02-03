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
      '--include=nota_versao,acervo,equipe,tipo_divisao_carga_trabalho,especializada,tipo_acervo,fila_circular,tipo_migracao_acervo,usuario',
      '--dry-run'
    ],
    { encoding: 'utf8' }
  );

  if (result.error) {
    throw result.error;
  }

  const stderr = result.stderr || '';
  const stdout = result.stdout || '';
  const connectionFailure = /(ECONNREFUSED|ENOTFOUND|Connection refused|Failed to connect|Login failed|Timed out)/i.test(
    stderr + stdout
  );

  if (result.status !== 0) {
    if (connectionFailure) {
      console.warn(
        'Skipping SQL Server generation test because the server appears unavailable:',
        stderr || stdout
      );
      return;
    }
    throw new Error(result.stderr || `non-zero exit ${result.status}`);
  }

  const out = result.stdout || '';
  expect(out).toContain('class NotaVersao');
  expect(out).toContain('@Entity');
  expect(out).toContain("tableName: 'nota_versao'");
  expect(out).toContain('@PrimaryKey(col.notNull(col.autoIncrement(col.int())))');
  expect(out).toContain("@Column(col.notNull(col.date<Date>()))\n  data!: Date;");
  expect(out).toContain("@Column(col.notNull(col.int()))\n  sprint!: number;");
  expect(out).toContain("@Column(col.notNull(col.boolean()))\n  ativo!: boolean;");
  expect(out).toContain("@Column(col.notNull(col.text()))\n  mensagem!: string;");
  expect(out).toContain("@Column(col.datetime<Date>())\n  data_exclusao?: Date;");
  expect(out).toContain("@Column(col.datetime<Date>())\n  data_inativacao?: Date;");
  expect(out).not.toContain('TODO: review type');
  expect(out).toContain('class Acervo');
  expect(out).toContain("tableName: 'acervo'");
  expect(out).toContain("@BelongsTo({ target: () => Equipe, foreignKey: 'equipe_responsavel_id' })");
  expect(out).toContain("@BelongsTo({ target: () => TipoDivisaoCargaTrabalho, foreignKey: 'tipo_divisao_carga_trabalho_id' })");
  expect(out).toContain("@BelongsTo({ target: () => Usuario, foreignKey: 'procurador_titular_id' })");
  const notaVersaoDoc = /class NotaVersao[\s\S]*?\/\*\*[\s\S]*?\*\/\n  @Column/;
  expect(notaVersaoDoc.test(out)).toBe(true);
  expect(out).toContain("@BelongsTo({ target: () => Especializada, foreignKey: 'especializada_id' })");
  expect(out).toContain("@BelongsTo({ target: () => TipoAcervo, foreignKey: 'tipo_acervo_id' })");
  expect(out).toContain("@BelongsTo({ target: () => FilaCircular, foreignKey: 'fila_circular_id' })");
  expect(out).toContain("@BelongsTo({ target: () => TipoMigracaoAcervo, foreignKey: 'tipo_migracao_acervo_id' })");
}, 25_000);

maybe('generates tree decorators for tema table', () => {
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
      '--include=tema',
      '--dry-run'
    ],
    { encoding: 'utf8' }
  );

  if (result.error) {
    throw result.error;
  }

  const stderr = result.stderr || '';
  const stdout = result.stdout || '';
  const connectionFailure = /(ECONNREFUSED|ENOTFOUND|Connection refused|Failed to connect|Login failed|Timed out)/i.test(
    stderr + stdout
  );

  if (result.status !== 0) {
    if (connectionFailure) {
      console.warn(
        'Skipping SQL Server tree generation test because the server appears unavailable:',
        stderr || stdout
      );
      return;
    }
    throw new Error(result.stderr || `non-zero exit ${result.status}`);
  }

  const out = result.stdout || '';
  expect(out).toContain('class Tema');
  expect(out).toContain("@Entity({ tableName: 'tema' })");
  expect(out).toContain(
    "@Tree({ parentKey: 'parent_id', leftKey: 'lft', rightKey: 'rght', depthKey: 'cod_nivel' })"
  );
  expect(out).toContain('@TreeParent()');
  expect(out).toContain('parent?: Tema;');
  expect(out).toContain('@TreeChildren()');
  expect(out).toContain('children?: Tema[];');
}, 25_000);
