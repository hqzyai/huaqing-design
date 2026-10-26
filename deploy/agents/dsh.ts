#!/usr/bin/env node
import { spawn } from 'node:child_process';

// rc.2's profile loader and settings watcher use Node internals. Probes need
// the same environment as generation, including on a fresh data volume.
const args = process.argv.slice(2);
const exposeInternals = args.some((arg) => ['--stdio', '--probe', '--models', 'web'].includes(arg));
const child = spawn(process.execPath, [
  ...(exposeInternals ? ['--expose-internals'] : []),
  '/opt/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js',
  ...args,
], { stdio: 'inherit', env: process.env });
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => child.kill(signal));
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
