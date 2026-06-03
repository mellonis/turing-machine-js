import {State, fromMermaid, summarizeGraph, toMermaid} from '@turing-machine-js/machine';
import binaryNumbers from './index';

// Per-state counts pinned from the source comments above each declaration in
// `index.ts`. Runtime state counts (per `summarize().stateCount`) — excludes
// `isHaltMarker` visualization sentinels synthesized inside `halt frame`
// subgraphs. Matches the states.md per-algorithm header by construction.
const expectedNodeCount: Record<keyof typeof binaryNumbers['states'], number> = {
  goToNumber: 2,
  goToNextNumber: 3,
  goToPreviousNumber: 3,
  goToNumbersStart: 2,
  deleteNumber: 5,
  invertNumber: 5,
  normalizeNumber: 7,
  plusOne: 5,
  minusOne: 18,
  minusOneFast: 10,
};

const stateNames = Object.keys(expectedNodeCount) as Array<keyof typeof expectedNodeCount>;

describe('library-binary-numbers state graphs', () => {
  test.each(stateNames)(
    '%s: toGraph produces the documented node count',
    (name) => {
      const tapeBlock = binaryNumbers.getTapeBlock();
      const graph = State.toGraph(binaryNumbers.states[name], tapeBlock);

      expect(summarizeGraph(graph).stateCount).toBe(expectedNodeCount[name]);
    },
  );

  test.each(stateNames)(
    '%s: graph has at least one halt-reachable node',
    (name) => {
      const tapeBlock = binaryNumbers.getTapeBlock();
      const graph = State.toGraph(binaryNumbers.states[name], tapeBlock);

      // Every algorithm has exactly one REAL halt node (the singleton's id is
      // shared across all states' graphs). v7's wrapper-emit synthesizes one
      // `isHaltMarker: true` node per wrapper context as a visualization aid —
      // those are filtered out here.
      const realHaltNodes = Object.values(graph.nodes)
        .filter((node) => node.isHalt && !node.isHaltMarker);

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
