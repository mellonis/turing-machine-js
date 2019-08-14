import binaryNumbers from '@turing-machine-js/library-binary-numbers';
import TuringMachine, { State, Tape, TapeBlock } from '@turing-machine-js/machine';

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
  test('has a correct tapeBlock', () => {
    expect(binaryNumbers.tapeBlock instanceof TapeBlock)
      .toBe(true);

    const { alphabet } = binaryNumbers.tapeBlock.tapeList[0];

    expect(alphabet.symbolList.length)
      .toBe(alphabetSymbols.length);
    expect(alphabetSymbols.split('').every(symbol => alphabet.has(symbol)))
      .toBe(true);
  });

  test('has all declared states', () => {
    expect(stateNameList.every(stateName => binaryNumbers.states[stateName] instanceof State))
      .toBe(true);
  });
});

describe('goToNumber algo', () => {
  const machine = new TuringMachine({
    tapeBlock: binaryNumbers.tapeBlock,
  });
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
      alphabet: binaryNumbers.tapeBlock.tapeList[0].alphabet,
      symbolList: tapeInitialState.split(''),
    });

    test(`tapeInitialState = [${tapeInitialState}]`, () => {
      binaryNumbers.tapeBlock.replaceTape(tape);

      expect(() => machine.run(binaryNumbers.states.goToNumber))
        .not
        .toThrowError();

      expect(tape.symbol)
        .toBe('$');
    });
  });
});

describe('goToNumbersStart algo', () => {
  const machine = new TuringMachine({
    tapeBlock: binaryNumbers.tapeBlock,
  });
  const tapeInitialStateList = [
    '^$',
    '^1$',
    '^0$',
    '^11$',
    '^00$',
  ];

  tapeInitialStateList.forEach((tapeInitialState) => {
    const tape = new Tape({
      alphabet: binaryNumbers.tapeBlock.tapeList[0].alphabet,
      symbolList: tapeInitialState.split(''),
      position: tapeInitialState.length - 1,
    });

    test(`tapeInitialState = [${tapeInitialState}]`, () => {
      binaryNumbers.tapeBlock.replaceTape(tape);

      expect(() => machine.run(binaryNumbers.states.goToNumbersStart))
        .not
        .toThrowError();

      expect(tape.symbol)
        .toBe('^');
    });
  });
});

describe('deleteNumber algo', () => {
  const machine = new TuringMachine({
    tapeBlock: binaryNumbers.tapeBlock,
  });
  const tapeInitialStateList = [
    '^$',
    '^1$',
    '^0$',
    '^11$',
    '^00$',
  ];

  tapeInitialStateList.forEach((tapeInitialState) => {
    const tape = new Tape({
      alphabet: binaryNumbers.tapeBlock.tapeList[0].alphabet,
      symbolList: tapeInitialState.split(''),
    });

    test(`tapeInitialState = [${tapeInitialState}]`, () => {
      binaryNumbers.tapeBlock.replaceTape(tape);

      expect(() => machine.run(binaryNumbers.states.deleteNumber))
        .not
        .toThrowError();

      expect(tape.symbol)
        .toBe(tape.alphabet.blankSymbol);
    });
  });
});

describe('normalizeNumber algo', () => {
  const machine = new TuringMachine({
    tapeBlock: binaryNumbers.tapeBlock,
  });
  const tapeInitialStateList = [
    ['^$', '^$'],
    ['^1$', '^1$'],
    ['^01$', '^1$'],
    ['^101$', '^101$'],
    ['^0101$', '^101$'],
  ];

  tapeInitialStateList.forEach(([startState, endState]) => {
    const tape = new Tape({
      alphabet: binaryNumbers.tapeBlock.tapeList[0].alphabet,
      symbolList: startState.split(''),
    });

    test(`tapeInitialState = [${startState}]`, () => {
      binaryNumbers.tapeBlock.replaceTape(tape);

      expect(() => machine.run(binaryNumbers.states.normalizeNumber))
        .not
        .toThrowError();

      expect(tape.symbolList.join('').trim())
        .toBe(endState);
    });
  });
});

describe('invertNumber algo', () => {
  const machine = new TuringMachine({
    tapeBlock: binaryNumbers.tapeBlock,
  });
  const tapeInitialStateList = [
    ['^$', '^$'],
    ['^1$', '^0$'],
    ['^11$', '^00$'],
    ['^101$', '^010$'],
  ];

  tapeInitialStateList.forEach((stateList) => {
    const tapeList = stateList.map(state => new Tape({
      alphabet: binaryNumbers.tapeBlock.tapeList[0].alphabet,
      symbolList: state.split(''),
    }));

    stateList.forEach((_, ix) => {
      test(`tapeInitialState = [${stateList[ix]}]`, () => {
        binaryNumbers.tapeBlock.replaceTape(tapeList[ix]);

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
