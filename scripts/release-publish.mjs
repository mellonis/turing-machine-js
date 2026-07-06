import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

// Resolve paths relative to the repo root (this script's parent's parent),
// matching the other scripts/ entries.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Usage:
//   node scripts/release-publish.mjs [--tag <dist-tag>] [--dry-run]
//
// Per workspace package: skip if `private`, skip if <name>@<version> is
// already on the registry, otherwise `npm publish --workspace <name>`.
// Reproduces `lerna publish from-package` — per-package `prepublishOnly`
// build hooks are npm's and keep working.
//
// The dist-tag is INFERRED from each package's version string unless
// `--tag` overrides it: prerelease (contains '-') → `next`, stable →
// `latest`. This permanently removes the "alpha clobbered `latest`"
// footgun the lerna flow had to guard by convention.
//
// Preview a would-be publish with `npm publish --dry-run --workspaces`
// (or pass `--dry-run` here to run this script's skip logic too).

const args = process.argv.slice(2);
const tagFlag = args.find((a) => a.startsWith('--tag'));
const tagOverride = tagFlag
  ? (tagFlag.includes('=') ? tagFlag.split('=')[1] : args[args.indexOf(tagFlag) + 1])
  : null;
const dryRun = args.includes('--dry-run');

const packagesDir = join(REPO_ROOT, 'packages');
const workspaces = readdirSync(packagesDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(packagesDir, e.name, 'package.json')))
  .map((e) => JSON.parse(readFileSync(join(packagesDir, e.name, 'package.json'), 'utf8')));

function isOnRegistry(name, version) {
  try {
    const out = execSync(`npm view ${name}@${version} version --json`, {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out.length > 0;
  } catch {
    // npm view exits non-zero (E404) for a version that isn't on the
    // registry — exactly the "needs publishing" case.
    return false;
  }
}

let published = 0;
let failed = 0;

for (const pkg of workspaces) {
  if (pkg.private) {
    console.log(`skip ${pkg.name}: private`);
    continue;
  }
  if (isOnRegistry(pkg.name, pkg.version)) {
    console.log(`skip ${pkg.name}@${pkg.version}: already on the registry`);
    continue;
  }
  const tag = tagOverride ?? (pkg.version.includes('-') ? 'next' : 'latest');
  const cmd = `npm publish --workspace ${pkg.name} --tag ${tag}${dryRun ? ' --dry-run' : ''}`;
  console.log(`${dryRun ? '[dry-run] ' : ''}publishing ${pkg.name}@${pkg.version} with tag ${tag}`);
  try {
    execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit' });
    published += 1;
  } catch {
    console.error(`FAILED: ${cmd}`);
    failed += 1;
  }
}

console.log(`done: ${published} published, ${failed} failed, ${workspaces.length - published - failed} skipped`);
if (failed > 0) process.exit(1);
