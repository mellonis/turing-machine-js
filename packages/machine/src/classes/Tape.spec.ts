import Alphabet from './Alphabet';
import Tape from './Tape';

describe('Tape constructor', () => {
  test('starts with the blank symbol when no symbols are provided', () => {
    const alphabet = new Alphabet(['0', '1']);
    const tape = new Tape({alphabet});

    expect(tape.symbol).toBe(alphabet.blankSymbol);
  });

  test('honors the position parameter', () => {
    const alphabet = new Alphabet(['0', '1']);
    const tape = new Tape({alphabet, position: 42});

    expect(tape.position).toBe(42);
  });

  test('copy constructor preserves symbol/position/viewport/alphabet', () => {
    const alphabet = new Alphabet(['0', '1']);
    const original = new Tape({alphabet});
    const copy = new Tape(original);

    expect(copy.symbol).toBe(original.symbol);
    expect(copy.position).toBe(original.position);
    expect(copy.symbols).toEqual(original.symbols);
    expect(copy.viewportWidth).toBe(original.viewportWidth);
    expect(copy.alphabet.symbols).toEqual(original.alphabet.symbols);
  });

  test('throws when symbols contains a non-alphabet character', () => {
    const alphabet = new Alphabet(['0', '1']);

    expect(() => new Tape({
      alphabet,
      symbols: ['a'],
    })).toThrow('symbolList contains invalid symbol');
  });

  describe('viewportWidth (constructor)', () => {
    const alphabet = new Alphabet(['0', '1']);

    test('default is 1 — single-cell viewport', () => {
      const tape = new Tape({alphabet});

      expect(tape.viewportWidth).toBe(1);
      expect(tape.viewport).toHaveLength(1);
    });

    test('explicit odd value is honored', () => {
      const tape = new Tape({alphabet, viewportWidth: 5});

      expect(tape.viewportWidth).toBe(5);
      expect(tape.viewport).toHaveLength(5);
    });

    test('even value is bumped to next odd', () => {
      const tape = new Tape({alphabet, viewportWidth: 4});

      expect(tape.viewportWidth).toBe(5);
      expect(tape.viewport).toHaveLength(5);
    });

    test('throws on 0', () => {
      expect(() => new Tape({alphabet, viewportWidth: 0}))
        .toThrow('Invalid viewportWidth');
    });

    test('throws on negative', () => {
      expect(() => new Tape({alphabet, viewportWidth: -1}))
        .toThrow('Invalid viewportWidth');
    });

    test('normalises and pads symbols (issue #95)', () => {
      const a = new Alphabet(['␣', 'a', 'b']);
      const tape = new Tape({
        alphabet: a,
        symbols: ['a', 'b', 'a', 'b'],
        position: 0,
        viewportWidth: 23,
      });

      expect(tape.viewportWidth).toBe(23);
      expect(tape.viewport).toHaveLength(23);
    });
  });
});

describe('Tape.symbol setter', () => {
  let tape: Tape;

  beforeEach(() => {
    const alphabet = new Alphabet('012345'.split(''));
    tape = new Tape({alphabet});
  });

  test('writes a valid alphabet symbol to the head cell', () => {
    tape.alphabet.symbols.forEach((symbol) => {
      tape.symbol = symbol;
      expect(tape.symbol).toBe(symbol);
    });
  });

  test('throws on a symbol outside the alphabet', () => {
    expect(() => {
      tape.symbol = '\0';
    }).toThrow('Invalid symbol');
  });
});

describe('Tape.left / .right movement', () => {
  let tape: Tape;

  beforeEach(() => {
    const alphabet = new Alphabet('012345'.split(''));
    tape = new Tape({alphabet});
  });

  test('left() lands on a blank cell when moving past the start', () => {
    tape.symbol = tape.alphabet.get(1);
    tape.left();

    expect(tape.symbol).toBe(tape.alphabet.blankSymbol);
  });

  test('right() lands on a blank cell when moving past the end', () => {
    tape.symbol = tape.alphabet.get(1);
    tape.right();

    expect(tape.symbol).toBe(tape.alphabet.blankSymbol);
  });

  test('symbols sequence reads left-to-right after a series of right() moves', () => {
    const alphabetSymbols = tape.alphabet.symbols;

    alphabetSymbols.forEach((symbol, ix) => {
      tape.symbol = symbol;
      if (ix < alphabetSymbols.length - 1) tape.right();
    });

    expect(tape.symbols).toEqual(alphabetSymbols);
  });

  test('symbols sequence reads right-to-left after a series of left() moves', () => {
    const alphabetSymbols = tape.alphabet.symbols;

    alphabetSymbols.forEach((symbol, ix) => {
      tape.symbol = symbol;
      if (ix < alphabetSymbols.length - 1) tape.left();
    });

    expect(tape.symbols).toEqual(alphabetSymbols.slice().reverse());
  });

  test('repeated left() preserves all written symbols and pads blanks (#94)', () => {
    const alphabet = new Alphabet(['␣', 'x']);
    const ttape = new Tape({alphabet, symbols: ['x']});

    for (let i = 0; i < 1000; i += 1) ttape.left();

    expect(ttape.symbols).toHaveLength(1001);
    expect(ttape.symbols[1000]).toBe('x');
    expect(ttape.position).toBe(0);
    expect(ttape.symbol).toBe('␣');
  });
});

describe('Tape.viewportWidth (setter)', () => {
  // Mega-test split into focused per-behavior tests.
  let tape: Tape;

  beforeEach(() => {
    const alphabet = new Alphabet('012345'.split(''));
    tape = new Tape({alphabet});
  });

  test('default is 1 (matches the constructor default)', () => {
    expect(tape.viewportWidth).toBe(1);
  });

  test('throws on 0', () => {
    expect(() => {
      tape.viewportWidth = 0;
    }).toThrow('Invalid viewportWidth');
  });

  test('throws on negative', () => {
    expect(() => {
      tape.viewportWidth = -1;
    }).toThrow('Invalid viewportWidth');
  });

  test('odd value is stored verbatim', () => {
    tape.viewportWidth = 1;
    expect(tape.viewportWidth).toBe(1);
    expect(tape.viewport).toHaveLength(1);
  });

  test('even value is bumped to next odd', () => {
    tape.viewportWidth = 2;
    expect(tape.viewportWidth).toBe(3);
    expect(tape.viewport).toHaveLength(3);
  });

  test('viewport length tracks viewportWidth, not the underlying symbols length', () => {
    // After moving the head leftward enough times, symbols grows past the
    // viewport — viewport.length should still equal viewportWidth, NOT
    // symbols.length.
    tape.viewportWidth = 3;
    tape.left();
    tape.left();

    expect(tape.viewport).toHaveLength(3);
    expect(tape.viewport.length).not.toBe(tape.symbols.length);
  });
});
