import {
  Alphabet,
  Reference,
  State,
  TapeBlock,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
} from '@turing-machine-js/machine';

describe('State constructor', () => {
  const alphabet = new Alphabet({
    symbolList: ' 01'.split(''),
  });
  const tapeBlock = new TapeBlock({
    alphabetList: [alphabet],
  });
  const { symbol } = tapeBlock;

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
    expect(commandForZero.tapeCommandList[0].movement)
      .toBe(movements.stay);
    expect(commandForZero.tapeCommandList[0].symbol)
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

    expect(nextState.ref)
      .toBeUndefined();
    expect(commandForZero.tapeCommandList[0].movement)
      .toBe(movements.stay);
    expect(commandForZero.tapeCommandList[0].symbol)
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
    expect(commandForZero.tapeCommandList[0].movement)
      .toBe(movements.stay);
    expect(commandForZero.tapeCommandList[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol empty object', () => {
    const state = new State({
      [symbol(alphabet.symbolList[0])]: {},
    });

    expect(state)
      .toBeTruthy();

    const appropriateSymbol = state.getSymbol(tapeBlock);
    const commandForBlankSymbol = state.getCommand(appropriateSymbol);
    const nextState = state.getNextState(appropriateSymbol);

    expect(nextState.ref)
      .toBe(state);
    expect(commandForBlankSymbol.tapeCommandList[0].movement)
      .toBe(movements.stay);
    expect(commandForBlankSymbol.tapeCommandList[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol unbound reference', () => {
    const state = new State({
      [symbol(alphabet.symbolList[0])]: {
        nextState: new Reference(),
      },
    });

    expect(state)
      .toBeTruthy();

    const appropriateSymbol = state.getSymbol(tapeBlock);
    const commandForBlankSymbol = state.getCommand(appropriateSymbol);
    const nextState = state.getNextState(appropriateSymbol);

    expect(nextState.ref)
      .toBeUndefined();
    expect(commandForBlankSymbol.tapeCommandList[0].movement)
      .toBe(movements.stay);
    expect(commandForBlankSymbol.tapeCommandList[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol bound reference', () => {
    const ref = new Reference();
    const state = new State({
      [symbol(alphabet.symbolList[0])]: {
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
    expect(commandForBlankSymbol.tapeCommandList[0].movement)
      .toBe(movements.stay);
    expect(commandForBlankSymbol.tapeCommandList[0].symbol)
      .toBe(symbolCommands.keep);
  });

  test('invalid symbol: zero length', () => {
    expect(() => new State({}))
      .toThrowError('invalid state definition');
  });

  test('invalid nextStep for ifOtherSymbol', () => {
    expect(() => new State({
      [ifOtherSymbol]: {
        nextState: '',
      },
    }))
      .toThrowError('invalid nextState');
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

  test('getCommand: invalid symbol', () => {
    expect(() => new State().getCommand('AA'))
      .toThrowError(/^No command for symbol at state named/);
    expect(() => new State().getCommand(Symbol('some symbol')))
      .toThrowError(/^No command for symbol at state named/);
  });

  test('getCommand: no command for the symbol', () => {
    expect(() => new State().getCommand(ifOtherSymbol))
      .toThrowError(/^No command for symbol at state named/);
  });

  test('getNextState exists', () => {
    expect(new State().getNextState)
      .toBeTruthy();
  });

  test('getNextState: invalid symbol', () => {
    expect(() => new State().getNextState('AA'))
      .toThrowError(/^No nextState for symbol at state named/);
    expect(() => new State().getNextState(Symbol('some symbol')))
      .toThrowError(/^No nextState for symbol at state named/);
  });

  test('getNextState: no nextState for the symbol', () => {
    expect(() => new State().getNextState(ifOtherSymbol))
      .toThrowError(/^No nextState for symbol at state named/);
  });

  test('withOverrodeHaltState', () => {
    const state = new State();
    const state2 = state.withOverrodeHaltState(haltState);

    expect(state2.id).toBe(`${state.id}>${haltState.id}`);
  });
});
