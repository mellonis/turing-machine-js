import Alphabet from './Alphabet';
import Command from './Command';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TapeCommand, {movements, symbolCommands} from './TapeCommand';
import {ifOtherSymbol} from './State';

const alphabets = [
  new Alphabet(' 01'.split('')),
  new Alphabet(' ab'.split('')),
  new Alphabet(' аб'.split('')),
];

// Build a fresh tapeBlock + tapes per call. Several previous describes used
// `beforeAll` and let mutating tests share state — switching to per-test
// fixtures avoids any reordering / parallelism fragility.
function setupTapes() {
  const tapes = alphabets.map((alphabet) => new Tape({
    alphabet,
    symbols: alphabet.symbols,
  }));

  return {tapes, tapeBlock: TapeBlock.fromTapes(tapes)};
}

describe('TapeBlock construction', () => {
  test('fromAlphabets: throws on empty list', () => {
    expect(() => TapeBlock.fromAlphabets([])).toThrow('empty alphabet list');
  });

  test('fromTapes: throws on empty list', () => {
    expect(() => TapeBlock.fromTapes([])).toThrow('empty tape list');
  });

  test('fromAlphabets: creates a fresh blank Tape per alphabet', () => {
    const block = TapeBlock.fromAlphabets(alphabets);

    expect(block.tapes).toHaveLength(alphabets.length);
    block.tapes.forEach((tape, ix) => {
      // Tape's constructor wraps the alphabet, so content equality (not
      // reference) is the right check here.
      expect(tape.alphabet.symbols).toEqual(alphabets[ix].symbols);
      expect(tape.symbol).toBe(alphabets[ix].blankSymbol);
    });
  });
});

describe('TapeBlock.currentSymbols', () => {
  test('reflects the current head symbol on each tape and follows applyCommand', () => {
    const {tapes, tapeBlock} = setupTapes();
    const right = new TapeCommand({movement: movements.right});
    const left = new TapeCommand({movement: movements.left});
    const idle = new TapeCommand({});
    const allRight = new Command(tapes.map(() => right));

    expect(tapeBlock.currentSymbols)
      .toEqual(alphabets.map((a) => a.symbols[0]));

    tapeBlock.applyCommand(allRight);
    expect(tapeBlock.currentSymbols)
      .toEqual(alphabets.map((a) => a.symbols[1]));

    tapeBlock.applyCommand(allRight);
    expect(tapeBlock.currentSymbols)
      .toEqual(alphabets.map((a) => a.symbols[2]));

    // Tape wraps via blank padding — moving right past the last cell lands
    // on a blank, which is the alphabet's symbols[0].
    tapeBlock.applyCommand(allRight);
    expect(tapeBlock.currentSymbols)
      .toEqual(alphabets.map((a) => a.symbols[0]));

    // Per-tape mixed command: only the first tape moves left.
    tapeBlock.applyCommand(new Command([left, idle, idle]));
    expect(tapeBlock.currentSymbols).toEqual([
      alphabets[0].symbols[2],
      alphabets[1].symbols[0],
      alphabets[2].symbols[0],
    ]);
  });
});

describe('TapeBlock.alphabets', () => {
  test('returns the alphabet of each tape in order', () => {
    const {tapeBlock} = setupTapes();

    expect(tapeBlock.alphabets).toEqual(tapeBlock.tapes.map((tape) => tape.alphabet));
  });
});

describe('TapeBlock.symbol method', () => {
  const goodList = alphabets.map((a) => a.symbols[0]);
  const goodString = goodList.join('');

  function freshSymbol() {
    const tapes = alphabets.map((alphabet) => new Tape({alphabet}));
    const block = TapeBlock.fromTapes(tapes);
    return block.symbol;
  }

  test('accepts a string and an array of valid symbols', () => {
    const symbol = freshSymbol();

    expect(() => symbol(goodString)).not.toThrow();
    expect(() => symbol(goodList)).not.toThrow();
  });

  test('throws when input is neither a string, an array, nor ifOtherSymbol', () => {
    // The previous spec had a test named "throws an error if parameter is not
    // a string or an array" that asserted the OPPOSITE — that valid string/
    // array inputs don't throw. Audit caught the inverted assertion.
    //
    // Source: a non-string-non-array argument leaves localSymbols at length 0,
    // which falls through to the "invalid symbol parameter" throw.
    const symbol = freshSymbol();

    expect(() => symbol(42 as never)).toThrow('invalid symbol parameter');
    expect(() => symbol({} as never)).toThrow('invalid symbol parameter');
    expect(() => symbol(null as never)).toThrow('invalid symbol parameter');
    expect(() => symbol(undefined as never)).toThrow('invalid symbol parameter');
  });

  test('throws when input length is shorter than tapes count', () => {
    const symbol = freshSymbol();

    expect(() => symbol('')).toThrow('invalid symbol parameter');
    expect(() => symbol([])).toThrow('invalid symbol parameter');
    expect(() => symbol(alphabets[0].symbols[1])).toThrow('invalid symbol parameter');
    expect(() => symbol([alphabets[0].symbols[1]])).toThrow('invalid symbol parameter');
  });

  test('throws when input length is not divisible by tapes count', () => {
    const symbol = freshSymbol();

    expect(() => symbol(goodString + goodString[0])).toThrow('invalid symbol parameter');
    expect(() => symbol([...goodList, goodList[0]])).toThrow('invalid symbol parameter');

    // 2× / 3× the tapes count IS divisible — those should pass.
    expect(() => symbol(goodString + goodString)).not.toThrow();
    expect(() => symbol([...goodList, ...goodList])).not.toThrow();
  });

  test('throws when input contains a symbol not in the corresponding alphabet', () => {
    const symbol = freshSymbol();
    const bad = ['\0', alphabets[1].symbols[0], alphabets[2].symbols[0]];

    expect(() => symbol(bad.join(''))).toThrow('invalid symbol parameter');
    expect(() => symbol(bad)).toThrow('invalid symbol parameter');
  });

  test('returns a JS Symbol for valid input', () => {
    const symbol = freshSymbol();

    expect(typeof symbol(goodList)).toBe('symbol');
  });

  test('symbol(ifOtherSymbol) is the ifOtherSymbol singleton', () => {
    const symbol = freshSymbol();

    expect(symbol(ifOtherSymbol)).toBe(ifOtherSymbol);
  });

  test('an array of all-ifOtherSymbol entries collapses to ifOtherSymbol', () => {
    const symbol = freshSymbol();

    expect(symbol(goodList.map(() => ifOtherSymbol))).toBe(ifOtherSymbol);
    expect(symbol([...goodList, ...goodList].map(() => ifOtherSymbol))).toBe(ifOtherSymbol);
  });

  test('input with at least one all-ifOtherSymbol row collapses to ifOtherSymbol', () => {
    const symbol = freshSymbol();

    // 6 entries (= 2 rows × 3 tapes): row 0 is all-ifOther, row 1 is goodList.
    // Source's #getSymbolForPatternList short-circuits to ifOtherSymbol
    // when ANY row is entirely ifOtherSymbol — even with other rows present.
    const partial = [...goodList.map(() => ifOtherSymbol), ...goodList];

    expect(symbol(partial)).toBe(ifOtherSymbol);
  });

  test('same input shape returns the same interned Symbol', () => {
    const symbol = freshSymbol();

    expect(symbol(goodString)).toBe(symbol(goodList));
    expect(symbol(goodString + goodString)).toBe(symbol(goodList));
    expect(symbol([goodList[0], ifOtherSymbol, goodList[2]]))
      .toBe(symbol([goodList[0], ifOtherSymbol, goodList[2]]));
  });

  test('different input shapes produce different Symbols', () => {
    const symbol = freshSymbol();

    expect(symbol(goodString))
      .not.toBe(symbol(alphabets.map((a) => a.symbols[1])));
    expect(symbol(goodList))
      .not.toBe(symbol([goodList[0], ifOtherSymbol, goodList[2]]));
  });
});

describe('TapeBlock.replaceTape', () => {
  function setup() {
    const original = alphabets.map((alphabet) => new Tape({alphabet}));
    const surrogate = alphabets.map((alphabet) => new Tape({alphabet}));
    return {original, surrogate, tapeBlock: TapeBlock.fromTapes(original)};
  }

  test('throws on out-of-range tapeIx (below 0 or beyond tape count)', () => {
    const {tapeBlock, surrogate} = setup();

    expect(() => tapeBlock.replaceTape(surrogate[0], -1))
      .toThrow('invalid tapeIx');
    expect(() => tapeBlock.replaceTape(surrogate[0], tapeBlock.tapes.length))
      .toThrow('invalid tapeIx');
    expect(() => tapeBlock.replaceTape(surrogate[0], tapeBlock.tapes.length + 5))
      .toThrow('invalid tapeIx');
  });

  test('throws when the new tape\'s alphabet differs from the original\'s', () => {
    const {tapeBlock, surrogate} = setup();

    // Mismatch each pair: surrogate from a different alphabet position.
    surrogate.forEach((_, ix) => {
      const wrongAlphabetTape = surrogate[(ix + 1) % surrogate.length];
      expect(() => tapeBlock.replaceTape(wrongAlphabetTape, ix))
        .toThrow('invalid tape');
    });
  });

  test('replaces the tape when alphabets match', () => {
    const {tapeBlock, surrogate} = setup();

    surrogate.forEach((tape, ix) => {
      tapeBlock.replaceTape(tape, ix);
      expect(tapeBlock.tapes[ix]).toBe(tape);
    });
  });
});

describe('TapeBlock.isMatched', () => {
  function setupAtSymbols() {
    const tapes = alphabets.map((alphabet) => new Tape({
      alphabet,
      symbols: alphabet.symbols,
    }));

    return {tapes, tapeBlock: TapeBlock.fromTapes(tapes)};
  }

  test('throws on a Symbol that was not produced by this TapeBlock\'s `symbol` method', () => {
    const {tapeBlock} = setupAtSymbols();

    expect(() => tapeBlock.isMatched({symbol: Symbol('foreign')}))
      .toThrow('invalid symbol');
  });

  test('returns true unconditionally for ifOtherSymbol', () => {
    const {tapeBlock} = setupAtSymbols();

    expect(tapeBlock.isMatched({symbol: ifOtherSymbol})).toBe(true);
  });

  test('matches against current head symbols by default and against a passed override otherwise', () => {
    const {tapeBlock, tapes} = setupAtSymbols();
    const goodList = alphabets.map((a) => a.symbols[0]);
    const symbol = tapeBlock.symbol(goodList);

    // Heads currently on symbols[0] of each alphabet — matches.
    expect(tapeBlock.isMatched({symbol})).toBe(true);
    expect(tapeBlock.isMatched({currentSymbols: tapeBlock.currentSymbols, symbol})).toBe(true);

    // Move one cell right — heads now on symbols[1] — should NOT match.
    const right = new TapeCommand({movement: movements.right});
    tapeBlock.applyCommand(new Command(tapes.map(() => right)));
    expect(tapeBlock.isMatched({symbol})).toBe(false);

    // But matching against the BEFORE snapshot still works (override path):
    expect(tapeBlock.isMatched({
      currentSymbols: tapes.map((t) => t.alphabet.symbols[0]),
      symbol,
    })).toBe(true);
  });

  test('symbol with ifOtherSymbol slots matches any value in those positions', () => {
    const {tapeBlock} = setupAtSymbols();

    const cases: Array<[(symbol | string)[], boolean]> = [
      [[alphabets[0].blankSymbol, alphabets[0].blankSymbol, ifOtherSymbol], true],
      [[alphabets[0].get(1), alphabets[0].blankSymbol, ifOtherSymbol], false],
      [[alphabets[0].blankSymbol, alphabets[1].get(2), ifOtherSymbol], false],
    ];

    for (const [pattern, expected] of cases) {
      expect(tapeBlock.isMatched({
        symbol: tapeBlock.symbol(pattern),
      })).toBe(expected);
    }
  });
});

describe('TapeBlock.applyCommand', () => {
  function setupSingleTape() {
    const tape = new Tape({
      alphabet: alphabets[0],
      symbols: alphabets[0].symbols,
    });
    return {tape, tapeBlock: TapeBlock.fromTapes([tape])};
  }

  test('throws when command count differs from tape count (too many)', () => {
    const {tapeBlock} = setupSingleTape();

    expect(() => tapeBlock.applyCommand(new Command([
      new TapeCommand({}),
      new TapeCommand({}),
    ]))).toThrow('invalid command');
  });

  // Note: "too few" (zero commands) is rejected earlier by the Command
  // constructor itself, not by applyCommand — see Command.spec.ts.

  test('writes a literal string symbol to the head cell', () => {
    const {tape, tapeBlock} = setupSingleTape();

    tapeBlock.applyCommand(new Command([
      new TapeCommand({symbol: tape.alphabet.symbols[1]}),
    ]));

    expect(tape.symbol).toBe(tape.alphabet.symbols[1]);
  });

  test('symbolCommands.erase resets the head cell to the blank symbol', () => {
    const {tape, tapeBlock} = setupSingleTape();
    // Start with a non-blank head cell so erase has something to clear.
    tape.symbol = tape.alphabet.symbols[1];

    tapeBlock.applyCommand(new Command([
      new TapeCommand({symbol: symbolCommands.erase}),
    ]));

    expect(tape.symbol).toBe(tape.alphabet.blankSymbol);
  });

  test('symbolCommands.keep leaves the head cell untouched', () => {
    const {tape, tapeBlock} = setupSingleTape();
    tape.symbol = tape.alphabet.symbols[1];
    const before = tape.symbol;

    tapeBlock.applyCommand(new Command([
      new TapeCommand({symbol: symbolCommands.keep}),
    ]));

    expect(tape.symbol).toBe(before);
  });

  test('rejects writing a symbol that is not in the alphabet', () => {
    const {tapeBlock} = setupSingleTape();

    expect(() => tapeBlock.applyCommand(new Command([
      new TapeCommand({symbol: '\0'}),
    ]))).toThrow('Invalid symbol');
  });
});

describe('TapeBlock.clone', () => {
  function setup() {
    return {tapeBlock: TapeBlock.fromAlphabets(alphabets)};
  }

  test('returns a TapeBlock instance for both clone(false) and clone(true)', () => {
    const {tapeBlock} = setup();

    expect(tapeBlock.clone()).toBeInstanceOf(TapeBlock);
    expect(tapeBlock.clone(true)).toBeInstanceOf(TapeBlock);
  });

  test('cloned alphabets equal the original alphabets', () => {
    const {tapeBlock} = setup();
    const cloned = tapeBlock.clone();

    expect(cloned.alphabets).toEqual(tapeBlock.alphabets);
  });

  test('clone() (no copy): cloned tapes are FRESH (blank) — original head state is not preserved', () => {
    const {tapeBlock} = setup();
    tapeBlock.tapes.forEach((tape) => {
      tape.symbol = tape.alphabet.symbols[1]; // mutate original
    });

    const clonedFresh = tapeBlock.clone();

    clonedFresh.tapes.forEach((tape) => {
      expect(tape.symbol).toBe(tape.alphabet.blankSymbol);
    });
  });

  test('clone(true) (copy tapes): cloned tapes match the original tape state', () => {
    const {tapeBlock} = setup();
    tapeBlock.tapes.forEach((tape) => {
      tape.symbol = tape.alphabet.symbols[1];
    });

    const clonedCopy = tapeBlock.clone(true);

    clonedCopy.tapes.forEach((tape, ix) => {
      expect(tape.symbols.join()).toBe(tapeBlock.tapes[ix].symbols.join());
    });
  });

  test('cloned tapeBlock shares the symbol-pattern map with the original', () => {
    const {tapeBlock} = setup();
    const tapesSymbols = alphabets.map((a) => a.symbols[1]);
    const original = tapeBlock.symbol(tapesSymbols);

    const cloned = tapeBlock.clone();
    const clonedSymbol = cloned.symbol(tapesSymbols);

    // Same input shape → same interned Symbol, even on a clone.
    expect(clonedSymbol).toBe(original);
  });
});
