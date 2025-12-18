import process from 'node:process';
import path from 'node:path';
import { parseArgs as parseCliArgs } from 'node:util';

const DIALECTS = new Set(['postgres', 'mysql', 'sqlite', 'mssql']);

export const parseOptions = (argv = process.argv.slice(2), env = process.env, cwd = process.cwd()) => {
  const parser = {
    options: {
      dialect: { type: 'string' },
      url: { type: 'string' },
      db: { type: 'string' },
      schema: { type: 'string' },
      include: { type: 'string' },
      exclude: { type: 'string' },
      out: { type: 'string' },
      locale: { type: 'string' },
      'naming-overrides': { type: 'string' },
      'dry-run': { type: 'boolean' },
      'out-dir': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean' }
    },
    strict: true
  };

  const { values, positionals } = parseCliArgs(parser, { argv });

  if (values.help) {
    return { kind: 'help' };
  }

  if (values.version) {
    return { kind: 'version' };
  }

  if (positionals.length) {
    throw new Error(`Unexpected positional args: ${positionals.join(' ')}`);
  }

  const opts = {
    dialect: (values.dialect || 'postgres').toLowerCase(),
    url: values.url || env.DATABASE_URL,
    dbPath: values.db,
    schema: values.schema,
    include: values.include ? values.include.split(',').map(v => v.trim()).filter(Boolean) : undefined,
    exclude: values.exclude ? values.exclude.split(',').map(v => v.trim()).filter(Boolean) : undefined,
    out: values.out ? path.resolve(cwd, values.out) : undefined,
    outDir: values['out-dir'] ? path.resolve(cwd, values['out-dir']) : undefined,
    locale: (values.locale || 'en').toLowerCase(),
    namingOverrides: values['naming-overrides'] ? path.resolve(cwd, values['naming-overrides']) : undefined,
    dryRun: Boolean(values['dry-run'])
  };

  if (!DIALECTS.has(opts.dialect)) {
    throw new Error(`Unsupported dialect "${opts.dialect}". Supported: ${Array.from(DIALECTS).join(', ')}`);
  }

  if (opts.dialect === 'sqlite' && !opts.dbPath) {
    opts.dbPath = ':memory:';
  }

  if (opts.dialect !== 'sqlite' && !opts.url) {
    throw new Error('Missing connection string. Provide --url or set DATABASE_URL.');
  }

  if (!opts.out) {
    opts.out = opts.outDir ? path.join(opts.outDir, 'index.ts') : path.join(cwd, 'generated-entities.ts');
  }

  return { kind: 'generate', options: opts };
};

export const printUsage = () => {
  console.log(
    `
MetalORM decorator generator
---------------------------
Usage:
  node scripts/generate-entities.mjs --dialect=postgres --url=<connection> --schema=public --include=users,orders [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=mysql     --url=<connection> --schema=mydb --exclude=archived [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=sqlite    --db=./my.db                           [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=mssql     --url=mssql://user:pass@host/db        [--out=src/entities.ts]
  node scripts/generate-entities.mjs --dialect=postgres --url=<connection> --schema=public --out-dir=src/entities

Flags:
  --include=tbl1,tbl2   Only include these tables
  --exclude=tbl3,tbl4   Exclude these tables
  --locale=pt-BR        Naming locale for class/relation names (default: en)
  --naming-overrides    Path to JSON map of irregular plurals { "singular": "plural" }
  --dry-run             Print to stdout instead of writing a file
  --out=<file>          Override the generated file (defaults to generated-entities.ts or the index inside --out-dir)
  --out-dir=<dir>       Emit one file per entity inside this directory plus the shared index
  --help                Show this help
`
  );
};
