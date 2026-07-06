import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Resolve paths relative to the repo root (this script's parent's parent),
// matching the other scripts/ entries.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Usage:
//   node scripts/release-version.mjs <version> [--packages <a,b,…>]
//
// Writes <version> into the selected packages' package.json files (default:
// every workspace package — the lockstep bump `lerna version` used to do),
// then resyncs the lockfile via `npm install --package-lock-only`.
//
// `--packages` takes directory names (`visuals`) or full package names
// (`@scope/visuals`), comma-separated — the selective bump covers the
// visuals-only-deviation pattern the lerna lockstep model never represented.
//
// Dependency / peer-dependency ranges are deliberately NOT rewritten:
// range policy (e.g. raising a peer floor after an engine minor) is a
// hand-reviewed release-PR concern — see the release table in CLAUDE.md.

const args = process.argv.slice(2);
const version = args.find((a) => !a.startsWith('--'));
const packagesFlag = args.find((a) => a.startsWith('--packages'));

if (!version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
  console.error('usage: node scripts/release-version.mjs <semver-version> [--packages <a,b,…>]');
  process.exit(1);
}

const selected = packagesFlag
  ? (packagesFlag.includes('=') ? packagesFlag.split('=')[1] : args[args.indexOf(packagesFlag) + 1])
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : null;

const packagesDir = join(REPO_ROOT, 'packages');
const workspaces = readdirSync(packagesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(packagesDir, e.name, 'package.json')))
  .map((e) => {
    const manifestPath = join(packagesDir, e.name, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return { dir: e.name, name: manifest.name, manifestPath, manifest };
  });

const targets = selected
  ? workspaces.filter((w) => selected.includes(w.dir) || selected.includes(w.name))
  : workspaces;

if (selected && targets.length !== selected.length) {
  const known = new Set(targets.flatMap((w) => [w.dir, w.name]));
  const missing = selected.filter((s) => !known.has(s));
  console.error(`unknown package(s): ${missing.join(', ')}`);
  process.exit(1);
}

for (const w of targets) {
  const from = w.manifest.version;
  w.manifest.version = version;
  writeFileSync(w.manifestPath, `${JSON.stringify(w.manifest, null, 2)}\n`);
  console.log(`${w.name}: ${from} → ${version}`);
}

// Mirror the new versions into the lockfile's workspace entries. Hand-edited
// ranges (e.g. a post-bump peer raise) need their own resync — same command,
// run again after the edit.
execSync('npm install --package-lock-only', { cwd: REPO_ROOT, stdio: 'inherit' });
console.log(`lockfile resynced; ${targets.length}/${workspaces.length} package(s) at ${version}`);
