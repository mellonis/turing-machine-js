import {
  Reference,
  State,
  ifOtherSymbol,
  movements,
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

    expect(commandForZero.nextState.ref)
      .toBeUndefined();
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

    expect(commandForZero.nextState.ref)
      .toBeUndefined();
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
});
