// Regenerates `packages/library-binary-numbers/states.md` and
// `packages/library-binary-numbers-bare/states.md` — Mermaid graphs for every
// exported state, used as a teaching artifact alongside the libraries.
//
// Usage: `npm run docs:states` (requires a prior `npm run build`, since this
// imports from `dist/`). Not run during tests; doc artifacts are committed to
// the repo and regenerated manually when the libraries' state graphs change.
//
// Heads-up: state IDs are auto-assigned at module-evaluation time (`State.ts`'s
// `id(this)` increments a module-level counter). Re-running this script will
// produce a deterministic-but-different ID renumbering if the import order or
// other consumers shift; the resulting diff is cosmetic — only the `s<N>`
// labels move, the graph topology is identical. If a renumber-only diff
// surfaces during a refresh, it's safe to commit.

import {writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {State, toMermaid} from '../packages/machine/dist/index.mjs';
import binaryNumbers from '../packages/library-binary-numbers/dist/index.mjs';
import binaryNumbersBare from '../packages/library-binary-numbers-bare/dist/index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function renderLibrary(libraryName, library) {
  const sections = [`# ${libraryName} — state graphs`, ''];

  for (const [stateName, state] of Object.entries(library.states)) {
    const tapeBlock = library.getTapeBlock();
    const graph = State.toGraph(state, tapeBlock);
    const mermaid = toMermaid(graph);
    const nodeCount = Object.keys(graph.nodes).length;

    sections.push(`## ${stateName}`);
    sections.push('');
    sections.push(`*${nodeCount} state${nodeCount === 1 ? '' : 's'} (including \`haltState\`)*`);
    sections.push('');
    sections.push('```mermaid');
    sections.push(mermaid);
    sections.push('```');
    sections.push('');
  }

  return sections.join('\n');
}

const libraries = [
  {
    libraryName: 'library-binary-numbers',
    library: binaryNumbers,
    outputPath: resolve(root, 'packages/library-binary-numbers/states.md'),
  },
  {
    libraryName: 'library-binary-numbers-bare',
    library: binaryNumbersBare,
    outputPath: resolve(root, 'packages/library-binary-numbers-bare/states.md'),
  },
];

for (const {libraryName, library, outputPath} of libraries) {
  const content = renderLibrary(libraryName, library);
  writeFileSync(outputPath, content);
  console.log(`✓ Wrote ${outputPath}`);
}
