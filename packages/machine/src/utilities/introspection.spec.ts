import {summarize, summarizeGraph} from './introspection';
import type {Graph} from './graph';

describe('summarizeGraph', () => {
  test('counts states and transitions', () => {
    const graph: Graph = {
      initialId: 1,
      alphabets: [[' ', '0', '1']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {
          id: 1, name: 'a', isHalt: false, overrodeHaltStateId: null,
          transitions: [
            {pattern: '0', command: [{symbol: '·', movement: 'R'}], nextStateId: 1},
            {pattern: '1', command: [{symbol: '·', movement: 'S'}], nextStateId: 0},
          ],
        },
      },
    };

    const s = summarizeGraph(graph);

    expect(s.stateCount).toBe(2);
    expect(s.transitionCount).toBe(2);
    expect(s.tapeCount).toBe(1);
    expect(s.alphabetCardinalities).toEqual([3]);
  });

  test('detects self-loops and cycles', () => {
    const graph: Graph = {
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {
          id: 1, name: 'a', isHalt: false, overrodeHaltStateId: null,
          transitions: [
            {pattern: '0', command: [{symbol: '·', movement: 'R'}], nextStateId: 1},
          ],
        },
      },
    };

    const s = summarizeGraph(graph);

    expect(s.selfLoopCount).toBe(1);
    expect(s.hasCycles).toBe(true);
  });

  test('detects acyclic graph', () => {
    const graph: Graph = {
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {
          id: 1, name: 'a', isHalt: false, overrodeHaltStateId: null,
          transitions: [{pattern: '0', command: [{symbol: '·', movement: 'S'}], nextStateId: 0}],
        },
      },
    };

    const s = summarizeGraph(graph);

    expect(s.hasCycles).toBe(false);
    expect(s.selfLoopCount).toBe(0);
  });

  test('computes max composition depth', () => {
    // a → onHalt → b → onHalt → c (chain of 2)
    const graph: Graph = {
      initialId: 1,
      alphabets: [[' ']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {id: 1, name: 'a', isHalt: false, transitions: [], overrodeHaltStateId: 2},
        2: {id: 2, name: 'b', isHalt: false, transitions: [], overrodeHaltStateId: 3},
        3: {id: 3, name: 'c', isHalt: false, transitions: [], overrodeHaltStateId: null},
      },
    };

    const s = summarizeGraph(graph);

    expect(s.maxCompositionDepth).toBe(2);
    expect(s.compositionEdgeCount).toBe(2);
  });

  test('returns zero composition depth when no overrides', () => {
    const graph: Graph = {
      initialId: 1,
      alphabets: [[' ']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {id: 1, name: 'a', isHalt: false, transitions: [], overrodeHaltStateId: null},
      },
    };

    expect(summarizeGraph(graph).maxCompositionDepth).toBe(0);
  });
});

describe('State.inspect', () => {
  test('returns single-state info for a state with no override', async () => {
    const {State, Alphabet, TapeBlock, haltState, ifOtherSymbol, movements} =
      await import('@turing-machine-js/machine');

    const alphabet = new Alphabet([' ', '0', '1']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const s = new State({
      [symbol(['0'])]: {command: {symbol: '1', movement: movements.right}, nextState: haltState},
      [ifOtherSymbol]: {command: {movement: movements.right}},
    }, 'test');

    const info = State.inspect(s);

    expect(info.name).toBe('test');
    expect(info.isHalt).toBe(false);
    expect(info.overrodeHaltState).toBeNull();
    expect(info.transitions.length).toBe(2);

    const haltTransition = info.transitions.find((t) => t.nextState?.name === haltState.name);
    expect(haltTransition).toBeTruthy();
    expect(haltTransition!.command[0].movement).toBe('R');
    expect(haltTransition!.command[0].symbol).toBe('1');
  });

  test('returns override-halt info when set', async () => {
    const {State, Alphabet, TapeBlock, haltState, movements} =
      await import('@turing-machine-js/machine');

    const alphabet = new Alphabet([' ', 'a']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const inner = new State({
      [symbol(['a'])]: {command: {movement: movements.right}, nextState: haltState},
    }, 'inner');
    const outer = new State({
      [symbol(['a'])]: {command: {movement: movements.right}, nextState: haltState},
    }, 'outer');
    const wrapped = inner.withOverrodeHaltState(outer);

    const info = State.inspect(wrapped);

    expect(info.overrodeHaltState).toEqual({id: outer.id, name: 'outer'});
  });

  test('returns null nextState for unbound References', async () => {
    const {State, Alphabet, TapeBlock, Reference, movements} =
      await import('@turing-machine-js/machine');

    const alphabet = new Alphabet([' ', 'a']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const ref = new Reference();
    const s = new State({
      [symbol(['a'])]: {command: {movement: movements.right}, nextState: ref},
    }, 'with-unbound');

    const info = State.inspect(s);

    expect(info.transitions[0].nextState).toBeNull();
  });
});

describe('summarize (binary library comparison)', () => {
  // The headline use case: comparing the marker-based and bare libraries to
  // make state-count/composition/cycle judgments.
  test('marker-based minusOne is bigger and uses composition; bare is smaller and flat', async () => {
    const binaryNumbers = (await import('@turing-machine-js/library-binary-numbers')).default;
    const binaryNumbersBare = (await import('@turing-machine-js/library-binary-numbers-bare')).default;

    const marker = summarize(binaryNumbers.states.minusOne, binaryNumbers.getTapeBlock());
    const bare = summarize(binaryNumbersBare.states.minusOne, binaryNumbersBare.getTapeBlock());

    expect(marker.stateCount).toBeGreaterThan(bare.stateCount);
    expect(marker.compositionEdgeCount).toBeGreaterThan(0);
    expect(bare.compositionEdgeCount).toBe(0);
    expect(marker.maxCompositionDepth).toBeGreaterThanOrEqual(3);
    expect(bare.maxCompositionDepth).toBe(0);
    expect(marker.tapeCount).toBe(1);
    expect(bare.tapeCount).toBe(1);
    expect(marker.alphabetCardinalities).toEqual([5]);
    expect(bare.alphabetCardinalities).toEqual([3]);
  });
});

describe('summarizeGraph defensive guards', () => {
  // The override-chain walker has a defensive Set guard against cycles.
  // State construction throws on cyclic overrodeHaltState, so we exercise it
  // by handing summarizeGraph a Graph constructed by hand with a cycle.
  test('terminates on a cyclic override chain instead of recursing forever', () => {
    const graph: Graph = {
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        1: {id: 1, name: 'a', isHalt: false, transitions: [], overrodeHaltStateId: 2},
        2: {id: 2, name: 'b', isHalt: false, transitions: [], overrodeHaltStateId: 1},
      },
    };

    const summary = summarizeGraph(graph);

    expect(summary.maxCompositionDepth).toBeGreaterThanOrEqual(1);
    expect(summary.maxCompositionDepth).toBeLessThan(Infinity);
  });
});
