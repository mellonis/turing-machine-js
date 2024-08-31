import Alphabet from './Alphabet';
import State, {haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {MachineState} from './TuringMachine';
import {movements, symbolCommands} from './TapeCommand';

const alphabet = new Alphabet(' ABC'.split(''));

describe('run tests', () => {
  let tape: Tape;
  let machine: TuringMachine;
  let initialState: State;
  let expectedSteps: MachineState[];

  beforeEach(() => {
    const symbolList = alphabet.symbols.slice(1, alphabet.symbols.length);

    tape = new Tape({
      alphabet,
      symbols: symbolList,
    });

    const tapeBlock = TapeBlock.fromTapes([tape]);

    machine = new TuringMachine({
      tapeBlock,
    });

    const {symbol} = tapeBlock;

    initialState = new State({
      [symbol(symbolList)]: {
        command: [
          {
            symbol: symbolCommands.erase,
            movement: movements.right,
          },
        ],
      },
      [ifOtherSymbol]: {
        nextState: haltState,
      },
    });

    expectedSteps = [
      {
        step: 1,
        state: initialState,
        currentSymbols: [alphabet.symbols[1]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
      },
      {
        step: 2,
        state: initialState,
        currentSymbols: [alphabet.symbols[2]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
      },
      {
        step: 3,
        state: initialState,
        currentSymbols: [alphabet.symbols[3]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
      },
      {
        step: 4,
        state: initialState,
        currentSymbols: [alphabet.blankSymbol],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.stay],
        nextState: haltState,
      },
    ];
  });

  test('run', () => {
    const steps: MachineState[] = [];

    machine.run({initialState, stepsLimit: 1e5, onStep: (step) => steps.push(step)});

    expect(steps)
      .toEqual(expectedSteps);
    expect(tape.symbols.join('').trim().length)
      .toBe(0);
  });

  test('stepsLimit', () => {
    const onStepsLimit0Mock = jest.fn();

    expect(() => machine.run({
      initialState,
      stepsLimit: 0,
      onStep: () => onStepsLimit0Mock()
    })).toThrow('Long execution');
    expect(onStepsLimit0Mock.mock.calls.length).toEqual(0);

    const onStepsLimit1Mock = jest.fn();

    expect(() => machine.run({
      initialState,
      stepsLimit: 1,
      onStep: () => onStepsLimit1Mock()
    })).toThrow('Long execution');
    expect(onStepsLimit1Mock.mock.calls.length).toEqual(1);

    const onStepsLimit2Mock = jest.fn();

    expect(() => machine.run({
      initialState,
      stepsLimit: 2,
      onStep: () => onStepsLimit2Mock()
    })).toThrow('Long execution');
    expect(onStepsLimit2Mock.mock.calls.length).toEqual(2);
  });

  test('stepByStep', () => {
    const iterator = machine.runStepByStep({initialState, stepsLimit: 1e5});


    for (const step of iterator) {
      const expectedStep = expectedSteps.find((_) => _.step === step.step);

      expect(step)
        .toEqual(expectedStep);
    }

    expect(tape.symbols.join('').trim().length)
      .toBe(0);
  });

  test('stepByStep stop execution', () => {
    const iterator = machine.runStepByStep({initialState, stepsLimit: 1e5});

    expect(() => {
      iterator.next();
      iterator.throw(haltState);
    }).toThrow('was stopped');
  });
});

describe('properties', () => {
  test('tapeBlock exists', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const machine = new TuringMachine({
      tapeBlock,
    });

    expect(machine.tapeBlock)
      .toBeDefined();

    expect(machine.tapeBlock)
      .toBe(tapeBlock);
  });
});
