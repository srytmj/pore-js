#!/usr/bin/env node
/**
 * Pack `porejs` + `porejs-react` into `dist-pack/*.tgz` for local consumption
 * before they're on npm. In another project:
 *
 *   npm i /abs/path/to/pore-js/dist-pack/porejs-1.0.0-rc.1.tgz \
 *         /abs/path/to/pore-js/dist-pack/porejs-react-1.0.0-rc.1.tgz
 *
 * Re-run `pnpm pack:local` after changes, then `npm i` again. See
 * docs/releasing.md.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-pack');
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// `pnpm pack` (not `npm pack`) rewrites `workspace:*` deps to the real version
// in the tarball, so the two .tgz files install cleanly in an outside project.
for (const pkg of ['reader-core', 'reader-react']) {
  execFileSync('pnpm', ['pack', '--pack-destination', out], {
    cwd: join(root, 'packages', pkg),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

console.log('\nPacked into dist-pack/:');
for (const f of readdirSync(out)) console.log('  ' + join(out, f));
