import {State, fromMermaid, toMermaid} from '@turing-machine-js/machine';
import binaryNumbers from './index';

// Per-state node counts pinned from the source comments above each declaration
// in `index.ts`. Each count includes haltState plus any v7 cloned-halt nodes
// synthesized by `toGraph` (one per `withOverriddenHaltState` wrapper context).
// For single-wrapper algorithms the count is unchanged from v6 — the wrapper
// node disappears (collapsed into its bare) but a cloned halt appears, netting
// to zero. For shared-bare cases like `minusOne` (where the same bare appears
// in multiple wrapper contexts via per-context duplication), the count grows
// by `wrapperCount - 1` relative to v6.
const expectedNodeCount: Record<keyof typeof binaryNumbers['states'], number> = {
  goToNumber: 2,
  goToNextNumber: 3,
  goToPreviousNumber: 3,
  goToNumbersStart: 2,
  deleteNumber: 5,
  invertNumber: 5,
  normalizeNumber: 7,
  plusOne: 5,
  minusOne: 20,
  minusOneFast: 10,
};

const stateNames = Object.keys(expectedNodeCount) as Array<keyof typeof expectedNodeCount>;

describe('library-binary-numbers state graphs', () => {
  test.each(stateNames)(
    '%s: toGraph produces the documented node count',
    (name) => {
      const tapeBlock = binaryNumbers.getTapeBlock();
      const graph = State.toGraph(binaryNumbers.states[name], tapeBlock);

      expect(Object.keys(graph.nodes)).toHaveLength(expectedNodeCount[name]);
    },
  );

  test.each(stateNames)(
    '%s: graph has at least one halt-reachable node',
    (name) => {
      const tapeBlock = binaryNumbers.getTapeBlock();
      const graph = State.toGraph(binaryNumbers.states[name], tapeBlock);

      // Every algorithm has exactly one REAL halt node (the singleton's id is
      // shared across all states' graphs). v7's wrapper-emit synthesizes one
      // `isClonedHalt: true` node per wrapper context as a visualization aid —
      // those are filtered out here.
      const realHaltNodes = Object.values(graph.nodes)
        .filter((node) => node.isHalt && !node.isClonedHalt);

      expect(realHaltNodes).toHaveLength(1);
    },
  );

  test.each(stateNames)(
    '%s: toMermaid → fromMermaid round-trips with the same node count',
    (name) => {
      const tapeBlock = binaryNumbers.getTapeBlock();
      const original = State.toGraph(binaryNumbers.states[name], tapeBlock);

      const mermaid = toMermaid(original);
      const reparsed = fromMermaid(mermaid);

      expect(Object.keys(reparsed.nodes)).toHaveLength(Object.keys(original.nodes).length);
      // Mermaid output starts with a `flowchart` directive — sanity check it's
      // well-formed beyond just length > 0.
      expect(mermaid).toMatch(/^flowchart\s+(?:LR|TD|TB|RL|BT)/);
    },
  );

  test('every state in the public surface has a documented count', () => {
    // If a state is added to `binaryNumbers.states` without an entry in
    // `expectedNodeCount`, this catches it (rather than silently skipping
    // the new state in the parametrised tests above).
    const exportedNames = Object.keys(binaryNumbers.states).sort();
    const documentedNames = stateNames.slice().sort();

    expect(exportedNames).toEqual(documentedNames);
  });
});
