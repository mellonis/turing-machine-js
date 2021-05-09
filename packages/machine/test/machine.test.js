import TuringMachine, {
  Alphabet,
  State,
  Tape,
  TapeBlock,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet({
  symbolList: ' ABC'.split(''),
});

describe('constructor', () => {
  test('invalid TapeBlock', () => {
    expect(() => new TuringMachine({ tapeBlock: null }))
      .toThrowError();
  });
});

describe('run tests', () => {
  let tape;
  let machine;
  let initialState;
  let expectedStepList;

  beforeEach(() => {
    const symbolList = alphabet.symbolList.slice(1, alphabet.symbolList.length);
    tape = new Tape({
      alphabet,
      symbolList,
    });
    const tapeBlock = new TapeBlock({
      tapeList: [tape],
    });
    machine = new TuringMachine({
      tapeBlock,
    });
    const { symbol } = tapeBlock;
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
    expectedStepList = [
      {
        step: 1,
        state: initialState,
        currentSymbolList: [alphabet.symbolList[1]],
        nextSymbolList: [alphabet.blankSymbol],
        movementList: [movements.right],
        nextState: initialState,
      },
      {
        step: 2,
        state: initialState,
        currentSymbolList: [alphabet.symbolList[2]],
        nextSymbolList: [alphabet.blankSymbol],
        movementList: [movements.right],
        nextState: initialState,
      },
      {
        step: 3,
        state: initialState,
        currentSymbolList: [alphabet.symbolList[3]],
        nextSymbolList: [alphabet.blankSymbol],
        movementList: [movements.right],
        nextState: initialState,
      },
      {
        step: 4,
        state: initialState,
        currentSymbolList: [alphabet.blankSymbol],
        nextSymbolList: [alphabet.blankSymbol],
        movementList: [movements.stay],
        nextState: haltState,
      },
    ];
  });

  test('run', () => {
    const stepList = [];

    machine.run({ initialState, stepsLimit: 1e5, onStep: (step) => stepList.push(step) });

    expect(stepList)
      .toEqual(expectedStepList);
    expect(tape.symbolList.join('').trim().length)
      .toBe(0);
  });

  test('stepsLimit', () => {
    const onStepsLimit0Mock = jest.fn();

    expect(() => machine.run({ initialState, stepsLimit: 0, onStep: () => onStepsLimit0Mock() })).toThrowError('Long execution');
    expect(onStepsLimit0Mock.mock.calls.length).toEqual(0);

    const onStepsLimit1Mock = jest.fn();

    expect(() => machine.run({ initialState, stepsLimit: 1, onStep: () => onStepsLimit1Mock() })).toThrowError('Long execution');
    expect(onStepsLimit1Mock.mock.calls.length).toEqual(1);

    const onStepsLimit2Mock = jest.fn();

    expect(() => machine.run({ initialState, stepsLimit: 2, onStep: () => onStepsLimit2Mock() })).toThrowError('Long execution');
    expect(onStepsLimit2Mock.mock.calls.length).toEqual(2);
  });

  test('stepByStep', () => {
    const iterator = machine.runStepByStep({ initialState, stepsLimit: 1e5 });

    // eslint-disable-next-line no-restricted-syntax
    for (const step of iterator) {
      const expectedStep = expectedStepList.find((_) => _.step === step.step);

      expect(step)
        .toEqual(expectedStep);
    }

    expect(tape.symbolList.join('').trim().length)
      .toBe(0);
  });

  test('stepByStep stop execution', () => {
    const iterator = machine.runStepByStep({ initialState, stepsLimit: 1e5 });

    expect(() => {
      iterator.next();
      iterator.throw(new Error('STOP'));
    }).toThrowError('Execution halted because of STOP');
  });
});

describe('properties', () => {
  test('tapeBlock exists', () => {
    const tapeBlock = new TapeBlock({
      alphabetList: [alphabet],
    });
    const machine = new TuringMachine({
      tapeBlock,
    });

    expect(machine.tapeBlock)
      .toBeDefined();

    expect(machine.tapeBlock instanceof TapeBlock)
      .toBe(true);

    expect(machine.tapeBlock)
      .toBe(tapeBlock);
  });
});
