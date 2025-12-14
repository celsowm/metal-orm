#!/usr/bin/env node
import path from 'node:path';
import { spawn } from 'node:child_process';

const [, , ...userArgs] = process.argv;

const TARGETS = {
    src: ['./src'],
    all: ['./src', './tests', './scripts', './playground'],
    playground: ['./playground'],
    'src/core': ['./src/core'],
};

const [firstArg, ...restArgs] = userArgs;
const hasTarget = firstArg && !firstArg.startsWith('-');

const targetKey = hasTarget ? firstArg : 'all';
const extraArgs = hasTarget ? restArgs : userArgs;

const paths = TARGETS[targetKey] ?? [targetKey];

if (paths.length === 0) {
    console.error(`Unknown lint target: ${targetKey}`);
    process.exit(1);
}

const eslintArgs = [...paths, '--ext', '.ts,.tsx,.mjs', ...extraArgs];

const eslintBinBase = path.join(process.cwd(), 'node_modules', '.bin', 'eslint');
const executable = process.platform === 'win32' ? `${eslintBinBase}.cmd` : eslintBinBase;

const child = spawn(executable, eslintArgs, { stdio: 'inherit', shell: true });

child.on('exit', (code) => process.exit(code));
