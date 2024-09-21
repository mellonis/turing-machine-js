import Alphabet from './Alphabet';

describe('Alphabet constructor', () => {
  test('throws an error on empty array', () => {
    expect(() => new Alphabet([]))
      .toThrow('Invalid symbols length');
  });

  test('throws an error on one element array', () => {
    expect(() => new Alphabet(['1']))
      .toThrow('Invalid symbols length');
  });

  test('throws an error on one element array (unique)', () => {
    expect(() => new Alphabet(['1', '1']))
      .toThrow('Invalid symbols length');
  });

  test('ok with two element array', () => {
    expect(new Alphabet(['0', '1']))
      .toBeTruthy();
  });

  test('copy alphabet', () => {
    const alphabet = new Alphabet(['0', '1']);
    const alphabetCopy = new Alphabet(alphabet);

    expect(alphabet)
      .toBeTruthy();
    expect(alphabetCopy)
      .toBeTruthy();
    expect(alphabet)
      .toEqual(alphabetCopy);
  });
});

describe('Alphabet properties', () => {
  const alphabetSymbols = '012345';
  const alphabet = new Alphabet(alphabetSymbols.split(''));

  test('symbolList', () => {
    expect(alphabet.symbols)
      .toEqual(alphabetSymbols.split(''));
  });

  test('blankSymbol', () => {
    expect(alphabet.blankSymbol)
      .toBe(alphabetSymbols[0]);
  });

  test('has', () => {
    const hasAllSymbols = alphabetSymbols.split('')
      .every((symbol) => alphabet.has(symbol));

    expect(hasAllSymbols)
      .toBe(true);
  });

  test('has not', () => {
    expect(alphabet.has('\0'))
      .toBe(false);
  });

  test('get', () => {
    const areAllSymbolsCorrect = alphabetSymbols.split('')
      .every((symbol, index) => symbol === alphabet.get(index));

    expect(areAllSymbolsCorrect)
      .toBe(true);
  });

  test('get invalid index: -1', () => {
    expect(() => {
      alphabet.get(-1);
    })
      .toThrow('Invalid index');
  });

  test(`get invalid index: ${alphabetSymbols.length}`, () => {
    expect(() => {
      alphabet.get(alphabetSymbols.length);
    })
      .toThrow('Invalid index');
  });

  test('index.spec.ts', () => {
    const areAllIndexesCorrect = alphabetSymbols.split('')
      .every((symbol, index) => index === alphabet.index(symbol));

    expect(areAllIndexesCorrect)
      .toBe(true);
  });
});
