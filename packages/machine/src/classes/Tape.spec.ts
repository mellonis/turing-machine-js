import Alphabet from './Alphabet';
import Tape from './Tape';


describe('Tape constructor', () => {
  test('emptySymbol is current if symbolList is empty', () => {
    const alphabet = new Alphabet(['0', '1']);
    const tape = new Tape({alphabet});

    expect(tape.symbol === alphabet.blankSymbol)
      .toBeTruthy();
  });
  test('position', () => {
    const alphabet = new Alphabet(['0', '1']);
    const position = Math.floor(Math.random() * Math.floor(100)) + 1;
    const tape = new Tape({alphabet, position});

    expect(tape.position === position)
      .toBe(true);
  });
  test('copy tape', () => {
    const alphabet = new Alphabet(['0', '1']);
    const tape = new Tape({alphabet});
    const tapeCopy = new Tape(tape);

    expect(tape.symbol === tapeCopy.symbol)
      .toBe(true);
    expect(tape.viewportWidth)
      .toEqual(tapeCopy.viewportWidth);
    expect(tape.symbols)
      .toEqual(tapeCopy.symbols);
    expect(tape.alphabet)
      .toEqual(tapeCopy.alphabet);
    expect(tape.position)
      .toEqual(tapeCopy.position);
    expect(tape.viewportWidth)
      .toEqual(tapeCopy.viewportWidth);
  });

  test('invalid symbol', () => {
    expect(() => {
      const alphabet = new Alphabet(['0', '1']);


      new Tape({
        alphabet,
        symbols: ['a'],
      });
    })
      .toThrow('symbolList contains invalid symbol');
  });
});

describe('Tape properties', () => {
  let tape: Tape;

  beforeEach(() => {
    const alphabetSymbols = '012345';
    const alphabet = new Alphabet(alphabetSymbols.split(''));

    tape = new Tape({alphabet});
  });

  test('write symbol valid symbol', () => {
    tape.alphabet.symbols.forEach((symbol) => {
      tape.symbol = symbol;

      expect(tape.symbol === symbol)
        .toBe(true);
    });
  });

  test('write symbol invalid symbol', () => {
    expect(() => {
      tape.symbol = '\0';
    })
      .toThrow('Invalid symbol');
  });

  test('left blank', () => {
    tape.symbol = tape.alphabet.get(1);
    tape.left();

    expect(tape.symbol === tape.alphabet.blankSymbol)
      .toBe(true);
  });

  test('right blank', () => {
    tape.symbol = tape.alphabet.get(1);
    tape.right();

    expect(tape.symbol === tape.alphabet.blankSymbol)
      .toBe(true);
  });

  test('viewport / viewportWidth', () => {
    expect(tape.viewportWidth)
      .toEqual(1);
    expect(() => {
      tape.viewportWidth = 0;
    })
      .toThrow('Invalid viewportWidth');
    expect(() => {
      tape.viewportWidth = -1;
    })
      .toThrow('Invalid viewportWidth');
    expect(() => {
      tape.viewportWidth = 1;
    })
      .not.toThrow();
    expect(() => {
      tape.viewportWidth = 2;
    })
      .not.toThrow();
    tape.viewportWidth = 1;
    expect(tape.viewportWidth)
      .toBe(1);
    expect(tape.viewport.length)
      .toBe(1);
    tape.viewportWidth = 2;
    expect(tape.viewportWidth)
      .toBe(3);
    expect(tape.viewport.length)
      .toBe(3);

    tape.left();
    tape.left();

    expect(tape.viewport.length)
      .not.toEqual(tape.symbols.length);
  });

  test('symbolList right', () => {
    const alphabetSymbols = tape.alphabet.symbols;

    alphabetSymbols.forEach((symbol, ix) => {
      tape.symbol = symbol;
      if (ix < alphabetSymbols.length - 1) {
        tape.right();
      }
    });

    expect(tape.symbols)
      .toEqual(alphabetSymbols);
  });

  test('symbolList left', () => {
    const alphabetSymbols = tape.alphabet.symbols;

    alphabetSymbols.forEach((symbol, ix) => {
      tape.symbol = symbol;
      if (ix < alphabetSymbols.length - 1) {
        tape.left();
      }
    });

    expect(tape.symbols)
      .toEqual(alphabetSymbols.reverse());
  });
});
