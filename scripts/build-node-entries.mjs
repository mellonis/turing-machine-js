import { rollup } from 'rollup';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve paths relative to the repo root (this script's parent's parent),
// so the script behaves the same whether invoked from root (`npm run build`)
// or from a sub-package (`packages/X/ $ npm run build`).
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Optional `--package=<scoped-name>` filter — when present, build only that
// package's Node entries; otherwise build all. Per-package `prepublishOnly`
// hooks pass the flag so each publish only Rollups its own package, while the
// root's `npm run build` (no flag) batches all four.
const pkgFlag = process.argv.slice(2).find((a) => a.startsWith('--package='));
const requestedPkg = pkgFlag ? pkgFlag.slice('--package='.length) : null;

const allPackages = [
  {
    name: '@turing-machine-js/machine',
    dir: 'packages/machine',
    external: [],
  },
  {
    name: '@turing-machine-js/builder',
    dir: 'packages/builder',
    external: ['@turing-machine-js/machine'],
  },
  {
    name: '@turing-machine-js/library-binary-numbers',
    dir: 'packages/library-binary-numbers',
    external: ['@turing-machine-js/machine'],
  },
  {
    name: '@turing-machine-js/library-binary-numbers-bare',
    dir: 'packages/library-binary-numbers-bare',
    external: ['@turing-machine-js/machine'],
  },
  {
    name: '@turing-machine-js/visuals',
    dir: 'packages/visuals',
    external: ['@turing-machine-js/machine'],
  },
];

const packages = requestedPkg
  ? allPackages.filter((p) => p.name === requestedPkg)
  : allPackages;

if (requestedPkg && packages.length === 0) {
  console.error(`Unknown package: ${requestedPkg}`);
  console.error(`Known: ${allPackages.map((p) => p.name).join(', ')}`);
  process.exit(1);
}

for (const pkg of packages) {
  const bundle = await rollup({
    input: resolve(REPO_ROOT, pkg.dir, 'dist/index.js'),
    external: pkg.external,
  });

  await bundle.write({
    file: resolve(REPO_ROOT, pkg.dir, 'dist/index.mjs'),
    format: 'es',
    exports: 'auto',
  });

  await bundle.write({
    file: resolve(REPO_ROOT, pkg.dir, 'dist/index.cjs'),
    format: 'cjs',
    exports: 'auto',
  });

  await bundle.close();

  console.log(`Built ${pkg.name} Node entries.`);
}
