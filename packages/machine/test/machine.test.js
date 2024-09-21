import TuringMachine, {
  Alphabet,
  haltState,
  ifOtherSymbol,
  movements,
  Reference,
  State,
  symbolCommands,
  Tape,
  TapeBlock,
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

    expect(() => machine.run({
      initialState,
      stepsLimit: 0,
      onStep: () => onStepsLimit0Mock(),
    })).toThrowError('Long execution');
    expect(onStepsLimit0Mock.mock.calls.length).toEqual(0);

    const onStepsLimit1Mock = jest.fn();

    expect(() => machine.run({
      initialState,
      stepsLimit: 1,
      onStep: () => onStepsLimit1Mock(),
    })).toThrowError('Long execution');
    expect(onStepsLimit1Mock.mock.calls.length).toEqual(1);

    const onStepsLimit2Mock = jest.fn();

    expect(() => machine.run({
      initialState,
      stepsLimit: 2,
      onStep: () => onStepsLimit2Mock(),
    })).toThrowError('Long execution');
    expect(onStepsLimit2Mock.mock.calls.length).toEqual(2);
  });

  test('stepByStep', () => {
    const generator = machine.runStepByStep({ initialState, stepsLimit: 1e5 });

    // eslint-disable-next-line no-restricted-syntax
    for (const step of generator) {
      const expectedStep = expectedStepList.find((_) => _.step === step.step);

      expect(step)
        .toEqual(expectedStep);
    }

    expect(tape.symbolList.join('').trim().length)
      .toBe(0);
  });

  test('stepByStep stop execution', () => {
    const generator = machine.runStepByStep({ initialState, stepsLimit: 1e5 });

    expect(() => {
      generator.next();
      generator.throw(new Error('STOP'));
    }).toThrowError('STOP');
  });

  test('stepByStep stop execution with haltState', () => {
    const generator = machine.runStepByStep({ initialState, stepsLimit: 1e5 });

    expect(() => {
      generator.next();
      generator.throw(haltState);
    }).not.toThrowError('STOP');
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

describe('parallel execution with same tape block', () => {
  let tapeBlock;
  let machineA;
  let machineB;

  beforeEach(() => {
    tapeBlock = new TapeBlock({ alphabetList: [alphabet] });
    machineA = new TuringMachine({ tapeBlock });
    machineB = new TuringMachine({ tapeBlock });
  });

  test('throw error on parallel execution start', () => {
    const reference = new Reference();
    const infiniteState = new State({
      [ifOtherSymbol]: {
        nextState: reference,
      },
    });

    reference.bind(infiniteState);

    const executionGeneratorA = machineA.runStepByStep({
      initialState: infiniteState,
    });
    const executionGeneratorB = machineB.runStepByStep({
      initialState: infiniteState,
    });

    expect(executionGeneratorA).not.toBe(executionGeneratorB);

    expect(() => executionGeneratorA.next()).not.toThrowError();
    expect(() => executionGeneratorA.next()).not.toThrowError();
    expect(() => executionGeneratorB.next()).toThrowError('Lock check failed');

    // stop A execution
    expect(() => executionGeneratorA.throw(haltState)).not.toThrowError();
    // execute B without errors
    expect(() => executionGeneratorB.next()).not.toThrowError();
  });

  test('do not throw on sequenced execution', () => {
    const oneStepState = new State({
      [ifOtherSymbol]: {
        nextState: haltState,
      },
    });

    const executionGeneratorA = machineA.runStepByStep({
      initialState: oneStepState,
    });
    const executionGeneratorB = machineB.runStepByStep({
      initialState: oneStepState,
    });

    expect(() => {
      while (!executionGeneratorA.next().done) ;
    }).not.toThrowError();
    expect(() => {
      while (!executionGeneratorB.next().done) ;
    }).not.toThrowError();
  });
});
