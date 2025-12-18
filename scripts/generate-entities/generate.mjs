import fs from 'node:fs/promises';
import { introspectSchema } from '../../dist/index.js';
import { createNamingStrategy } from '../naming-strategy.mjs';
import { loadDriver } from './drivers.mjs';
import { renderEntityFile, renderSplitEntityFiles, renderSplitIndexFile } from './render.mjs';
import { printDryRun, writeSingleFile, writeSplitFiles } from './emit.mjs';

const loadIrregulars = async (filePath, fsPromises) => {
  const raw = await fsPromises.readFile(filePath, 'utf8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse naming overrides at ${filePath}: ${err.message || err}`);
  }
  const irregulars =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed.irregulars && typeof parsed.irregulars === 'object' && !Array.isArray(parsed.irregulars)
        ? parsed.irregulars
        : parsed
      : undefined;
  if (!irregulars) {
    throw new Error(`Naming overrides at ${filePath} must be an object or { "irregulars": { ... } }`);
  }
  return irregulars;
};

export const generateEntities = async (opts, context = {}) => {
  const { fs: fsPromises = fs, logger = console } = context;
  const irregulars = opts.namingOverrides ? await loadIrregulars(opts.namingOverrides, fsPromises) : undefined;
  const naming = createNamingStrategy(opts.locale, irregulars);

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
