import Alphabet from './Alphabet';
import State, {haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {MachineState} from './TuringMachine';
import {movements} from './TapeCommand';
import {toGraph} from '../utilities/stateGraph';

/**
 * Per-iter `matchedTransition` (#205). For every yielded `MachineState`:
 *
 *   matchedTransition = {
 *     id: string;                                 // resolvable in toGraph
 *     matchKinds: ('wildcard' | 'literal')[];     // per-tape, length = tape count
 *   }
 *
 * Cases covered here:
 *   - Literal match (specific-symbol pattern fired): kind 'literal'.
 *   - Wildcard match (`ifOtherSymbol` fired): kind 'wildcard'.
 *   - Multi-tape with mixed per-position kinds.
 *   - Wrapper-entry iter: id references the BARE's transition, not the wrapper.
 *   - Halt-bound transitions get a resolvable id.
 *   - id resolves in `toGraph`'s output (round-trip).
 *
 * Note: `nextStateId === 0` indicates the real halt singleton in toGraph; in-frame
 * halts (wrapped) have `nextStateId === -2 * frameId`. Both flavors still get a valid
 * `matchedTransition.id` — the engine reports the source-anchored transition id
 * regardless of where the transition points.
 */

const alphabet = new Alphabet([' ', 'a', 'b']);

describe('MachineState.matchedTransition (#205)', () => {
  test('literal match: id format `${stateId}.${ix}`, matchKinds = literal', async () => {
    const tape = new Tape({alphabet, symbols: ['a']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const {symbol} = tapeBlock;

    const state = new State({
      [symbol(['a'])]: {nextState: haltState},
    }, 'matchOnA');

    const machine = new TuringMachine({tapeBlock});
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: state})) { yields.push(m); }

    expect(yields).toHaveLength(1);
    expect(yields[0].matchedTransition).toEqual({
      id: `${state.id}.0`,
      matchKinds: ['literal'],
    });
  });

  test('wildcard match: ifOtherSymbol fires when no specific pattern matches', async () => {
    const tape = new Tape({alphabet, symbols: ['a']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const {symbol} = tapeBlock;

    const state = new State({
      [symbol(['b'])]: {nextState: haltState},      // ix 0: specific 'b', won't fire on 'a'
      [ifOtherSymbol]: {nextState: haltState},      // ix 1: catch-all, fires
    }, 'catchAll');

    const machine = new TuringMachine({tapeBlock});
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: state})) { yields.push(m); }

    expect(yields).toHaveLength(1);
    expect(yields[0].matchedTransition).toEqual({
      id: `${state.id}.1`,
      matchKinds: ['wildcard'],
    });
  });

  test('multi-tape: per-tape matchKinds reflect the winning alternative', async () => {
    // Two tapes. Pattern `[ifOtherSymbol, 'b']` matches tape0=anything, tape1='b'.
    // Per-tape kinds for this match: ['wildcard', 'literal'].
    const tapeA = new Tape({alphabet, symbols: ['a']});
    const tapeB = new Tape({alphabet, symbols: ['b']});
    const tapeBlock = TapeBlock.fromTapes([tapeA, tapeB]);
    const {symbol} = tapeBlock;

    const state = new State({
      [symbol([ifOtherSymbol, 'b'])]: {
        command: [{movement: movements.stay}, {movement: movements.stay}],
        nextState: haltState,
      },
    }, 'wildcardThenLiteral');

    const machine = new TuringMachine({tapeBlock});
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: state})) { yields.push(m); }

    expect(yields).toHaveLength(1);
    expect(yields[0].matchedTransition.matchKinds).toEqual(['wildcard', 'literal']);
  });

  test('multi-tape: matchKinds length always equals tape count', async () => {
    const tapeA = new Tape({alphabet, symbols: ['a']});
    const tapeB = new Tape({alphabet, symbols: ['a']});
    const tapeBlock = TapeBlock.fromTapes([tapeA, tapeB]);
    const {symbol} = tapeBlock;

    const state = new State({
      // Both positions specific:
      [symbol(['a', 'a'])]: {
        command: [{movement: movements.stay}, {movement: movements.stay}],
        nextState: haltState,
      },
    });

    const machine = new TuringMachine({tapeBlock});
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: state})) { yields.push(m); }

    expect(yields[0].matchedTransition.matchKinds).toEqual(['literal', 'literal']);
    expect(yields[0].matchedTransition.matchKinds).toHaveLength(2);
  });

  test('wrapper-entry iter: id references the bare\'s transition, not the wrapper', async () => {
    // walkToBlank.withOverriddenHaltState(writeMarker): iter 1 starts at the
    // wrapper (composite source), but the wrapper's transitions in toGraph
    // are empty. The matched transition's id must reference the BARE's
    // transition id so consumers can resolve it via
    // `graph.nodes[bare.id].transitions`.
    const tape = new Tape({alphabet, symbols: ['a']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const {symbol} = tapeBlock;

    const bare = new State({
      [symbol([alphabet.blankSymbol])]: {nextState: haltState},  // ix 0: specific blank
      [ifOtherSymbol]: {command: [{movement: movements.right}]},  // ix 1: catch-all loop
    }, 'walkToBlank');
    const writeMarker = new State({
      [ifOtherSymbol]: {nextState: haltState},
    }, 'writeMarker');
    const wrapper = bare.withOverriddenHaltState(writeMarker);

    const machine = new TuringMachine({tapeBlock});
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: wrapper})) { yields.push(m); }

    // Iter 1 source = wrapper (delegates to bare's transitions).
    expect(yields[0].state).toBe(wrapper);
    // matchedTransition.id uses the BARE's stateId, not the wrapper's.
    expect(yields[0].matchedTransition.id).toBe(`${bare.id}.1`); // ifOtherSymbol slot
    // Distinguishable: id's prefix doesn't match m.state.id when wrapper delegated.
    expect(yields[0].matchedTransition.id.split('.')[0]).not.toBe(String(wrapper.id));
  });

  test('halt-bound transitions still get a resolvable id', async () => {
    const tape = new Tape({alphabet, symbols: [alphabet.blankSymbol]});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const {symbol} = tapeBlock;

    const state = new State({
      [symbol([alphabet.blankSymbol])]: {nextState: haltState},  // halt-bound
    }, 'haltOnBlank');

    const machine = new TuringMachine({tapeBlock});
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: state})) { yields.push(m); }

    expect(yields).toHaveLength(1);
    expect(yields[0].matchedTransition).toEqual({
      id: `${state.id}.0`,
      matchKinds: ['literal'],
    });
    expect(yields[0].nextState).toBe(haltState);
  });

  test('id round-trips through toGraph: graph.nodes[…].transitions has a matching id', async () => {
    const tape = new Tape({alphabet, symbols: ['a', 'b']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const {symbol} = tapeBlock;

    const state = new State({
      [symbol(['a'])]: {command: [{movement: movements.right}]}, // ix 0
      [symbol(['b'])]: {nextState: haltState},                    // ix 1
    });

    const machine = new TuringMachine({tapeBlock});
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: state})) { yields.push(m); }

    const graph = toGraph(state, tapeBlock);

    // Every observed matchedTransition.id is findable in the graph.
    for (const m of yields) {
      const sourceId = Number(m.matchedTransition.id.split('.')[0]);
      const node = graph.nodes[sourceId];
      expect(node).toBeDefined();
      const found = node.transitions.find((t) => t.id === m.matchedTransition.id);
      expect(found).toBeDefined();
    }
  });
});
