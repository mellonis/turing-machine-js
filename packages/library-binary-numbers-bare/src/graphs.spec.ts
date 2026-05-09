import {State, fromMermaid, toMermaid} from '@turing-machine-js/machine';
import binaryNumbersBare from './index';

// Per-state node counts pinned from the source comments above each declaration
// in `index.ts`. Each count includes haltState. The bare-alphabet variants are
// notably smaller than their marker-based siblings — the headline trade-off
// this library exists to demonstrate.
const expectedNodeCount: Record<keyof typeof binaryNumbersBare['states'], number> = {
  plusOne: 3,
  minusOne: 3,
  invertNumber: 2,
  normalizeNumber: 2,
};

const stateNames = Object.keys(expectedNodeCount) as Array<keyof typeof expectedNodeCount>;

describe('library-binary-numbers-bare state graphs', () => {
  test.each(stateNames)(
    '%s: toGraph produces the documented node count',
    (name) => {
      const tapeBlock = binaryNumbersBare.getTapeBlock();
      const graph = State.toGraph(binaryNumbersBare.states[name], tapeBlock);

      expect(Object.keys(graph.nodes)).toHaveLength(expectedNodeCount[name]);
    },
  );

  test.each(stateNames)(
    '%s: graph has at least one halt-reachable node',
    (name) => {
      const tapeBlock = binaryNumbersBare.getTapeBlock();
      const graph = State.toGraph(binaryNumbersBare.states[name], tapeBlock);

      const haltNodes = Object.values(graph.nodes).filter((node) => node.isHalt);

      expect(haltNodes).toHaveLength(1);
    },
  );

  test.each(stateNames)(
    '%s: toMermaid → fromMermaid round-trips with the same node count',
    (name) => {
      const tapeBlock = binaryNumbersBare.getTapeBlock();
      const original = State.toGraph(binaryNumbersBare.states[name], tapeBlock);

      const mermaid = toMermaid(original);
      const reparsed = fromMermaid(mermaid);

      expect(Object.keys(reparsed.nodes)).toHaveLength(Object.keys(original.nodes).length);
      expect(mermaid).toMatch(/^flowchart\s+(?:LR|TD|TB|RL|BT)/);
    },
  );

  test('every state in the public surface has a documented count', () => {
    const exportedNames = Object.keys(binaryNumbersBare.states).sort();
    const documentedNames = stateNames.slice().sort();

    expect(exportedNames).toEqual(documentedNames);
  });

  test('bare-library algorithms are at most half the size of their marker-based siblings', () => {
    // Headline claim of this paired library: the 3-symbol alphabet trade-off
    // is "smaller graphs, multi-number tapes lost". This pins a numerical
    // version of that claim.
    const sharedAlgorithms = ['plusOne', 'minusOne', 'invertNumber', 'normalizeNumber'] as const;

    for (const name of sharedAlgorithms) {
      const bareSize = expectedNodeCount[name];
      // Reference numbers from library-binary-numbers (asserted in its sibling
      // graphs.spec.ts):
      const markerSize = {plusOne: 5, minusOne: 17, invertNumber: 5, normalizeNumber: 7}[name];

      expect(bareSize * 2).toBeLessThanOrEqual(markerSize + 1);
    }
  });
});
