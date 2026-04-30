import Alphabet from './Alphabet';
import Reference from './Reference';
import State, {haltState, ifOtherSymbol} from './State';
import TapeBlock from './TapeBlock';
import {movements, symbolCommands} from './TapeCommand';

describe('State constructor', () => {
  const alphabet = new Alphabet(' 01'.split(''));
  const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
  const {symbol} = tapeBlock;

  test('State', () => {
    expect(new State())
      .toBeTruthy();
  });

  test('ifOtherSymbol empty object', () => {
    const state = new State({
      [ifOtherSymbol]: {},
    });

    expect(state)
      .toBeTruthy();

    const appropriateSymbol = state.getSymbol(tapeBlock);
    const commandForZero = state.getCommand(appropriateSymbol);
    const nextState = state.getNextState(appropriateSymbol);

    expect(nextState.ref)
      .toBe(state);
    expect(commandForZero.tapesCommands[0].movement)
      .toBe(movements.stay);
    expect(commandForZero.tapesCommands[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('ifOtherSymbol unbound reference', () => {
    const state = new State({
      [ifOtherSymbol]: {
        nextState: new Reference(),
      },
    });

    expect(state)
      .toBeTruthy();

    const appropriateSymbol = state.getSymbol(tapeBlock);
    const commandForZero = state.getCommand(appropriateSymbol);
    const nextState = state.getNextState(appropriateSymbol);

    expect(() => nextState.ref)
      .toThrow('unbounded reference');
    expect(commandForZero.tapesCommands[0].movement)
      .toBe(movements.stay);
    expect(commandForZero.tapesCommands[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('ifOtherSymbol bound reference', () => {
    const ref = new Reference();
    const state = new State({
      [ifOtherSymbol]: {
        nextState: ref,
      },
    });
    const state2 = new State({
      [ifOtherSymbol]: {},
    });
    ref.bind(state2);

    expect(state)
      .toBeTruthy();
    expect(state2)
      .toBeTruthy();

    const appropriateSymbol = state.getSymbol(tapeBlock);
    const commandForZero = state.getCommand(appropriateSymbol);
    const nextState = state.getNextState(appropriateSymbol);

    expect(nextState.ref)
      .toBe(state2);
    expect(commandForZero.tapesCommands[0].movement)
      .toBe(movements.stay);
    expect(commandForZero.tapesCommands[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol empty object', () => {
    const state = new State({
      [symbol(alphabet.symbols[0])]: {},
    });

    expect(state)
      .toBeTruthy();

    const appropriateSymbol = state.getSymbol(tapeBlock);
    const commandForBlankSymbol = state.getCommand(appropriateSymbol);
    const nextState = state.getNextState(appropriateSymbol);

    expect(nextState.ref)
      .toBe(state);
    expect(commandForBlankSymbol.tapesCommands[0].movement)
      .toBe(movements.stay);
    expect(commandForBlankSymbol.tapesCommands[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol unbound reference', () => {
    const state = new State({
      [symbol(alphabet.symbols[0])]: {
        nextState: new Reference(),
      },
    });

    expect(state)
      .toBeTruthy();

    const appropriateSymbol = state.getSymbol(tapeBlock);
    const commandForBlankSymbol = state.getCommand(appropriateSymbol);
    const nextState = state.getNextState(appropriateSymbol);

    expect(() => nextState.ref)
      .toThrow('unbounded reference');
    expect(commandForBlankSymbol.tapesCommands[0].movement)
      .toBe(movements.stay);
    expect(commandForBlankSymbol.tapesCommands[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol bound reference', () => {
    const ref = new Reference();
    const state = new State({
      [symbol(alphabet.symbols[0])]: {
        nextState: ref,
      },
    });
    const state2 = new State({
      [ifOtherSymbol]: {},
    });
    ref.bind(state2);

    expect(state)
      .toBeTruthy();
    expect(state2)
      .toBeTruthy();

    const appropriateSymbol = state.getSymbol(tapeBlock);
    const commandForBlankSymbol = state.getCommand(appropriateSymbol);
    const nextState = state.getNextState(appropriateSymbol);

    expect(nextState.ref)
      .toBe(state2);
    expect(commandForBlankSymbol.tapesCommands[0].movement)
      .toBe(movements.stay);
    expect(commandForBlankSymbol.tapesCommands[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('invalid symbol: zero length', () => {
    expect(() => new State({}))
      .toThrow('invalid state definition');
  });
});

describe('properties', () => {
  test('has id', () => {
    expect(new State().id).toBeDefined();
  });
});

describe('methods', () => {
  test('getSymbol exists', () => {
    expect(new State().getSymbol)
      .toBeTruthy();
  });

  test('getCommand exists', () => {
    expect(new State().getCommand)
      .toBeTruthy();
  });

  test('getCommand: no command for the symbol', () => {
    expect(() => new State().getCommand(ifOtherSymbol))
      .toThrow(/^No command for symbol at state named/);
  });

  test('getNextState exists', () => {
    expect(new State().getNextState)
      .toBeTruthy();
  });

  test('getNextState: no nextState for the symbol', () => {
    expect(() => new State().getNextState(ifOtherSymbol))
      .toThrow(/^No nextState for symbol at state named/);
  });

  test('withOverrodeHaltState', () => {
    const state = new State();
    const state2 = state.withOverrodeHaltState(haltState);

    expect(state2.name).toBe(`${state.name}>${haltState.name}`);
  });
});

describe('State constructor — invalid inputs', () => {
  const alphabet = new Alphabet(' 01'.split(''));
  const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
  const {symbol} = tapeBlock;

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
    // command: [] is an Array, so the constructor takes the `try { new Command([]) }`
    // branch. Command rejects empty input with "invalid parameter"; the catch
    // swallows it (exercises the `void error` line), commandLocal remains
    // the plain [], fails the `instanceof Command` check, and throws.
    expect(() => new State({
      [symbol(['0'])]: {command: [] as never, nextState: haltState},
    })).toThrow('invalid command');
  });
});

describe('State.getSymbol — fallback', () => {
  const alphabet = new Alphabet(' 01'.split(''));
  const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
  const {symbol} = tapeBlock;

  test('returns ifOtherSymbol when no specific transition matches the head', () => {
    // State has only a transition for '1'. Tape head is on the blank ' '.
    // No specific symbol in the map matches → fallback to ifOtherSymbol.
    const state = new State({
      [symbol(['1'])]: {nextState: haltState},
    });

    // Tape default position 0, default symbols → blank ' '. The state's only
    // key is the symbol(['1']) pattern which does NOT match a blank head.
    expect(state.getSymbol(tapeBlock)).toBe(ifOtherSymbol);
  });
});

describe('State.toGraph — unbound Reference', () => {
  const alphabet = new Alphabet(' 01'.split(''));
  const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
  const {symbol} = tapeBlock;

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
    // detection in fromGraph, hand-build a Graph with overrodeHaltStateId
    // pointing in a loop.
    // Nodes need at least one transition each — State construction at pass 2
    // rejects empty stateDefinitions before pass 3's cycle check would run.
    const dummyTransition = {pattern: '*', command: [{symbol: '·', movement: 'S'}], nextStateId: 0};
    const graph = {
      initialId: 1,
      alphabets: [[' ', '0', '1']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {id: 1, name: 'a', isHalt: false, transitions: [dummyTransition], overrodeHaltStateId: 2},
        2: {id: 2, name: 'b', isHalt: false, transitions: [dummyTransition], overrodeHaltStateId: 1},
      },
    };

    expect(() => State.fromGraph(graph)).toThrow(/^override-halt cycle at state #/);
  });
});
