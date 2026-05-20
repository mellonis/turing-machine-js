import Alphabet from './Alphabet';
import Reference from './Reference';
import State, {haltState, ifOtherSymbol} from './State';
import TapeBlock from './TapeBlock';
import {movements, symbolCommands} from './TapeCommand';

const alphabet = new Alphabet(' 01'.split(''));
const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
const {symbol} = tapeBlock;

describe('State constructor — happy path', () => {
  // The default command (when a transition entry omits `command`) is
  // { symbol: keep, movement: stay }; the default nextState is the state
  // being constructed itself (i.e., self-loop). These four tests pin that
  // contract across both ifOtherSymbol and explicit-symbol entries.

  test('ifOtherSymbol with empty entry: self-loop with keep+stay', () => {
    const state = new State({
      [ifOtherSymbol]: {},
    });

    const resolved = state.getSymbol(tapeBlock);
    const command = state.getCommand(resolved);
    const nextState = state.getNextState(resolved);

    expect(nextState.ref).toBe(state); // self-loop
    expect(command.tapesCommands[0].movement).toBe(movements.stay);
    expect(command.tapesCommands[0].symbol).toBe(symbolCommands.keep);
  });

  test('ifOtherSymbol with unbound Reference: command defaults preserved, ref-read still throws', () => {
    const state = new State({
      [ifOtherSymbol]: {nextState: new Reference()},
    });

    const resolved = state.getSymbol(tapeBlock);
    const nextState = state.getNextState(resolved);

    expect(() => nextState.ref).toThrow('unbounded reference');
    const command = state.getCommand(resolved);
    expect(command.tapesCommands[0].movement).toBe(movements.stay);
    expect(command.tapesCommands[0].symbol).toBe(symbolCommands.keep);
  });

  test('ifOtherSymbol with bound Reference: nextState resolves to the bound target', () => {
    const ref = new Reference();
    const target = new State({[ifOtherSymbol]: {}});
    const state = new State({[ifOtherSymbol]: {nextState: ref}});
    ref.bind(target);

    const resolved = state.getSymbol(tapeBlock);
    const nextState = state.getNextState(resolved);

    expect(nextState.ref).toBe(target);
  });

  test('explicit symbol with empty entry: same defaults as ifOtherSymbol case', () => {
    const state = new State({
      [symbol(alphabet.symbols[0])]: {},
    });

    const resolved = state.getSymbol(tapeBlock);
    const command = state.getCommand(resolved);
    const nextState = state.getNextState(resolved);

    expect(nextState.ref).toBe(state);
    expect(command.tapesCommands[0].movement).toBe(movements.stay);
    expect(command.tapesCommands[0].symbol).toBe(symbolCommands.keep);
  });
});

describe('State constructor — invalid inputs', () => {
  test('throws when stateDefinition is empty (no transitions)', () => {
    expect(() => new State({})).toThrow('invalid state definition');
  });

  test('throws when stateDefinition has string-keyed properties (only symbol keys allowed)', () => {
    expect(() => new State({foo: {nextState: haltState}} as never))
      .toThrow(/^invalid state definition/);
  });

  test('throws when nextState is neither State nor Reference', () => {
    expect(() => new State({
      [symbol(['0'])]: {nextState: 'not a state' as never},
    })).toThrow('invalid nextState');
  });

  test('throws "invalid command" when Command construction fails (empty array)', () => {
    // command: [] takes the `try { new Command([]) }` branch. Command rejects
    // empty input; the catch swallows the inner error and commandLocal stays
    // as the plain []. The instanceof Command check then fails → throws.
    expect(() => new State({
      [symbol(['0'])]: {command: [] as never, nextState: haltState},
    })).toThrow('invalid command');
  });

  test('throws when user-provided name contains `(`', () => {
    expect(() => new State(null, 'foo(bar')).toThrow(/invalid state name/);
  });

  test('throws when user-provided name contains `)`', () => {
    expect(() => new State(null, 'foo)bar')).toThrow(/invalid state name/);
  });
});

describe('State.getCommand / .getNextState — error paths', () => {
  // Default-constructed State has an empty symbolToDataMap; any lookup throws.

  test('getCommand on an unmapped symbol throws "No command for symbol at state named …"', () => {
    expect(() => new State().getCommand(ifOtherSymbol))
      .toThrow(/^No command for symbol at state named/);
  });

  test('getNextState on an unmapped symbol throws "No nextState for symbol at state named …"', () => {
    expect(() => new State().getNextState(ifOtherSymbol))
      .toThrow(/^No nextState for symbol at state named/);
  });
});

describe('State.getSymbol — head resolution', () => {
  test('returns ifOtherSymbol when no specific transition matches the head', () => {
    // State has only a transition for '1'. Tape head defaults to blank ' '.
    // No specific symbol matches → fallback to ifOtherSymbol.
    const state = new State({
      [symbol(['1'])]: {nextState: haltState},
    });

    expect(state.getSymbol(tapeBlock)).toBe(ifOtherSymbol);
  });
});

describe('State.withOverriddenHaltState', () => {
  // The wrapper shares the original's symbolToDataMap and debugRef but adds
  // an overriddenHaltState. Audit-flagged: the previous test only checked the
  // name pattern; these tests pin the actual wrapping contract.

  test('wrapper exposes the override target', () => {
    const original = new State({[ifOtherSymbol]: {nextState: haltState}});
    const override = new State({[ifOtherSymbol]: {}});

    const wrapped = original.withOverriddenHaltState(override);

    expect(wrapped.overriddenHaltState).toBe(override);
    expect(original.overriddenHaltState).toBeNull(); // original unchanged
  });

  test('wrapper proxies getCommand / getNextState to the original transitions', () => {
    const original = new State({
      [symbol(['0'])]: {
        command: [{symbol: '1', movement: movements.right}],
        nextState: haltState,
      },
    });
    const wrapped = original.withOverriddenHaltState(haltState);

    const sym = symbol(['0']);
    expect(wrapped.getCommand(sym)).toBe(original.getCommand(sym));
    expect(wrapped.getNextState(sym)).toBe(original.getNextState(sym));
  });

  test('wrapper shares debugRef with the original (assignment on either is visible from both)', () => {
    const original = new State({[ifOtherSymbol]: {}});
    const wrapped = original.withOverriddenHaltState(haltState);

    original.debug = {before: true};

    expect(wrapped.debug?.before).toBe(true);

    // And the reverse — assigning on the wrapper updates the original.
    wrapped.debug = {after: true};

    expect(original.debug?.after).toBe(true);
  });

  test('wrapper has its own id (not shared with the original)', () => {
    const original = new State({[ifOtherSymbol]: {}});
    const wrapped = original.withOverriddenHaltState(haltState);

    expect(wrapped.id).not.toBe(original.id);
  });

  test('wrapper name encodes the override target as `bare(override)`', () => {
    const original = new State({[ifOtherSymbol]: {}}, 'inner');
    const override = new State({[ifOtherSymbol]: {}}, 'outer');

    const wrapped = original.withOverriddenHaltState(override);

    expect(wrapped.name).toBe('inner(outer)');
  });

  test('paren-naming distinguishes nestings that flat `>` notation would collide', () => {
    const A = new State({[ifOtherSymbol]: {}}, 'A');
    const B = new State({[ifOtherSymbol]: {}}, 'B');

    // Construction 1: bare=A, override=(B with override A)
    const inner1 = B.withOverriddenHaltState(A);
    const outer1 = A.withOverriddenHaltState(inner1);

    // Construction 2: bare=(A with override B), override=A
    const inner2 = A.withOverriddenHaltState(B);
    const outer2 = inner2.withOverriddenHaltState(A);

    // Old `>` notation would collide both at "A>B>A". Paren notation keeps them distinct.
    expect(outer1.name).toBe('A(B(A))');
    expect(outer2.name).toBe('A(B)(A)');
    expect(outer1.name).not.toBe(outer2.name);
  });
});

describe('State.toGraph — unbound Reference', () => {
  test('skips a transition whose nextState is an unbound Reference', () => {
    // An unbound Reference throws when its `.ref` getter is read. State.toGraph
    // catches that and skips the transition rather than failing the whole walk.
    const unboundRef = new Reference();
    const state = new State({
      [symbol(['0'])]: {nextState: unboundRef},
      [symbol(['1'])]: {nextState: haltState},
    });

    const graph = State.toGraph(state, tapeBlock);

    // Only the haltState-bound transition survives; the unbound one is dropped.
    expect(graph.nodes[state.id].transitions).toHaveLength(1);
  });
});

describe('State.fromGraph — cyclic override-halt chain', () => {
  test('throws when the override-halt graph has a cycle', () => {
    // Graphs constructed by State.toGraph always have acyclic override chains
    // (cycles throw at State construction). To exercise the defensive cycle
    // detection in fromGraph, hand-build a Graph with overriddenHaltStateId
    // pointing in a loop.
    // Nodes need at least one transition each — State construction at pass 2
    // rejects empty stateDefinitions before pass 3's cycle check would run.
    const dummyTransition = {pattern: '*', command: [{symbol: 'K', movement: 'S'}], nextStateId: 0, id: "test-edge"};
    const graph = {
      initialId: 1,
      alphabets: [[' ', '0', '1']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false},
        1: {id: 1, name: 'a', isHalt: false, transitions: [dummyTransition], overriddenHaltStateId: 2, isWrapped: false, isClonedHalt: false},
        2: {id: 2, name: 'b', isHalt: false, transitions: [dummyTransition], overriddenHaltStateId: 1, isWrapped: false, isClonedHalt: false},
      },
    };

    expect(() => State.fromGraph(graph)).toThrow(/^override-halt cycle at state #/);
  });
});
