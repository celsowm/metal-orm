import fs from 'node:fs/promises';
import { introspectSchema } from '../../dist/index.js';
import { createNamingStrategy } from '../naming-strategy.mjs';
import { loadDriver } from './drivers.mjs';
import { renderEntityFile, renderSplitEntityFiles, renderSplitIndexFile } from './render.mjs';
import { printDryRun, writeSingleFile, writeSplitFiles } from './emit.mjs';

const loadNamingOverrides = async (filePath, fsPromises) => {
  const raw = await fsPromises.readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse naming overrides at ${filePath}: ${err.message || err}`);
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Naming overrides at ${filePath} must be an object`);
  }

  // Support both flat format { "singular": "plural" } and structured { irregulars: {...}, relationOverrides: {...} }
  const hasStructuredFormat = parsed.irregulars || parsed.relationOverrides;

  const irregulars = hasStructuredFormat
    ? (parsed.irregulars && typeof parsed.irregulars === 'object' ? parsed.irregulars : {})
    : parsed;

  const relationOverrides = hasStructuredFormat && parsed.relationOverrides && typeof parsed.relationOverrides === 'object'
    ? parsed.relationOverrides
    : {};

  return { irregulars, relationOverrides };
};

export const generateEntities = async (opts, context = {}) => {
  const { fs: fsPromises = fs, logger = console } = context;
  const { irregulars, relationOverrides } = opts.namingOverrides
    ? await loadNamingOverrides(opts.namingOverrides, fsPromises)
    : { irregulars: undefined, relationOverrides: {} };
  const naming = createNamingStrategy(opts.locale, irregulars, relationOverrides);

  const { executor, cleanup } = await loadDriver(opts.dialect, opts.url, opts.dbPath);
  let schema;
  try {
    schema = await introspectSchema(executor, opts.dialect, {
      schema: opts.schema,
      includeTables: opts.include,
      excludeTables: opts.exclude
    });
  } finally {
    await cleanup?.();
  }

  if (opts.outDir) {
    const { tableFiles, metadata } = renderSplitEntityFiles(schema, { ...opts, naming });
    const indexCode = renderSplitIndexFile(metadata, { ...opts, naming });

    if (opts.dryRun) {
      printDryRun(logger, tableFiles, indexCode, opts.out);
      return;
    }

    await writeSplitFiles(fsPromises, tableFiles, opts.outDir, opts.out, indexCode);
    logger.log(`Wrote ${tableFiles.length} entity files to ${opts.outDir} and index ${opts.out} (${schema.tables.length} tables)`);
    return;
  }

  const code = renderEntityFile(schema, { ...opts, naming });

  if (opts.dryRun) {
    logger.log(code);
    return;
  }

  await writeSingleFile(fsPromises, opts.out, code);
  logger.log(`Wrote ${opts.out} (${schema.tables.length} tables)`);
};
