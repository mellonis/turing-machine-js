import Alphabet from './Alphabet';

describe('Alphabet constructor', () => {
  test('throws on empty array', () => {
    expect(() => new Alphabet([])).toThrow('Invalid symbols length');
  });

  test('throws on single-element array', () => {
    expect(() => new Alphabet(['1'])).toThrow('Invalid symbols length');
  });

  test('throws when duplicates collapse to a single unique symbol', () => {
    expect(() => new Alphabet(['1', '1'])).toThrow('Invalid symbols length');
  });

  test('throws on a multi-character symbol (audit gap: untested branch)', () => {
    // Source: `every(symbol => symbol.length === 1)` — a multi-char entry
    // takes the "symbols contains invalid symbol" throw path. Previously
    // unexercised; now pinned.
    expect(() => new Alphabet(['ab', 'cd'])).toThrow('symbols contains invalid symbol');
    expect(() => new Alphabet(['0', 'longer'])).toThrow('symbols contains invalid symbol');
  });

  test('two-element array constructs an Alphabet with both symbols intact', () => {
    const alphabet = new Alphabet(['0', '1']);

    expect(alphabet.symbols).toEqual(['0', '1']);
    expect(alphabet.symbols).toHaveLength(2);
  });

  test('duplicate-collapsing keeps the first occurrence order', () => {
    // ['1', '0', '1'] → unique [1, 0] (first-seen order). Documents that the
    // dedup uses uniquePredicate, which is order-preserving.
    const alphabet = new Alphabet(['1', '0', '1']);

    expect(alphabet.symbols).toEqual(['1', '0']);
    expect(alphabet.blankSymbol).toBe('1');
  });

  test('copy constructor preserves the original symbols', () => {
    const original = new Alphabet(['0', '1']);
    const copy = new Alphabet(original);

    expect(copy.symbols).toEqual(original.symbols);
    // The copy's symbols array is a fresh array (the getter returns a fresh
    // array each call), but contents match.
    expect(copy.symbols).not.toBe(original.symbols);
  });
});

describe('Alphabet.symbols / .blankSymbol getters', () => {
  const alphabetSymbols = '012345'.split('');
  const alphabet = new Alphabet(alphabetSymbols);

  test('symbols returns a fresh array each call (defensive copy)', () => {
    expect(alphabet.symbols).toEqual(alphabetSymbols);
    expect(alphabet.symbols).not.toBe(alphabet.symbols);
  });

  test('blankSymbol is the first element', () => {
    expect(alphabet.blankSymbol).toBe('0');
  });
});

describe('Alphabet.has', () => {
  const alphabet = new Alphabet('012345'.split(''));

  test('returns true for every alphabet member', () => {
    for (const symbol of '012345') {
      expect(alphabet.has(symbol)).toBe(true);
    }
  });

  test('returns false for non-members', () => {
    expect(alphabet.has('\0')).toBe(false);
    expect(alphabet.has('')).toBe(false);
    expect(alphabet.has('multi')).toBe(false); // multi-char query
    expect(alphabet.has('A')).toBe(false);
  });
});

describe('Alphabet.get', () => {
  const alphabet = new Alphabet('012345'.split(''));

  test('returns the symbol at each valid index', () => {
    for (let i = 0; i < 6; i += 1) {
      expect(alphabet.get(i)).toBe(String(i));
    }
  });

  test('throws on negative index', () => {
    expect(() => alphabet.get(-1)).toThrow('Invalid index');
  });

  test('throws on index === length (off-by-one boundary)', () => {
    expect(() => alphabet.get(6)).toThrow('Invalid index');
  });

  test('throws on index way beyond length', () => {
    expect(() => alphabet.get(100)).toThrow('Invalid index');
  });
});

describe('Alphabet.index', () => {
  const alphabet = new Alphabet('012345'.split(''));

  test('returns the position of every alphabet member', () => {
    '012345'.split('').forEach((symbol, ix) => {
      expect(alphabet.index(symbol)).toBe(ix);
    });
  });

  test('returns -1 for non-members', () => {
    expect(alphabet.index('\0')).toBe(-1);
    expect(alphabet.index('A')).toBe(-1);
  });
});
