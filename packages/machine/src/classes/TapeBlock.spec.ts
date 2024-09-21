import Alphabet from './Alphabet';
import Command from './Command';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TapeCommand, {movements} from './TapeCommand';
import {ifOtherSymbol} from './State';

const alphabets = [
  new Alphabet(' 01'.split('')),
  new Alphabet(' ab'.split('')),
  new Alphabet(' аб'.split('')),
];

describe('TapeBlock currentSymbolList property', () => {
  let tapes: Tape[];
  let tapeBlock: TapeBlock;

  beforeAll(() => {
    tapes = alphabets.map((alphabet) => new Tape({
      alphabet,
      symbols: alphabet.symbols,
    }));
    tapeBlock = TapeBlock.fromTapes(tapes);
  });

  test('currentSymbolList exists', () => {
    expect(tapeBlock.currentSymbols)
      .toBeTruthy();
  });

  test('currentSymbolList value', () => {
    const tapeCommandLeft = new TapeCommand({
      movement: movements.left,
    });
    const tapeCommandRight = new TapeCommand({
      movement: movements.right,
    });
    const tapeCommandIdle = new TapeCommand({});
    const rightCommand = new Command(tapes.map(() => tapeCommandRight));

    expect(tapeBlock.currentSymbols)
      .toEqual(alphabets.map((alphabet) => alphabet.symbols[0]));

    tapeBlock.applyCommand(rightCommand);

    expect(tapeBlock.currentSymbols)
      .toEqual(alphabets.map((alphabet) => alphabet.symbols[1]));

    tapeBlock.applyCommand(rightCommand);

    expect(tapeBlock.currentSymbols)
      .toEqual(alphabets.map((alphabet) => alphabet.symbols[2]));

    tapeBlock.applyCommand(rightCommand);

    expect(tapeBlock.currentSymbols)
      .toEqual(alphabets.map((alphabet) => alphabet.symbols[0]));

    tapeBlock.applyCommand(new Command([tapeCommandLeft, tapeCommandIdle, tapeCommandIdle]));

    expect(tapeBlock.currentSymbols)
      .toEqual([
        alphabets[0].symbols[2],
        alphabets[1].symbols[0],
        alphabets[2].symbols[0],
      ]);
  });
});

describe('TapeBlock alphabetList property', () => {
  const tapes = alphabets.map((alphabet) => new Tape({
    alphabet,
    symbols: alphabet.symbols,
  }));
  const tapeBlock = TapeBlock.fromTapes(tapes);

  test('alphabetList exists', () => {
    expect(tapeBlock.alphabets)
      .toBeTruthy();
  });

  test('correct alphabets in list', () => {
    expect(tapeBlock.alphabets)
      .toEqual(tapeBlock.tapes.map((tape) => tape.alphabet));
  });
});

describe('TapeBlock symbol method', () => {
  const goodListParameter = alphabets.map((alphabet) => alphabet.symbols[0]);
  const goodStringParameter = goodListParameter.join('');
  let tapes: Tape[];
  let tapeBlock;
  let symbol: TapeBlock['symbol'];

  beforeAll(() => {
    tapes = alphabets.map((alphabet) => new Tape({
      alphabet,
    }));
    tapeBlock = TapeBlock.fromTapes(tapes);
    symbol = tapeBlock.symbol;
  });

  test('symbol exists', () => {
    expect(symbol)
      .toBeTruthy();
  });

  test('symbol throw an error if parameter is not a string or an array', () => {
    expect(() => symbol(goodStringParameter))
      .not
      .toThrow();
    expect(() => symbol(goodListParameter))
      .not
      .toThrow();
  });

  test('symbol throw an error if parameter length is less that tapeList length', () => {
    expect(() => symbol(''))
      .toThrow('invalid symbol parameter');
    expect(() => symbol([]))
      .toThrow('invalid symbol parameter');
    expect(() => symbol(goodStringParameter))
      .not
      .toThrow('invalid symbol parameter');
    expect(() => symbol(goodListParameter))
      .not
      .toThrow('invalid symbol parameter');
  });

  test('symbol throw an error if parameter length is not divisible by tapeList length', () => {
    expect(() => symbol(alphabets[0].symbols[1]))
      .toThrow('invalid symbol parameter');
    expect(() => symbol([
      alphabets[0].symbols[1],
    ]))
      .toThrow('invalid symbol parameter');

    expect(() => symbol(goodStringParameter))
      .not
      .toThrow('invalid symbol parameter');
    expect(() => symbol(goodListParameter))
      .not
      .toThrow('invalid symbol parameter');
    expect(() => symbol(goodStringParameter + goodStringParameter))
      .not
      .toThrow('invalid symbol parameter');
    expect(() => symbol([...goodListParameter, ...goodListParameter]))
      .not
      .toThrow('invalid symbol parameter');
    expect(() => symbol(goodStringParameter + goodStringParameter + goodStringParameter[0]))
      .toThrow('invalid symbol parameter');
    expect(() => symbol([...goodListParameter, ...goodListParameter, goodListParameter[0]]))
      .toThrow('invalid symbol parameter');
  });

  test('symbol throw an error if parameter contains invalid symbol', () => {
    const badListParameter = ['\0', alphabets[1].symbols[0], alphabets[2].symbols[0]];
    const badStringParameter = badListParameter.join('');

    expect(() => symbol(badStringParameter))
      .toThrow('invalid symbol parameter');
    expect(() => symbol(badListParameter))
      .toThrow('invalid symbol parameter');
  });

  test('symbol returns a Symbol', () => {
    expect(typeof symbol(goodListParameter))
      .toBe('symbol');
  });

  test('symbol of ifOtherSymbol is ifOtherSymbol itself', () => {
    expect(symbol(ifOtherSymbol))
      .toBe(ifOtherSymbol);
  });

  test('symbol [ifOtherSymbol, ifOtherSymbol, ...] is ifOtherSymbol', () => {
    expect(symbol(goodListParameter.map(() => ifOtherSymbol)))
      .toBe(ifOtherSymbol);

    expect(symbol([...goodListParameter, ...goodListParameter].map(() => ifOtherSymbol)))
      .toBe(ifOtherSymbol);
  });

  test('symbol [ifOtherSymbol, ifOtherSymbol, ifOtherSymbol, <some symbol>, <some symbol>...] is ifOtherSymbol', () => {
    expect(symbol([...[...goodListParameter].map(() => ifOtherSymbol), ...goodListParameter]))
      .toBe(ifOtherSymbol);
  });

  test('same symbols', () => {
    expect(symbol(goodStringParameter) === symbol(goodListParameter))
      .toBe(true);

    expect(symbol(goodStringParameter + goodStringParameter) === symbol(goodListParameter))
      .toBe(true);

    expect(
      symbol([goodListParameter[0], ifOtherSymbol, goodListParameter[2]]) === symbol([goodListParameter[0], ifOtherSymbol, goodListParameter[2]]),
    )
      .toBe(true);
  });

  test('different symbols', () => {
    expect(
      symbol(goodStringParameter) === symbol(
        alphabets.map((alphabet) => alphabet.symbols[1]),
      ),
    )
      .toBe(false);

    expect(
      symbol([goodListParameter[0], goodListParameter[1], goodListParameter[2]]) === symbol([goodListParameter[0], ifOtherSymbol, goodListParameter[2]]),
    )
      .toBe(false);
  });
});

describe('TapeBlock replaceTape method', () => {
  const purposeToTapes: Record<'original' | 'surrogate', Tape[] | null> = {
    original: null,
    surrogate: null,
  };
  let tapeBlock: TapeBlock;

  beforeAll(() => {
    purposeToTapes.original = alphabets.map((alphabet) => new Tape({
      alphabet,
    }));
    purposeToTapes.surrogate = alphabets.map((alphabet) => new Tape({
      alphabet,
    }));
    tapeBlock = TapeBlock.fromTapes(purposeToTapes.original);
  });

  test('replaceTape exists', () => {
    expect(tapeBlock.replaceTape)
      .toBeTruthy();
  });

  test('tapeIx must be from 0 to (currentSymbolList - 1)', () => {
    const surrogateTape = new Tape({alphabet: alphabets[0]});

    Array.from(new Array(tapeBlock.currentSymbols.length + 2)).forEach((_, ix) => {
      const tapeIx = ix - 1;

      if (tapeIx < 0 || tapeIx >= tapeBlock.currentSymbols.length) {
        expect(() => tapeBlock.replaceTape(surrogateTape, tapeIx))
          .toThrow('invalid tapeIx');
      } else {
        const tape = purposeToTapes.surrogate?.[tapeIx];

        expect(tape).toBeTruthy();
        expect(() => tapeBlock.replaceTape(tape!, tapeIx))
          .not
          .toThrow();
      }
    });
  });

  test('can\'t replace tape with different alphabet', () => {
    purposeToTapes.original?.forEach((_, ix) => {
      const tape = purposeToTapes.surrogate?.[(ix + 1) % purposeToTapes.surrogate.length];

      expect(tape).toBeTruthy();
      expect(() => {
        tapeBlock.replaceTape(tape!, ix);
      })
        .toThrow('invalid tape');
    });
  });

  test('replace tape is successful', () => {
    purposeToTapes.original?.forEach((_, ix) => {
      const tape = purposeToTapes.surrogate?.[ix];

      expect(tape).toBeTruthy();
      expect(() => {
        tapeBlock.replaceTape(tape!, ix);
      })
        .not
        .toThrow('invalid tape');
    });
  });
});

describe('TapeBlock isMatched method', () => {
  const goodListParameter = alphabets.map((alphabet) => alphabet.symbols[0]);
  let tapes: Tape[];
  let tapeBlock: TapeBlock;

  beforeAll(() => {
    tapes = alphabets.map((alphabet) => new Tape({
      alphabet,
      symbols: alphabet.symbols,
    }));
    tapeBlock = TapeBlock.fromTapes(tapes);
  });

  test('isMatched exists', () => {
    expect(tapeBlock.isMatched)
      .toBeTruthy();
  });

  test('isMatched throws an error on invalid symbol', () => {
    expect(() => tapeBlock.isMatched({
      symbol: Symbol('some symbol'),
    }))
      .toThrow('invalid symbol');
  });

  test('isMatched with ifOtherSymbol is true', () => {
    expect(tapeBlock.isMatched({
      symbol: ifOtherSymbol,
    }))
      .toBe(true);
  });

  test('isMatched + symbols', () => {
    const patternAndIsMatchedPairs: [symbol | (symbol | string)[], boolean][] = [
      [ifOtherSymbol, true],
      [[ifOtherSymbol, ifOtherSymbol, ifOtherSymbol], true],
      [[alphabets[0].blankSymbol, alphabets[0].blankSymbol, ifOtherSymbol], true],
      [[alphabets[0].get(1), alphabets[0].blankSymbol, ifOtherSymbol], false],
      [[alphabets[0].blankSymbol, alphabets[1].get(2), ifOtherSymbol], false],
    ];

    patternAndIsMatchedPairs.forEach(([pattern, isMatched]) => {
      expect(tapeBlock.isMatched({
        symbol: tapeBlock.symbol(pattern),
      }))
        .toBe(isMatched);
    });
  });

  test('isMatched + tapeBlock.applyCommand', () => {
    const symbol = tapeBlock.symbol(goodListParameter);

    expect(() => tapeBlock.isMatched({
      currentSymbols: tapeBlock.currentSymbols,
      symbol,
    }))
      .not
      .toThrow();

    expect(() => tapeBlock.isMatched({
      symbol,
    }))
      .not
      .toThrow();

    expect(tapeBlock.isMatched({
      currentSymbols: tapeBlock.currentSymbols,
      symbol,
    }))
      .toBe(true);

    expect(tapeBlock.isMatched({
      symbol,
    }))
      .toBe(true);

    const tapeCommandLeft = new TapeCommand({
      movement: movements.left,
    });
    const tapeCommandRight = new TapeCommand({
      movement: movements.right,
    });
    const tapeCommandIdle = new TapeCommand({});

    tapeBlock.applyCommand(new Command(tapes.map(() => tapeCommandRight)));

    expect(tapeBlock.isMatched({
      currentSymbols: tapeBlock.currentSymbols,
      symbol,
    }))
      .toBe(false);

    expect(tapeBlock.isMatched({
      symbol,
    }))
      .toBe(false);

    tapeBlock.applyCommand(new Command(tapes.map(() => tapeCommandLeft)));

    expect(tapeBlock.isMatched({
      currentSymbols: tapeBlock.currentSymbols,
      symbol,
    }))
      .toBe(true);

    expect(tapeBlock.isMatched({
      symbol,
    }))
      .toBe(true);

    tapes.forEach((tape, tapeIx) => {
      let tapeCommandList = tapes.map((_, ix) => (
        tapeIx === ix
          ? tapeCommandRight
          : tapeCommandIdle
      ));

      tapeBlock.applyCommand(new Command(tapeCommandList));

      expect(tapeBlock.isMatched({
        currentSymbols: tapeBlock.currentSymbols,
        symbol,
      }))
        .toBe(false);

      expect(tapeBlock.isMatched({
        symbol,
      }))
        .toBe(false);

      tapeCommandList = tapes.map((_, ix) => (
        tapeIx === ix
          ? tapeCommandLeft
          : tapeCommandIdle
      ));

      tapeBlock.applyCommand(new Command(tapeCommandList));

      expect(tapeBlock.isMatched({
        currentSymbols: tapeBlock.currentSymbols,
        symbol,
      }))
        .toBe(true);

      expect(tapeBlock.isMatched({
        symbol,
      }))
        .toBe(true);
    });
  });
});

describe('TapeBlock applyCommand method', () => {
  let tape: Tape;
  let tapeBlock: TapeBlock;

  beforeEach(() => {
    const alphabet = alphabets[0];

    tape = new Tape({
      alphabet,
      symbols: alphabet.symbols,
    });
    tapeBlock = TapeBlock.fromTapes([tape]);
  });

  test('throws an error commands count is not equal to tapes count', () => {
    expect(() => tapeBlock.applyCommand(new Command([
      new TapeCommand({}),
      new TapeCommand({}),
    ])))
      .toThrow('invalid command');
  });

  test('writes symbol', () => {
    tapeBlock.applyCommand(new Command([
      new TapeCommand({
        symbol: tape.alphabet.symbols[1],
      }),
    ]));

    expect(tape.symbol)
      .toBe(tape.alphabet.symbols[1]);
  });

  test('throws an error when trying invalid symbol', () => {
    expect(() => {
      tapeBlock.applyCommand(new Command([
        new TapeCommand({
          symbol: '\0',
        }),
      ]));
    })
      .toThrow('Invalid symbol');
  });
});

describe('TapeBlock clone method', () => {
  let tapeBlock: TapeBlock;

  beforeEach(() => {
    tapeBlock = TapeBlock.fromAlphabets(alphabets);
  });

  test('clone exists', () => {
    expect(tapeBlock.clone)
      .toBeTruthy();
  });

  test('clone returns TapeBlock instance', () => {
    const cloneTapeBlockWithoutTapes = tapeBlock.clone();
    const cloneTapeBlockWithTapes = tapeBlock.clone(true);

    expect(cloneTapeBlockWithoutTapes instanceof TapeBlock)
      .toBe(true);
    expect(cloneTapeBlockWithTapes instanceof TapeBlock)
      .toBe(true);
  });

  test('cloned tapeBlock alphabetList property', () => {
    const clonedTapeBlock = tapeBlock.clone();

    expect(clonedTapeBlock.alphabets.every((alphabet) => alphabet instanceof Alphabet))
      .toBe(true);

    expect(
      clonedTapeBlock.alphabets
        .every((alphabet, alphabetIx) => tapeBlock.alphabets[alphabetIx].symbols
          .every((symbol, symbolIx) => symbol === clonedTapeBlock
            .alphabets[alphabetIx].symbols[symbolIx])),
    )
      .toBe(true);
  });

  test('cloned tapeBlock tapeList property', () => {
    tapeBlock.tapes.forEach((tape) => tape.symbol = tape.alphabet.symbols[1]);

    const clonedTapeBlockWithoutTapes = tapeBlock.clone();
    const clonedTapeBlockWithTapes = tapeBlock.clone(true);

    expect(clonedTapeBlockWithoutTapes.tapes.every((tape) => tape instanceof Tape))
      .toBe(true);
    expect(clonedTapeBlockWithTapes.tapes.every((tape) => tape instanceof Tape))
      .toBe(true);

    expect(
      clonedTapeBlockWithoutTapes.tapes
        .every((tape) => tape.symbols.join() === tape.alphabet.blankSymbol),
    )
      .toBe(true);

    expect(
      clonedTapeBlockWithTapes.tapes
        .every((tape, tapeIx) => (
          tape.symbols.join() === tapeBlock.tapes[tapeIx].symbols.join()
        )),
    )
      .toBe(true);
  });

  test('cloned tapeBlock contains symbols from original tapeBlock', () => {
    const tapesSymbols = alphabets.map((alphabet) => alphabet.symbols[1]);
    const originalSymbol = tapeBlock.symbol(tapesSymbols);
    const clonedTapeBlock = tapeBlock.clone();
    const symbolFromClonedTapeBlock = clonedTapeBlock.symbol(tapesSymbols);

    expect(originalSymbol === symbolFromClonedTapeBlock).toBe(true);
  });
});
