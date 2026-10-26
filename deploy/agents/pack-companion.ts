import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const directory = process.argv[2];
if (!directory) throw new Error('Pass the connection component output directory');
const tarballs = readdirSync(directory).filter((file) => file.endsWith('.tgz'));
if (tarballs.length !== 1) throw new Error('Expected exactly one connection component tarball');
const { name: packageName, version } = JSON.parse(readFileSync('packages/dsh-runtime/package.json', 'utf8'));
const file = tarballs[0];
const sha256 = createHash('sha256').update(readFileSync(path.join(directory, file))).digest('hex');
writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, packageName, version, file, sha256 }, null, 2) + '\n');
