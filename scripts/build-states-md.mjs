// Regenerates `packages/library-binary-numbers/states.md` and
// `packages/library-binary-numbers-bare/states.md` — Mermaid graphs for every
// exported state, used as a teaching artifact alongside the libraries.
//
// Usage: `npm run docs:states` (requires a prior `npm run build`, since this
// imports from `dist/`). Not run during tests; doc artifacts are committed to
// the repo and regenerated manually when the libraries' state graphs change.
//
// Per-library isolation: state IDs are auto-assigned by a module-level counter
// in `State.ts`. If both libraries are imported into the same Node process, the
// counter is shared and the second-imported library's IDs depend on how many
// states the first-imported one constructed — adding a state to one library
// shifts every ID in the other library's states.md. To avoid that cross-
// coupling, each library is rendered in its own child Node process spawned by
// this script, so each starts from a fresh counter.

import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = fileURLToPath(import.meta.url);

const LIBRARIES = [
  {
    name: 'library-binary-numbers',
    importPath: '../packages/library-binary-numbers/dist/index.mjs',
    outputPath: resolve(root, 'packages/library-binary-numbers/states.md'),
  },
  {
    name: 'library-binary-numbers-bare',
    importPath: '../packages/library-binary-numbers-bare/dist/index.mjs',
    outputPath: resolve(root, 'packages/library-binary-numbers-bare/states.md'),
  },
];

const libArgIx = process.argv.indexOf('--lib');
const libName = libArgIx === -1 ? null : process.argv[libArgIx + 1];

if (libName === null) {
  // Dispatcher mode: one child per library, fresh State id counter in each.
  for (const {name} of LIBRARIES) {
    const r = spawnSync(process.execPath, [scriptPath, '--lib', name], {stdio: 'inherit'});

    if (r.status !== 0) {
      process.exit(r.status ?? 1);
    }
  }
} else {
  // Worker mode: render exactly one library. Spawned by the dispatcher above
  // so the State id counter starts fresh for this library's import.
  const entry = LIBRARIES.find((l) => l.name === libName);

  if (!entry) {
    console.error(`build-states-md: unknown library "${libName}"`);
    process.exit(1);
  }

  const {State, toMermaid} = await import('../packages/machine/dist/index.mjs');
  const library = (await import(entry.importPath)).default;

  const sections = [`# ${entry.name} — state graphs`, ''];

  for (const [stateName, state] of Object.entries(library.states)) {
    const tapeBlock = library.getTapeBlock();
    const graph = State.toGraph(state, tapeBlock);
    const mermaid = toMermaid(graph);
    // Exclude `isClonedHalt: true` nodes from the count — they are
    // visualization-only sentinels (one per wrapper context, all mapped to the
    // singleton `haltState` at runtime), not distinct runtime states.
    const nodeCount = Object.values(graph.nodes).filter((n) => !n.isClonedHalt).length;

    sections.push(`## ${stateName}`);
    sections.push('');
    sections.push(`*${nodeCount} state${nodeCount === 1 ? '' : 's'} (including \`haltState\`)*`);
    sections.push('');
    sections.push('```mermaid');
    sections.push(mermaid);
    sections.push('```');
    sections.push('');
  }

  writeFileSync(entry.outputPath, sections.join('\n'));
  console.log(`✓ Wrote ${entry.outputPath}`);
}
