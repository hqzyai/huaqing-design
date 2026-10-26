import { spawn, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { resolveDataDir } from '../../apps/daemon/dist/daemon-paths.js';
import { applySandboxRuntimeEnv, ensureSandboxRuntimeDirs, resolveSandboxRuntimeConfig } from '../../apps/daemon/dist/sandbox-mode.js';

// Reuse the daemon's path primitives and propagate its explicit data root.
// Never seed credentials or read configuration from the build machine.
const dataRoot = resolveDataDir(process.env.OD_DATA_DIR, '/app', { requireExplicit: true });
const sandbox = resolveSandboxRuntimeConfig(true, dataRoot);
ensureSandboxRuntimeDirs(sandbox);
const env = applySandboxRuntimeEnv(process.env, sandbox);
env.DSH_HOME = path.join(sandbox.roots.agentHomeDir, '.dsh');
env.HERMES_HOME = path.join(sandbox.roots.agentHomeDir, '.hermes');
env.HERMES_WRITE_SAFE_ROOT = dataRoot;
env.XDG_RUNTIME_DIR = path.join(sandbox.roots.tempDir, 'xdg-runtime');
mkdirSync(env.HERMES_HOME, { recursive: true, mode: 0o700 });
mkdirSync(env.XDG_RUNTIME_DIR, { recursive: true, mode: 0o700 });
const profile = path.join(env.DSH_HOME, 'profiles', 'open-design');
if (!existsSync(path.join(profile, 'package.json'))) {
  mkdirSync(path.dirname(profile), { recursive: true });
  cpSync('/opt/agent-seed/dsh/profiles/open-design', profile, { recursive: true, verbatimSymlinks: true });
}

const command = process.argv.slice(2);
if (command.length === 0) {
  console.log('[agents] Checking the bundled DeepSeek Harness connection component...');
  const probe = spawnSync('dsh', ['--profile', 'open-design', '--probe'], { env, encoding: 'utf8', timeout: 120_000 });
  if (probe.status !== 0) throw new Error(`DeepSeek Harness profile probe failed: ${probe.error?.message ?? probe.stderr}`);
  console.log(`[agents] ${probe.stdout.trim()}`);
}
const child = spawn(command[0] ?? process.execPath, command.length ? command.slice(1) : ['apps/daemon/dist/cli.js', '--no-open'], {
  env, stdio: 'inherit', cwd: '/app',
});
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.on(signal, () => child.kill(signal));
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
