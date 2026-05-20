import State from '../classes/State';
import TapeBlock from '../classes/TapeBlock';
import {type Graph} from './graph';

// Quantitative summary of a state graph — designed to help a student compare
// two implementations of the same algorithm and answer questions like:
//   - "How many states does each version have?"
//   - "Does either use withOverriddenHaltState composition?"
//   - "How deep is that composition?"
//   - "Are there cycles? self-loops?"
//   - "What's the alphabet size for each tape?"
//
// Example use:
//   import binaryNumbers from '@turing-machine-js/library-binary-numbers';
//   import binaryNumbersBare from '@turing-machine-js/library-binary-numbers-bare';
//   import { summarize } from '@turing-machine-js/machine';
//
//   const a = summarize(binaryNumbers.states.minusOne, binaryNumbers.getTapeBlock());
//   const b = summarize(binaryNumbersBare.states.minusOne, binaryNumbersBare.getTapeBlock());
//   // a.stateCount === 15, b.stateCount === 3
//   // a.maxCompositionDepth === 4, b.maxCompositionDepth === 0
export type GraphSummary = {
  // Counts
  stateCount: number;
  transitionCount: number;

  // Composition via withOverriddenHaltState
  compositionEdgeCount: number;     // states with an overriddenHaltStateId set
  maxCompositionDepth: number;      // longest chain of withOverriddenHaltState (0 if none)

  // Structural
  selfLoopCount: number;            // transitions where nextStateId === own id
  hasCycles: boolean;               // any cycle in the transition graph (incl. self-loops)

  // Alphabet
  tapeCount: number;
  alphabetCardinalities: number[];  // size of each tape's alphabet
};

export function summarizeGraph(graph: Graph): GraphSummary {
  const nodes = Object.values(graph.nodes);

  // `isClonedHalt` nodes are visualization sentinels — one per wrapper context,
  // all corresponding to the singleton `haltState` at runtime. They don't
  // count as distinct runtime states; matches the per-algorithm header in
  // `library-binary-numbers/states.md`.
  const runtimeStateCount = nodes.filter((n) => !n.isClonedHalt).length;

  let transitionCount = 0;
  let compositionEdgeCount = 0;
  let selfLoopCount = 0;

  for (const node of nodes) {
    transitionCount += node.transitions.length;

    if (node.overriddenHaltStateId !== null) {
      compositionEdgeCount += 1;
    }

    for (const t of node.transitions) {
      if (t.nextStateId === node.id) {
        selfLoopCount += 1;
      }
    }
  }

  // Longest withOverriddenHaltState chain. Walks node → overriddenHaltState recursively;
  // a Set guards against cycles in the override graph (which throw at construction
  // time anyway, but being defensive costs little).
  const overrideDepthFrom = (id: number, visited: Set<number>): number => {
    if (visited.has(id)) {
      return 0;
    }

    visited.add(id);

    const node = graph.nodes[id];

    if (!node || node.overriddenHaltStateId === null) {
      return 0;
    }

    return 1 + overrideDepthFrom(node.overriddenHaltStateId, visited);
  };

  const maxCompositionDepth = nodes.reduce(
    (max, node) => Math.max(max, overrideDepthFrom(node.id, new Set())),
    0,
  );

  // Cycle detection: tri-color DFS over the transition graph.
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<number, number>();

  for (const node of nodes) {
    color.set(node.id, WHITE);
  }

  let hasCycles = false;

  const visit = (id: number): void => {
    // No `if (hasCycles) return` guard at function entry: the recursive call
    // pattern (outer for-loop checks before calling, inner loop checks after
    // each recursive call) ensures visit() is never invoked when hasCycles
    // is already true. Static analysis confirmed the guard was unreachable.
    if (color.get(id) === GREY) {
      hasCycles = true;
      return;
    }

    if (color.get(id) === BLACK) {
      return;
    }

    color.set(id, GREY);

    const node = graph.nodes[id];

    if (node) {
      for (const t of node.transitions) {
        visit(t.nextStateId);

        if (hasCycles) {
          return;
        }
      }
    }

    color.set(id, BLACK);
  };

  for (const node of nodes) {
    if (hasCycles) {
      break;
    }

    visit(node.id);
  }

  return {
    stateCount: runtimeStateCount,
    transitionCount,
    compositionEdgeCount,
    maxCompositionDepth,
    selfLoopCount,
    hasCycles,
    tapeCount: graph.alphabets.length,
    alphabetCardinalities: graph.alphabets.map((a) => a.length),
  };
}

// Convenience: build the graph and summarize in one step.
export function summarize(state: State, tapeBlock: TapeBlock): GraphSummary {
  return summarizeGraph(State.toGraph(state, tapeBlock));
}

// Behavioral equivalence checking (the testing-tool counterpart to introspection)
// lives in ./equivalence — kept separate because it runs machines and compares
// outputs rather than examining structure.
