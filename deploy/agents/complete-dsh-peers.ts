import { spawnSync } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

// DSH's plugins have a cyclic peer graph. Materialize required peers explicitly
// instead of asking npm to repeatedly backtrack across that entire graph.
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw new Error('Pass source and destination lock directories');
cpSync(source, destination, { recursive: true });
const semver = createRequire('/usr/local/lib/node_modules/npm/package.json')('semver');
type Package = {
  version?: string;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
};

function intersect(ranges: Set<string>): string {
  let alternatives = [''];
  for (const range of ranges) {
    alternatives = alternatives.flatMap(left => range.split('||').map(right => `${left} ${right}`.trim()));
  }
  const result = alternatives.join(' || ');
  if (!semver.validRange(result)) throw new Error(`Invalid peer constraint: ${result}`);
  return result;
}

for (let pass = 0; pass < 8; pass++) {
  const lock = JSON.parse(readFileSync(path.join(destination, 'package-lock.json'), 'utf8'));
  const packages = lock.packages as Record<string, Package>;
  const missing = new Map<string, Set<string>>();
  const conflicts: string[] = [];
  for (const [location, pkg] of Object.entries(packages)) {
    for (const [name, range] of Object.entries(pkg.peerDependencies ?? {})) {
      if (pkg.peerDependenciesMeta?.[name]?.optional) continue;
      let resolved: Package | undefined;
      let directory = location;
      while (true) {
        resolved = packages[path.posix.join(directory, 'node_modules', name)];
        if (resolved || !directory) break;
        const parent = path.posix.dirname(directory);
        directory = parent === '.' ? '' : parent;
      }
      if (!resolved) {
        const ranges = missing.get(name) ?? new Set<string>();
        ranges.add(range);
        missing.set(name, ranges);
      } else if (resolved.version && !semver.satisfies(resolved.version, range)) {
        conflicts.push(`${location}: ${name}@${resolved.version} requires ${range}`);
      }
    }
  }
  if (conflicts.length) throw new Error(`Incompatible required peers:\n${conflicts.join('\n')}`);
  if (!missing.size) {
    console.log('[dsh] All required peer packages resolve to compatible versions.');
    process.exit(0);
  }
  // DSH's terminal UI limits React's major. Keep the optional web renderer's
  // required React DOM peer on that same supported React range.
  if (missing.has('react') && missing.has('react-dom')) {
    for (const range of missing.get('react')!) missing.get('react-dom')!.add(range);
  }
  const manifestFile = path.join(destination, 'package.json');
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8'));
  manifest.dependencies ??= {};
  for (const [name, ranges] of missing) {
    manifest.dependencies[name] = intersect(ranges);
    console.log(`[dsh] Adding required peer ${name}@${manifest.dependencies[name]}`);
  }
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2) + '\n');
  const install = spawnSync('npm', ['install', '--package-lock-only', '--ignore-scripts',
    '--legacy-peer-deps', '--no-audit', '--no-fund', '--before=2026-08-21T13:00:00Z'], {
    cwd: destination, stdio: 'inherit', env: process.env,
  });
  if (install.error) throw install.error;
  if (install.status !== 0) process.exit(install.status ?? 1);
}
throw new Error('DSH required-peer closure did not converge');
