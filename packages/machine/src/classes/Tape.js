import Alphabet from './Alphabet';

// keys for private properties of the Tape class
const tapeAlphabetKey = Symbol('tapeAlphabetKey');
const tapeSymbolListKey = Symbol('tapeSymbolListKey');
const tapePositionKey = Symbol('tapePositionKey');
const tapeViewportWidthKey = Symbol('tapeViewportWidthKey');

export default class Tape {
  constructor({
    tapeSymbolList = [],
    position = 0,
    alphabetSymbolList = null,
    viewportWidth = 1,
  }) {
    this[tapePositionKey] = position;
    this[tapeSymbolListKey] = Array.from(tapeSymbolList);

    if (this[tapeSymbolListKey].length === 0) {
      if (!alphabetSymbolList) {
        throw new Error('Invalid parameters');
      } else {
        this[tapeAlphabetKey] = new Alphabet(alphabetSymbolList);
        this[tapeSymbolListKey].push(this[tapeAlphabetKey].blankSymbol);
      }
    } else if (!alphabetSymbolList) {
      this[tapeAlphabetKey] = new Alphabet(this[tapeSymbolListKey]);
    } else {
      this[tapeAlphabetKey] = new Alphabet(alphabetSymbolList);

      const isValidTape = this[tapeSymbolListKey]
        .every(symbol => this[tapeAlphabetKey].has(symbol));

      if (!isValidTape) {
        throw new Error('Invalid tapeSymbolList');
      }
    }

    this[tapeSymbolListKey] = this[tapeSymbolListKey]
      .map(symbol => this[tapeAlphabetKey].index(symbol));
    this.viewportWidth = viewportWidth;
  }

  get alphabet() {
    return this[tapeAlphabetKey];
  }

  set symbol(symbol) {
    if (!this[tapeAlphabetKey].has(symbol)) {
      throw new Error('Invalid symbol');
    }

    this[tapeSymbolListKey][this[tapePositionKey]] = this[tapeAlphabetKey].index(symbol);
  }

  get symbol() {
    return this[tapeAlphabetKey].get(this[tapeSymbolListKey][this[tapePositionKey]]);
  }

  get symbolList() {
    const startIx = this[tapePositionKey] - this.extraCellsCount;
    const endIx = this[tapePositionKey] + this.extraCellsCount + 1;

    return this[tapeSymbolListKey]
      .slice(startIx, endIx)
      .map(index => this[tapeAlphabetKey].get(index));
  }

  get viewportWidth() {
    return this[tapeViewportWidthKey];
  }

  set viewportWidth(width) {
    let finalWidth = width;

    if (finalWidth < 1) {
      throw new Error('Invalid width');
    }

    if (finalWidth % 2 === 0) {
      finalWidth += 1;
    }

    this[tapeViewportWidthKey] = finalWidth;

    this.normalise();
  }

  get extraCellsCount() {
    return (this[tapeViewportWidthKey] - 1) / 2;
  }

  normalise() {
    while (this[tapePositionKey] - this.extraCellsCount < 0) {
      this[tapeSymbolListKey].unshift(0);
      this[tapePositionKey] += 1;
    }

    while (this[tapePositionKey] + this.extraCellsCount >= this[tapeSymbolListKey].length) {
      this[tapeSymbolListKey].push(0);
    }
  }

  right() {
    this[tapePositionKey] += 1;
    this.normalise();
  }

  left() {
    this[tapePositionKey] -= 1;
    this.normalise();
  }
}
