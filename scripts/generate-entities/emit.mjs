import path from 'node:path';

export const writeSingleFile = async (fsPromises, out, code) => {
  await fsPromises.mkdir(path.dirname(out), { recursive: true });
  await fsPromises.writeFile(out, code, 'utf8');
};

export const writeSplitFiles = async (fsPromises, tableFiles, outDir, indexOut, indexCode) => {
  await fsPromises.mkdir(outDir, { recursive: true });
  for (const file of tableFiles) {
    await fsPromises.writeFile(file.path, file.code, 'utf8');
  }
  await fsPromises.mkdir(path.dirname(indexOut), { recursive: true });
  await fsPromises.writeFile(indexOut, indexCode, 'utf8');
};

export const printDryRun = (logger, tableFiles, indexCode, indexPath) => {
  for (const file of tableFiles) {
    logger.log(`\n==> ${file.path}\n`);
    logger.log(file.code);
  }
  logger.log(`\n==> ${indexPath}\n`);
  logger.log(indexCode);
};
