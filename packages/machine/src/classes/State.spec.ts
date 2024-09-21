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
