import {
  haltState,
  ifOtherSymbol,
  movements,
  Reference,
  State,
  symbolCommands,
} from '@turing-machine-js/machine';

describe('State constructor', () => {
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

    const commandForZero = state.getCommand('\0');

    expect(commandForZero.nextState.ref)
      .toBe(state);
    expect(commandForZero.movement)
      .toBe(movements.stay);
    expect(commandForZero.symbol)
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

    const commandForZero = state.getCommand('\0');

    expect(() => commandForZero.nextState.ref)
      .toThrowError('unbounded reference');
    expect(commandForZero.movement)
      .toBe(movements.stay);
    expect(commandForZero.symbol)
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

    expect(state)
      .toBeTruthy();
    expect(state2)
      .toBeTruthy();

    const commandForZero = state.getCommand('\0');

    ref.bind(state2);

    expect(commandForZero.nextState.ref)
      .toBe(state2);
    expect(commandForZero.movement)
      .toBe(movements.stay);
    expect(commandForZero.symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol empty object', () => {
    const symbol = 'A';
    const state = new State({
      [symbol]: {},
    });

    expect(state)
      .toBeTruthy();

    const commandForZero = state.getCommand(symbol);

    expect(commandForZero.nextState.ref)
      .toBe(state);
    expect(commandForZero.movement)
      .toBe(movements.stay);
    expect(commandForZero.symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol unbound reference', () => {
    const symbol = 'A';
    const state = new State({
      [symbol]: {
        nextState: new Reference(),
      },
    });

    expect(state)
      .toBeTruthy();

    const commandForZero = state.getCommand(symbol);

    expect(() => commandForZero.nextState.ref)
      .toThrowError('unbounded reference');
    expect(commandForZero.movement)
      .toBe(movements.stay);
    expect(commandForZero.symbol)
      .toBe(symbolCommands.keep);
  });

  test('some symbol bound reference', () => {
    const symbol = 'A';
    const ref = new Reference();
    const state = new State({
      [symbol]: {
        nextState: ref,
      },
    });
    const state2 = new State({
      [symbol]: {},
    });

    expect(state)
      .toBeTruthy();
    expect(state2)
      .toBeTruthy();

    const commandForZero = state.getCommand(symbol);

    ref.bind(state2);

    expect(commandForZero.nextState.ref)
      .toBe(state2);
    expect(commandForZero.movement)
      .toBe(movements.stay);
    expect(commandForZero.symbol)
      .toBe(symbolCommands.keep);
  });

  test('invalid symbol: zero length', () => {
    expect(() => new State({
      '': {},
    })).toThrowError('Invalid state definition');
  });

  test('invalid symbol: duplication in one key', () => {
    expect(() => new State({
      aa: {},
    })).toThrowError('Invalid state definition');
  });

  test('invalid symbol: duplication in different keys', () => {
    expect(() => new State({
      ab: {},
      ba: {},
    })).toThrowError('Invalid state definition');
  });

  test('invalid nextStep for ifOtherSymbol', () => {
    expect(() => new State({
      a: {
        nextState: '',
      },
    })).toThrowError('Invalid nextState');
  });

  test('invalid nextStep for ifOtherSymbol', () => {
    expect(() => new State({
      [ifOtherSymbol]: {
        nextState: '',
      },
    })).toThrowError('Invalid nextState');
  });
});

describe('properties', () => {
  test('has id', () => {
    expect(new State().id).toBeDefined();
  });
});
describe('methods', () => {
  test('getCommand: invalid symbol', () => {
    expect(() => new State().getCommand('')).toThrowError('Invalid symbol');
    expect(() => new State().getCommand('AA')).toThrowError('Invalid symbol');
  });

  test('getCommand: no command for the symbol', () => {
    expect(() => new State().getCommand(' ')).toThrowError(/^No command for symbol '.' at state named/);
    expect(() => new State({}).getCommand(' ')).toThrowError(/^No command for symbol '.' at state named/);
  });

  test('withOverrodeHaltState', () => {
    const state = new State();
    const state2 = state.withOverrodeHaltState(haltState);

    expect(state2.id).toBe(`${state.id}>${haltState.id}`);
  });
});
