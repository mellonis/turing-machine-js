import {
  Alphabet,
  Command,
  Tape,
  TapeBlock,
  TapeCommand,
  movements, ifOtherSymbol,
} from '@turing-machine-js/machine';

const alphabetList = [
  new Alphabet({
    symbolList: ' 01'.split(''),
  }),
  new Alphabet({
    symbolList: ' ab'.split(''),
  }),
  new Alphabet({
    symbolList: ' аб'.split(''),
  }),
];

describe('TapeBlock constructor', () => {
  test('throws without parameter', () => {
    expect(() => new TapeBlock())
      .toThrowError();
  });

  test('throws without alphabetList and tapeList ', () => {
    expect(() => new TapeBlock({}))
      .toThrowError('invalid parameter');
  });

  test('throws if tapeList is not an array', () => {
    expect(() => new TapeBlock({
      tapeList: null,
    }))
      .toThrowError('invalid parameter');
  });

  test('throws if tapeList contains not Tape', () => {
    expect(() => new TapeBlock({
      tapeList: 'null',
    }))
      .toThrowError('tapeList must be an array');
  });

  test('throws if alphabetList is not an array', () => {
    expect(() => new TapeBlock({
      alphabetList: null,
    }))
      .toThrowError('invalid parameter');

    expect(() => new TapeBlock({
      alphabetList: 'null',
    }))
      .toThrowError('alphabetList must be an array');
  });

  test('throws if alphabetList contains something different than Alphabet', () => {
    expect(() => new TapeBlock({
      alphabetList: [null],
    }))
      .toThrowError('invalid alphabet');
  });

  test('throws if tapeList is empty', () => {
    expect(() => new TapeBlock({
      tapeList: [],
    }))
      .toThrowError('empty tape list');
  });

  test('throws if alphabetList is empty', () => {
    expect(() => new TapeBlock({
      alphabetList: [],
    }))
      .toThrowError('empty alphabet list');
  });

  test('throws if tapeList contains something different than Tape', () => {
    expect(() => new TapeBlock({
      tapeList: [null],
    }))
      .toThrowError('invalid tape');
  });
});

describe('TapeBlock currentSymbolList property', () => {
  let tapeList;
  let tapeBlock;

  beforeAll(() => {
    tapeList = alphabetList.map((alphabet) => new Tape({
      alphabet,
      symbolList: alphabet.symbolList,
    }));
    tapeBlock = new TapeBlock({
      tapeList,
    });
  });

  test('currentSymbolList exists', () => {
    expect(tapeBlock.currentSymbolList)
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
    const rightCommand = new Command(tapeList.map(() => tapeCommandRight));

    expect(tapeBlock.currentSymbolList)
      .toEqual(alphabetList.map((alphabet) => alphabet.symbolList[0]));

    tapeBlock.applyCommand(rightCommand);

    expect(tapeBlock.currentSymbolList)
      .toEqual(alphabetList.map((alphabet) => alphabet.symbolList[1]));

    tapeBlock.applyCommand(rightCommand);

    expect(tapeBlock.currentSymbolList)
      .toEqual(alphabetList.map((alphabet) => alphabet.symbolList[2]));

    tapeBlock.applyCommand(rightCommand);

    expect(tapeBlock.currentSymbolList)
      .toEqual(alphabetList.map((alphabet) => alphabet.symbolList[0]));

    tapeBlock.applyCommand(new Command([tapeCommandLeft, tapeCommandIdle, tapeCommandIdle]));

    expect(tapeBlock.currentSymbolList)
      .toEqual([
        alphabetList[0].symbolList[2],
        alphabetList[1].symbolList[0],
        alphabetList[2].symbolList[0],
      ]);
  });
});

describe('TapeBlock alphabetList property', () => {
  const tapeList = alphabetList.map((alphabet) => new Tape({
    alphabet,
    symbolList: alphabet.symbolList,
  }));
  const tapeBlock = new TapeBlock({
    tapeList,
  });

  test('alphabetList exists', () => {
    expect(tapeBlock.alphabetList)
      .toBeTruthy();
  });

  test('correct alphabets in list', () => {
    expect(tapeBlock.alphabetList)
      .toEqual(tapeBlock.tapeList.map((tape) => tape.alphabet));
  });
});

describe('TapeBlock symbol method', () => {
  const goodListParameter = alphabetList.map((alphabet) => alphabet.symbolList[0]);
  const goodStringParameter = goodListParameter.join('');
  let tapeList;
  let tapeBlock;
  let symbol;

  beforeAll(() => {
    tapeList = alphabetList.map((alphabet) => new Tape({
      alphabet,
    }));
    tapeBlock = new TapeBlock({
      tapeList,
    });
    // eslint-disable-next-line prefer-destructuring
    symbol = tapeBlock.symbol;
  });

  test('symbol exists', () => {
    expect(symbol)
      .toBeTruthy();
  });

  test('symbol throw an error if parameter is undefined', () => {
    expect(() => symbol())
      .toThrowError('invalid symbol parameter');
  });

  test('symbol throw an error if parameter is not a string or an array', () => {
    expect(() => symbol(1))
      .toThrowError('invalid symbol parameter');
    expect(() => symbol({}))
      .toThrowError('invalid symbol parameter');
    expect(() => symbol(goodStringParameter))
      .not
      .toThrowError();
    expect(() => symbol(goodListParameter))
      .not
      .toThrowError();
  });

  test('symbol throw an error if parameter length is less that tapeList length', () => {
    expect(() => symbol(''))
      .toThrowError('invalid symbol parameter');
    expect(() => symbol([]))
      .toThrowError('invalid symbol parameter');
    expect(() => symbol(goodStringParameter))
      .not
      .toThrowError('invalid symbol parameter');
    expect(() => symbol(goodListParameter))
      .not
      .toThrowError('invalid symbol parameter');
  });

  test('symbol throw an error if parameter length is not divisible by tapeList length', () => {
    expect(() => symbol(alphabetList[0].symbolList[1]))
      .toThrowError('invalid symbol parameter');
    expect(() => symbol([
      alphabetList[0].symbolList[1],
    ]))
      .toThrowError('invalid symbol parameter');

    expect(() => symbol(goodStringParameter))
      .not
      .toThrowError('invalid symbol parameter');
    expect(() => symbol(goodListParameter))
      .not
      .toThrowError('invalid symbol parameter');
    expect(() => symbol(goodStringParameter + goodStringParameter))
      .not
      .toThrowError('invalid symbol parameter');
    expect(() => symbol([...goodListParameter, ...goodListParameter]))
      .not
      .toThrowError('invalid symbol parameter');
    expect(() => symbol(goodStringParameter + goodStringParameter + goodStringParameter[0]))
      .toThrowError('invalid symbol parameter');
    expect(() => symbol([...goodListParameter, ...goodListParameter, goodListParameter[0]]))
      .toThrowError('invalid symbol parameter');
  });

  test('symbol throw an error if parameter contains invalid symbol', () => {
    const badListParameter = ['\0', alphabetList[1].symbolList[0], alphabetList[2].symbolList[0]];
    const badStringParameter = badListParameter.join('');

    expect(() => symbol(badStringParameter))
      .toThrowError('invalid symbol parameter');
    expect(() => symbol(badListParameter))
      .toThrowError('invalid symbol parameter');
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
      // eslint-disable-next-line no-self-compare,max-len
      symbol([goodListParameter[0], ifOtherSymbol, goodListParameter[2]]) === symbol([goodListParameter[0], ifOtherSymbol, goodListParameter[2]]),
    )
      .toBe(true);
  });

  test('different symbols', () => {
    expect(
      symbol(goodStringParameter) === symbol(
        alphabetList.map((alphabet) => alphabet.symbolList[1]),
      ),
    )
      .toBe(false);

    expect(
      // eslint-disable-next-line no-self-compare,max-len
      symbol([goodListParameter[0], goodListParameter[1], goodListParameter[2]]) === symbol([goodListParameter[0], ifOtherSymbol, goodListParameter[2]]),
    )
      .toBe(false);
  });
});

describe('TapeBlock replaceTape method', () => {
  const tapeLists = {
    original: null,
    surrogate: null,
  };
  let tapeBlock;

  beforeAll(() => {
    tapeLists.original = alphabetList.map((alphabet) => new Tape({
      alphabet,
    }));
    tapeLists.surrogate = alphabetList.map((alphabet) => new Tape({
      alphabet,
    }));
    tapeBlock = new TapeBlock({
      tapeList: tapeLists.original,
    });
  });

  test('replaceTape exists', () => {
    expect(tapeBlock.replaceTape)
      .toBeTruthy();
  });

  test('tape must be an instance of Tape', () => {
    expect(() => tapeBlock.replaceTape(null))
      .toThrowError('invalid tape');
  });

  test('tapeIx must be from 0 to (currentSymbolList - 1)', () => {
    const surrogateTape = new Tape({ alphabet: alphabetList[0] });

    Array.from(new Array(tapeBlock.currentSymbolList.length + 2)).forEach((_, ix) => {
      const tapeIx = ix - 1;

      if (tapeIx < 0 || tapeIx >= tapeBlock.currentSymbolList.length) {
        expect(() => tapeBlock.replaceTape(surrogateTape, tapeIx))
          .toThrowError('invalid tapeIx');
      } else {
        expect(() => tapeBlock.replaceTape(tapeLists.surrogate[tapeIx], tapeIx))
          .not
          .toThrowError();
      }
    });
  });

  test('can\'t replace tape with different alphabet', () => {
    tapeLists.original.forEach((_, ix) => {
      expect(() => {
        tapeBlock.replaceTape(tapeLists.surrogate[(ix + 1) % tapeLists.surrogate.length], ix);
      })
        .toThrowError('invalid tape');
    });
  });

  test('replace tape is successful', () => {
    tapeLists.original.forEach((_, ix) => {
      expect(() => {
        tapeBlock.replaceTape(tapeLists.surrogate[ix], ix);
      })
        .not
        .toThrowError('invalid tape');
    });
  });
});

describe('TapeBlock isMatched method', () => {
  const goodListParameter = alphabetList.map((alphabet) => alphabet.symbolList[0]);
  let tapeList;
  let tapeBlock;

  beforeAll(() => {
    tapeList = alphabetList.map((alphabet) => new Tape({
      alphabet,
      symbolList: alphabet.symbolList,
    }));
    tapeBlock = new TapeBlock({
      tapeList,
    });
  });

  test('isMatched exists', () => {
    expect(tapeBlock.isMatched)
      .toBeTruthy();
  });

  test('isMatched throws an error on invalid symbol', () => {
    expect(() => tapeBlock.isMatched())
      .toThrowError();
    expect(() => tapeBlock.isMatched(Symbol('some symbol')))
      .toThrowError('invalid symbol');
    expect(() => tapeBlock.isMatched({
      symbol: Symbol('some symbol'),
    }))
      .toThrowError('invalid symbol');
  });

  test('isMatched with ifOtherSymbol is true', () => {
    expect(tapeBlock.isMatched({
      symbol: ifOtherSymbol,
    }))
      .toBe(true);
  });

  test('isMatched + symbols', () => {
    const patternAndIsMatchedList = [
      [ifOtherSymbol, true],
      [[ifOtherSymbol, ifOtherSymbol, ifOtherSymbol], true],
      [[alphabetList[0].blankSymbol, alphabetList[0].blankSymbol, ifOtherSymbol], true],
      [[alphabetList[0].get(1), alphabetList[0].blankSymbol, ifOtherSymbol], false],
      [[alphabetList[0].blankSymbol, alphabetList[1].get(2), ifOtherSymbol], false],
    ];

    patternAndIsMatchedList.forEach(([pattern, isMatched]) => {
      expect(tapeBlock.isMatched({
        symbol: tapeBlock.symbol(pattern),
      }))
        .toBe(isMatched);
    });
  });

  test('isMatched + tapeBlock.applyCommand', () => {
    const symbol = tapeBlock.symbol(goodListParameter);

    expect(() => tapeBlock.isMatched({
      currentSymbolList: tapeBlock.currentSymbolList,
      symbol,
    }))
      .not
      .toThrowError();

    expect(() => tapeBlock.isMatched({
      symbol,
    }))
      .not
      .toThrowError();

    expect(tapeBlock.isMatched({
      currentSymbolList: tapeBlock.currentSymbolList,
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

    tapeBlock.applyCommand(new Command(tapeList.map(() => tapeCommandRight)));

    expect(tapeBlock.isMatched({
      currentSymbolList: tapeBlock.currentSymbolList,
      symbol,
    }))
      .toBe(false);

    expect(tapeBlock.isMatched({
      symbol,
    }))
      .toBe(false);

    tapeBlock.applyCommand(new Command(tapeList.map(() => tapeCommandLeft)));

    expect(tapeBlock.isMatched({
      currentSymbolList: tapeBlock.currentSymbolList,
      symbol,
    }))
      .toBe(true);

    expect(tapeBlock.isMatched({
      symbol,
    }))
      .toBe(true);

    tapeList.forEach((tape, tapeIx) => {
      let tapeCommandList = tapeList.map((_, ix) => (
        tapeIx === ix
          ? tapeCommandRight
          : tapeCommandIdle
      ));

      tapeBlock.applyCommand(new Command(tapeCommandList));

      expect(tapeBlock.isMatched({
        currentSymbolList: tapeBlock.currentSymbolList,
        symbol,
      }))
        .toBe(false);

      expect(tapeBlock.isMatched({
        symbol,
      }))
        .toBe(false);

      tapeCommandList = tapeList.map((_, ix) => (
        tapeIx === ix
          ? tapeCommandLeft
          : tapeCommandIdle
      ));

      tapeBlock.applyCommand(new Command(tapeCommandList));

      expect(tapeBlock.isMatched({
        currentSymbolList: tapeBlock.currentSymbolList,
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
  let tape;
  let tapeBlock;

  beforeEach(() => {
    const alphabet = alphabetList[0];

    tape = new Tape({
      alphabet,
      symbolList: alphabet.symbolList,
    });
    tapeBlock = new TapeBlock({
      tapeList: [tape],
    });
  });

  test('throws an error if command is not a Command instance', () => {
    expect(() => tapeBlock.applyCommand(null))
      .toThrowError('invalid command');
  });

  test('throws an error commands count is not equal to tapes count', () => {
    expect(() => tapeBlock.applyCommand(new Command([
      new TapeCommand({}),
      new TapeCommand({}),
    ])))
      .toThrowError('invalid command');
  });

  test('writes symbol', () => {
    tapeBlock.applyCommand(new Command([
      new TapeCommand({
        symbol: tape.alphabet.symbolList[1],
      }),
    ]));

    expect(tape.symbol)
      .toBe(tape.alphabet.symbolList[1]);
  });

  test('throws an error when trying invalid symbol', () => {
    expect(() => {
      tapeBlock.applyCommand(new Command([
        new TapeCommand({
          symbol: '\0',
        }),
      ]));
    })
      .toThrowError('Invalid symbol');
  });
});

describe('TapeBlock clone method', () => {
  let tapeBlock;

  beforeEach(() => {
    tapeBlock = new TapeBlock({ alphabetList });
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

    expect(clonedTapeBlock.alphabetList.every((alphabet) => alphabet instanceof Alphabet))
      .toBe(true);

    expect(
      clonedTapeBlock.alphabetList
        .every((alphabet, alphabetIx) => tapeBlock.alphabetList[alphabetIx].symbolList
          .every((symbol, symbolIx) => symbol === clonedTapeBlock
            .alphabetList[alphabetIx].symbolList[symbolIx])),
    )
      .toBe(true);
  });

  test('cloned tapeBlock tapeList property', () => {
    // eslint-disable-next-line no-return-assign,no-param-reassign,prefer-destructuring
    tapeBlock.tapeList.forEach((tape) => tape.symbol = tape.alphabet.symbolList[1]);

    const clonedTapeBlockWithoutTapes = tapeBlock.clone();
    const clonedTapeBlockWithTapes = tapeBlock.clone(true);

    expect(clonedTapeBlockWithoutTapes.tapeList.every((tape) => tape instanceof Tape))
      .toBe(true);
    expect(clonedTapeBlockWithTapes.tapeList.every((tape) => tape instanceof Tape))
      .toBe(true);

    expect(
      clonedTapeBlockWithoutTapes.tapeList
        .every((tape) => tape.symbolList.join() === tape.alphabet.blankSymbol),
    )
      .toBe(true);

    expect(
      clonedTapeBlockWithTapes.tapeList
        .every((tape, tapeIx) => (
          tape.symbolList.join() === tapeBlock.tapeList[tapeIx].symbolList.join()
        )),
    )
      .toBe(true);
  });

  test('cloned tapeBlock contains symbols from original tapeBlock', () => {
    const tapeSymbolList = alphabetList.map((alphabet) => alphabet.symbolList[1]);
    const originalSymbol = tapeBlock.symbol(tapeSymbolList);
    const clonedTapeBlock = tapeBlock.clone();
    const symbolFromClonedTapeBlock = clonedTapeBlock.symbol(tapeSymbolList);

    expect(originalSymbol === symbolFromClonedTapeBlock)
      .toBe(true);
  });
});
