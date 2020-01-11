import TuringMachine, {
  Alphabet,
  haltState,
  ifOtherSymbol,
  movements,
  State,
  symbolCommands,
  Tape,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet({
  symbolList: ' ABC'.split(''),
});

describe('run tests', () => {
  test('run', () => {
    const symbolList = alphabet.symbolList.slice(1, alphabet.symbolList.length);
    const tape = new Tape({
      alphabet,
      symbolList,
    });
    const machine = new TuringMachine(tape);
    const initialState = new State({
      [symbolList.join('')]: {
        symbol: symbolCommands.erase,
        movement: movements.right,
      },
      [ifOtherSymbol]: {
        nextState: haltState,
      },
    });
    const stepList = [];

    machine.run(initialState, 1e5, (step) => stepList.push(step));

    const expectedStepList = [
      {
        step: 1,
        state: initialState,
        currentSymbol: 'A',
        nextSymbol: ' ',
        nextMovement: movements.right,
        nextState: initialState,
      },
      {
        step: 2,
        state: initialState,
        currentSymbol: 'B',
        nextSymbol: ' ',
        nextMovement: movements.right,
        nextState: initialState,
      },
      {
        step: 3,
        state: initialState,
        currentSymbol: 'C',
        nextSymbol: ' ',
        nextMovement: movements.right,
        nextState: initialState,
      },
      {
        step: 4,
        state: initialState,
        currentSymbol: ' ',
        nextSymbol: ' ',
        nextMovement: movements.stay,
        nextState: haltState,
      },
    ];

    expect(stepList)
      .toEqual(expectedStepList);
    expect(tape.symbolList.join('').trim().length)
      .toBe(0);
  });

  test('stepLimit', () => {
    const symbolList = alphabet.symbolList.slice(1, alphabet.symbolList.length);
    const tape = new Tape({
      alphabet,
      symbolList,
    });
    const machine = new TuringMachine(tape);
    const initialState = new State({
      [symbolList.join('')]: {
        symbol: symbolCommands.erase,
        movement: movements.right,
      },
      [ifOtherSymbol]: {
        nextState: haltState,
      },
    });

    expect(() => machine.run(initialState, 1)).toThrowError('Long execution');
  });

  test('stepByStep', () => {
    const symbolList = alphabet.symbolList.slice(1, alphabet.symbolList.length);
    const tape = new Tape({
      alphabet,
      symbolList,
    });
    const machine = new TuringMachine(tape);
    const initialState = new State({
      [symbolList.join('')]: {
        symbol: symbolCommands.erase,
        movement: movements.right,
      },
      [ifOtherSymbol]: {
        nextState: haltState,
      },
    });

    const expectedStepList = [
      {
        step: 1,
        state: initialState,
        currentSymbol: 'A',
        nextSymbol: ' ',
        nextMovement: movements.right,
        nextState: initialState,
      },
      {
        step: 2,
        state: initialState,
        currentSymbol: 'B',
        nextSymbol: ' ',
        nextMovement: movements.right,
        nextState: initialState,
      },
      {
        step: 3,
        state: initialState,
        currentSymbol: 'C',
        nextSymbol: ' ',
        nextMovement: movements.right,
        nextState: initialState,
      },
      {
        step: 4,
        state: initialState,
        currentSymbol: ' ',
        nextSymbol: ' ',
        nextMovement: movements.stay,
        nextState: haltState,
      },
    ];

    const iterator = machine.runStepByStep(initialState, 1e5);

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
    const symbolList = alphabet.symbolList.slice(1, alphabet.symbolList.length);
    const tape = new Tape({
      alphabet,
      symbolList,
    });
    const machine = new TuringMachine(tape);
    const initialState = new State({
      [symbolList.join('')]: {
        symbol: symbolCommands.erase,
        movement: movements.right,
      },
      [ifOtherSymbol]: {
        nextState: haltState,
      },
    });
    const iterator = machine.runStepByStep(initialState, 1e5);

    expect(() => {
      iterator.next();
      iterator.throw(new Error('STOP'));
    }).toThrowError('Execution halted because of STOP');
  });
});
