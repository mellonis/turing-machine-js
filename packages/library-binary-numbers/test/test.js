import binaryNumbers from '@turing-machine-js/library-binary-numbers';
import TuringMachine, { Alphabet, State, Tape } from '@turing-machine-js/machine';

const alphabetSymbols = ' ^$01';
const stateNameList = [
  'goToNumber',
  'goToNextNumber',
  'goToPreviousNumber',
  'deleteNumber',
  'goToNumbersStart',
  'invertNumber',
  'normalizeNumber',
  'plusOne',
  'minusOne',
];

describe('general tests', () => {
  test('has a correct alphabet', () => {
    expect(binaryNumbers.alphabet instanceof Alphabet)
      .toBe(true);
    expect(binaryNumbers.alphabet.symbolList.length)
      .toBe(alphabetSymbols.length);
    expect(alphabetSymbols.split('').every(symbol => binaryNumbers.alphabet.has(symbol)))
      .toBe(true);
  });

  test('has all declared states', () => {
    expect(stateNameList.every(stateName => binaryNumbers.states[stateName] instanceof State))
      .toBe(true);
  });
});

describe('goToNumber algo', () => {
  const tapeInitialStateList = [
    '$',
    '1$',
    '0$',
    '^$',
    ' $',
    '11$',
    '00$',
    '^^$',
    '  $',
  ];

  tapeInitialStateList.forEach((tapeInitialState) => {
    const tape = new Tape({
      alphabet: binaryNumbers.alphabet,
      symbolList: tapeInitialState.split(''),
    });

    test(`tapeInitialState = [${tapeInitialState}]`, () => {
      const machine = new TuringMachine(tape);

      expect(() => machine.run(binaryNumbers.states.goToNumber))
        .not
        .toThrowError();

      expect(tape.symbol)
        .toBe('$');
    });
  });
});

describe('goToNumbersStart algo', () => {
  const tapeInitialStateList = [
    '^$',
    '^1$',
    '^0$',
    '^11$',
    '^00$',
  ];

  tapeInitialStateList.forEach((tapeInitialState) => {
    const tape = new Tape({
      alphabet: binaryNumbers.alphabet,
      symbolList: tapeInitialState.split(''),
      position: tapeInitialState.length - 1,
    });

    test(`tapeInitialState = [${tapeInitialState}]`, () => {
      const machine = new TuringMachine(tape);

      expect(() => machine.run(binaryNumbers.states.goToNumbersStart))
        .not
        .toThrowError();

      expect(tape.symbol)
        .toBe('^');
    });
  });
});

describe('deleteNumber algo', () => {
  const tapeInitialStateList = [
    '^$',
    '^1$',
    '^0$',
    '^11$',
    '^00$',
  ];

  tapeInitialStateList.forEach((tapeInitialState) => {
    const tape = new Tape({
      alphabet: binaryNumbers.alphabet,
      symbolList: tapeInitialState.split(''),
    });

    test(`tapeInitialState = [${tapeInitialState}]`, () => {
      const machine = new TuringMachine(tape);

      expect(() => machine.run(binaryNumbers.states.deleteNumber))
        .not
        .toThrowError();

      expect(tape.symbol)
        .toBe(tape.alphabet.blankSymbol);
    });
  });
});

describe('normalizeNumber algo', () => {
  const tapeInitialStateList = [
    ['^$', '^$'],
    ['^1$', '^1$'],
    ['^01$', '^1$'],
    ['^101$', '^101$'],
    ['^0101$', '^101$'],
  ];

  tapeInitialStateList.forEach(([startState, endState]) => {
    const tape = new Tape({
      alphabet: binaryNumbers.alphabet,
      symbolList: startState.split(''),
    });

    test(`tapeInitialState = [${startState}]`, () => {
      const machine = new TuringMachine(tape);

      expect(() => machine.run(binaryNumbers.states.normalizeNumber))
        .not
        .toThrowError();

      expect(tape.symbolList.join('').trim())
        .toBe(endState);
    });
  });
});

describe('invertNumber algo', () => {
  const tapeInitialStateList = [
    ['^$', '^$'],
    ['^1$', '^0$'],
    ['^11$', '^00$'],
    ['^101$', '^010$'],
  ];

  tapeInitialStateList.forEach((stateList) => {
    const tapeList = stateList.map(state => new Tape({
      alphabet: binaryNumbers.alphabet,
      symbolList: state.split(''),
    }));

    stateList.forEach((_, ix) => {
      test(`tapeInitialState = [${stateList[ix]}]`, () => {
        const machine = new TuringMachine(tapeList[ix]);

        expect(() => machine.run(binaryNumbers.states.invertNumber))
          .not
          .toThrowError();

        expect(tapeList[ix].symbolList.join(''))
          .toBe(stateList[(ix + 1) % 2]);
      });
    });
  });
});

describe('todo tests', () => {
  const toDoList = [
    'goToNextNumber',
    'goToPreviousNumber',
    'plusOne',
    'minusOne',
  ];

  toDoList
    .forEach(stateName => test.todo(`test ${stateName} algo`));
});
