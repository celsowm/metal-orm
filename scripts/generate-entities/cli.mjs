import fs from 'node:fs';
import process from 'node:process';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseArgs as parseCliArgs } from 'node:util';

const DIALECTS = new Set(['postgres', 'mysql', 'sqlite', 'mssql']);
const NODE_NEXT_MODULE_RESOLUTIONS = new Set(['node16', 'nodenext']);

const TS_CONFIG_BASE_NAMES = ['tsconfig.json', 'tsconfig.base.json', 'tsconfig.app.json', 'tsconfig.build.json'];
const nodeRequire = createRequire(import.meta.url);

const normalizeCompilerOption = value => (typeof value === 'string' ? value.trim().toLowerCase() : '');

const hasNodeNextModuleResolution = compilerOptions => {
  if (!compilerOptions || typeof compilerOptions !== 'object') return false;
  const moduleResolution = normalizeCompilerOption(compilerOptions.moduleResolution);
  const moduleOption = normalizeCompilerOption(compilerOptions.module);
  return (
    NODE_NEXT_MODULE_RESOLUTIONS.has(moduleResolution) || NODE_NEXT_MODULE_RESOLUTIONS.has(moduleOption)
  );
};

const resolveExtendsPath = (extendsValue, baseDir) => {
  if (!extendsValue || typeof extendsValue !== 'string') return undefined;
  const candidatePaths = [];
  const normalizedValue = extendsValue.trim();
  candidatePaths.push(path.resolve(baseDir, normalizedValue));
  if (!path.extname(normalizedValue)) {
    candidatePaths.push(`${path.resolve(baseDir, normalizedValue)}.json`);
  }
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    return nodeRequire.resolve(normalizedValue, { paths: [baseDir] });
  } catch {
    return undefined;
  }
};

const inspectTsConfig = (configPath, visited) => {
  if (!configPath) return false;
  const normalized = path.resolve(configPath);
  if (visited.has(normalized)) return false;
  if (!fs.existsSync(normalized)) return false;
  visited.add(normalized);
  let raw;
  try {
    raw = fs.readFileSync(normalized, 'utf8');
  } catch {
    return false;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (hasNodeNextModuleResolution(parsed.compilerOptions)) {
    return true;
  }
  if (parsed.extends) {
    const extended = resolveExtendsPath(parsed.extends, path.dirname(normalized));
    if (extended && inspectTsConfig(extended, visited)) {
      return true;
    }
  }
  return false;
};

const discoverTsConfigPaths = cwd => {
  const candidates = new Set();
  for (const name of TS_CONFIG_BASE_NAMES) {
    const fullPath = path.join(cwd, name);
    if (fs.existsSync(fullPath)) {
      candidates.add(fullPath);
    }
  }
  try {
    const entries = fs.readdirSync(cwd);
    for (const entry of entries) {
      const lower = entry.toLowerCase();
      if (lower.startsWith('tsconfig') && lower.endsWith('.json')) {
        candidates.add(path.join(cwd, entry));
      }
    }
  } catch {
    // ignore readdir errors
  }
  return Array.from(candidates);
};

const shouldUseJsImportExtensions = cwd => {
  const paths = discoverTsConfigPaths(cwd);
  if (!paths.length) return false;
  const visited = new Set();
  for (const configPath of paths) {
    if (inspectTsConfig(configPath, visited)) {
      return true;
    }
  }
  return false;
};

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
      'include-views': { type: 'boolean' },
      'exclude-views': { type: 'string' },
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
    dryRun: Boolean(values['dry-run']),
    includeViews: Boolean(values['include-views']),
    excludeViews: values['exclude-views'] ? values['exclude-views'].split(',').map(v => v.trim()).filter(Boolean) : undefined
  };

  opts.useJsImportExtensions = shouldUseJsImportExtensions(cwd);

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
  node scripts/generate-entities.mjs --dialect=postgres --url=<connection> --schema=public --include-views [--out=src/entities.ts]

Flags:
  --include=tbl1,tbl2   Only include these tables
  --exclude=tbl3,tbl4   Exclude these tables
  --include-views       Include database views in generation
  --exclude-views=v1,v2 Exclude specific views
  --locale=pt-BR        Naming locale for class/relation names (default: en)
  --naming-overrides    Path to JSON config for naming customizations (see docs)
  --dry-run             Print to stdout instead of writing a file
  --out=<file>          Override the generated file (defaults to generated-entities.ts or the index inside --out-dir)
  --out-dir=<dir>       Emit one file per entity inside this directory plus the shared index
  --help                Show this help
`
  );
};
