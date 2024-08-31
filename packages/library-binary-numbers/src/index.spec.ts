import {State, Tape, TapeBlock, TuringMachine,} from '@turing-machine-js/machine/src';
import binaryNumbers from './index';

const alphabetSymbols = ' ^$01';
const stateNames: (keyof typeof binaryNumbers['states'])[] = [
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
  test('has getTapeBlock', () => {
    expect(binaryNumbers.getTapeBlock)
      .toBeTruthy();

    expect(binaryNumbers.getTapeBlock() instanceof TapeBlock)
      .toBe(true);

    const {alphabet} = binaryNumbers.getTapeBlock().tapes[0];

    expect(alphabet.symbols.length)
      .toBe(alphabetSymbols.length);
    expect(alphabetSymbols.split('').every((symbol) => alphabet.has(symbol)))
      .toBe(true);
  });

  test('has all declared states', () => {
    expect(stateNames.every((stateName) => binaryNumbers.states[stateName] instanceof State))
      .toBe(true);
  });
});

describe('goToNumber algo', () => {
  const tapeBlock = binaryNumbers.getTapeBlock();
  const machine = new TuringMachine({
    tapeBlock,
  });
  const tapesSymbols = [
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

  tapesSymbols.forEach((tapeSymbols) => {
    const tape = new Tape({
      alphabet: tapeBlock.tapes[0].alphabet,
      symbols: tapeSymbols.split(''),
    });

    test(`tapeInitialState = [${tapeSymbols}]`, () => {
      tapeBlock.replaceTape(tape);

      expect(() => machine.run({
        initialState: binaryNumbers.states.goToNumber,
      }))
        .not
        .toThrow();

      expect(tape.symbol)
        .toBe('$');
    });
  });
});

describe('goToNumbersStart algo', () => {
  const tapeBlock = binaryNumbers.getTapeBlock();
  const machine = new TuringMachine({
    tapeBlock,
  });
  const tapesSymbols = [
    '^$',
    '^1$',
    '^0$',
    '^11$',
    '^00$',
  ];

  tapesSymbols.forEach((tapeSymbols) => {
    const tape = new Tape({
      alphabet: tapeBlock.tapes[0].alphabet,
      symbols: tapeSymbols.split(''),
      position: tapeSymbols.length - 1,
    });

    test(`tapeInitialState = [${tapeSymbols}]`, () => {
      tapeBlock.replaceTape(tape);

      expect(() => machine.run({
        initialState: binaryNumbers.states.goToNumbersStart,
      }))
        .not
        .toThrow();

      expect(tape.symbol)
        .toBe('^');
    });
  });
});

describe('deleteNumber algo', () => {
  const tapeBlock = binaryNumbers.getTapeBlock();
  const machine = new TuringMachine({
    tapeBlock,
  });
  const tapesSymbols = [
    '^$',
    '^1$',
    '^0$',
    '^11$',
    '^00$',
  ];

  tapesSymbols.forEach((tapeSymbols) => {
    const tape = new Tape({
      alphabet: tapeBlock.tapes[0].alphabet,
      symbols: tapeSymbols.split(''),
    });

    test(`tapeInitialState = [${tapeSymbols}]`, () => {
      tapeBlock.replaceTape(tape);

      expect(() => machine.run({
        initialState: binaryNumbers.states.deleteNumber,
      }))
        .not
        .toThrow();

      expect(tape.symbol)
        .toBe(tape.alphabet.blankSymbol);
    });
  });
});

describe('normalizeNumber algo', () => {
  const tapeBlock = binaryNumbers.getTapeBlock();
  const machine = new TuringMachine({
    tapeBlock,
  });
  const tapeStartSymbolsAndEndSymbolsPairs = [
    ['^$', '^$'],
    ['^1$', '^1$'],
    ['^01$', '^1$'],
    ['^101$', '^101$'],
    ['^0101$', '^101$'],
  ];

  tapeStartSymbolsAndEndSymbolsPairs.forEach(([startState, endState]) => {
    const tape = new Tape({
      alphabet: tapeBlock.tapes[0].alphabet,
      symbols: startState.split(''),
    });

    test(`tapeInitialState = [${startState}]`, () => {
      tapeBlock.replaceTape(tape);

      expect(() => machine.run({
        initialState: binaryNumbers.states.normalizeNumber,
      }))
        .not
        .toThrow();

      expect(tape.symbols.join('').trim())
        .toBe(endState);
    });
  });
});

describe('invertNumber algo', () => {
  const tapeBlock = binaryNumbers.getTapeBlock();
  const machine = new TuringMachine({
    tapeBlock,
  });
  const tapesSymbols = ['^$', '^$', '^1$', '^0$', '^11$', '^00$', '^101$', '^010$'];

  tapesSymbols.forEach((tapeSymbols, ix, tapesSymbols) => {
    const tape = new Tape({
      alphabet: tapeBlock.tapes[0].alphabet,
      symbols: tapeSymbols.split(''),
    });

    test(`tapeInitialState = [${tapeSymbols}]`, () => {
      tapeBlock.replaceTape(tape);

      expect(() => machine.run({
        initialState: binaryNumbers.states.invertNumber,
      }))
        .not
        .toThrow();

      expect(tape.symbols.join(''))
        .toBe(tapesSymbols[ix % 2 === 0 ? ix + 1 : ix - 1]);
    });
  });
});

describe('plusOne algo', () => {
  const tapeBlock = binaryNumbers.getTapeBlock();
  const machine = new TuringMachine({
    tapeBlock,
  });
  const tapeStartSymbolsAndEndSymbolsPairs = [
    ['^$', '^1$'],
    ['^1$', '^10$'],
    ['^10$', '^11$'],
    ['^101$', '^110$'],
    ['^110$', '^111$'],
    ['^111$', '^1000$'],
  ];

  tapeStartSymbolsAndEndSymbolsPairs.forEach(([startSymbols, endSymbols]) => {
    const tape = new Tape({
      alphabet: tapeBlock.tapes[0].alphabet,
      symbols: startSymbols.split(''),
    });

    test(`tapeInitialState = [${startSymbols}]`, () => {
      tapeBlock.replaceTape(tape);

      expect(() => machine.run({
        initialState: binaryNumbers.states.plusOne,
      }))
        .not
        .toThrow();

      expect(tape.symbols.join('').trim())
        .toBe(endSymbols);
    });
  });
});

describe('minusOne algo', () => {
  const tapeBlock = binaryNumbers.getTapeBlock();
  const machine = new TuringMachine({
    tapeBlock,
  });
  const tapeEndSymbolsAndStartSymbolsPairs = [
    ['^$', '^1$'],
    ['^1$', '^10$'],
    ['^10$', '^11$'],
    ['^101$', '^110$'],
    ['^110$', '^111$'],
    ['^111$', '^1000$'],
  ];

  tapeEndSymbolsAndStartSymbolsPairs.forEach(([endSymbols, startSymbols]) => {
    const tape = new Tape({
      alphabet: tapeBlock.tapes[0].alphabet,
      symbols: startSymbols.split(''),
    });

    test(`tapeInitialState = [${startSymbols}]`, () => {
      tapeBlock.replaceTape(tape);

      expect(() => machine.run({
        initialState: binaryNumbers.states.minusOne,
      }))
        .not
        .toThrow();

      expect(tape.symbols.join('').trim())
        .toBe(endSymbols);
    });
  });
});

describe('todo tests', () => {
  const toDos = [
    'goToNextNumber',
    'goToPreviousNumber',
  ];

  toDos
    .forEach((stateName) => test.todo(`test ${stateName} algo`));
});
