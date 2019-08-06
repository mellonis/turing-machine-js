import TuringMachine, {
  Alphabet,
  Command,
  State,
  Tape,
  TapeBlock,
  TapeCommand,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet({
  symbolList: ' ABC'.split(''),
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

    machine.run(initialState, 1e5, step => stepList.push(step));

    expect(stepList)
      .toEqual(expectedStepList);
    expect(tape.symbolList.join('').trim().length)
      .toBe(0);
  });

  test('stepLimit', () => {
    expect(() => machine.run(initialState, 1)).toThrowError('Long execution');
  });

  test('stepByStep', () => {
    const iterator = machine.runStepByStep(initialState, 1e5);

    // eslint-disable-next-line no-restricted-syntax
    for (const step of iterator) {
      const expectedStep = expectedStepList.find(_ => _.step === step.step);

      expect(step)
        .toEqual(expectedStep);
    }

    expect(tape.symbolList.join('').trim().length)
      .toBe(0);
  });

  test('stepByStep stop execution', () => {
    const iterator = machine.runStepByStep(initialState, 1e5);

    expect(() => {
      iterator.next();
      iterator.throw(new Error('STOP'));
    }).toThrowError('Execution halted because of STOP');
  });
});
