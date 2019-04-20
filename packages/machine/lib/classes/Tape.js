"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _Alphabet = _interopRequireDefault(require("./Alphabet"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const tapeAlphabetKey = Symbol('tapeAlphabetKey');
const tapeSymbolListKey = Symbol('tapeSymbolListKey');
const tapePositionKey = Symbol('tapePositionKey');
const tapeViewportWidthKey = Symbol('tapeViewportWidthKey');

class Tape {
  constructor({
    alphabet,
    symbolList = [],
    position = 0,
    viewportWidth = 1
  } = {}) {
    if (!(alphabet instanceof _Alphabet.default)) {
      throw new Error('Invalid alphabet');
    }

    const isSymbolListValid = symbolList.every(symbol => alphabet.has(symbol));

    if (!isSymbolListValid) {
      throw new Error('symbolList contains invalid symbol');
    }

    this[tapeAlphabetKey] = new _Alphabet.default(alphabet);
    this[tapeSymbolListKey] = Array.from(symbolList);
    this[tapePositionKey] = position;

    if (this[tapeSymbolListKey].length === 0) {
      this[tapeSymbolListKey].push(this[tapeAlphabetKey].blankSymbol);
    }

    this[tapeSymbolListKey] = this[tapeSymbolListKey].map(symbol => this[tapeAlphabetKey].index(symbol));
    this.viewportWidth = viewportWidth;
  }

  get alphabet() {
    return this[tapeAlphabetKey];
  }

  get extraCellsCount() {
    return (this[tapeViewportWidthKey] - 1) / 2;
  }

  get position() {
    return this[tapePositionKey];
  }

  get symbol() {
    return this[tapeAlphabetKey].get(this[tapeSymbolListKey][this[tapePositionKey]]);
  }

  set symbol(symbol) {
    if (!this[tapeAlphabetKey].has(symbol)) {
      throw new Error('Invalid symbol');
    }

    this[tapeSymbolListKey][this[tapePositionKey]] = this[tapeAlphabetKey].index(symbol);
  }

  get symbolList() {
    return this[tapeSymbolListKey].map(index => this[tapeAlphabetKey].get(index));
  }

  get viewport() {
    const startIx = this[tapePositionKey] - this.extraCellsCount;
    const endIx = this[tapePositionKey] + this.extraCellsCount + 1;
    return this[tapeSymbolListKey].slice(startIx, endIx).map(index => this[tapeAlphabetKey].get(index));
  }

  get viewportWidth() {
    return this[tapeViewportWidthKey];
  }

  set viewportWidth(width) {
    let finalWidth = width;

    if (finalWidth < 1) {
      throw new Error('Invalid viewportWidth');
    }

    if (finalWidth % 2 === 0) {
      finalWidth += 1;
    }

    this[tapeViewportWidthKey] = finalWidth;
    this.normalise();
  }

  left() {
    this[tapePositionKey] -= 1;
    this.normalise();
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

}

exports.default = Tape;