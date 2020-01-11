import { Alphabet } from '@turing-machine-js/machine';

describe('Alphabet constructor', () => {
  test('throws an exception without parameters', () => {
    expect(() => new Alphabet())
      .toThrow('Invalid symbolList length');
  });

  test('throws an error on empty array', () => {
    expect(() => new Alphabet({
      symbolList: [],
    }))
      .toThrow('Invalid symbolList length');
  });

  test('throws an error on one element array', () => {
    expect(() => new Alphabet({
      symbolList: ['1'],
    }))
      .toThrow('Invalid symbolList length');
  });

  test('throws an error on one element array (unique)', () => {
    expect(() => new Alphabet({
      symbolList: ['1', '1'],
    }))
      .toThrow('Invalid symbolList length');
  });

  test('throws an error on invalid element', () => {
    expect(() => new Alphabet({
      symbolList: ['1', 1],
    }))
      .toThrow('symbolList contains invalid symbol');
  });

  test('ok with two element array', () => {
    expect(new Alphabet({
      symbolList: ['0', '1'],
    }))
      .toBeTruthy();
  });

  test('copy alphabet', () => {
    const alphabet = new Alphabet({
      symbolList: ['0', '1'],
    });
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
  const alphabet = new Alphabet({
    symbolList: alphabetSymbols.split(''),
  });

  test('symbolList', () => {
    expect(alphabet.symbolList)
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

  test('test.js', () => {
    const areAllIndexesCorrect = alphabetSymbols.split('')
      .every((symbol, index) => index === alphabet.index(symbol));

    expect(areAllIndexesCorrect)
      .toBe(true);
  });
});
