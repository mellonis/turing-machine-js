"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _functions = require("../utilities/functions");

const alphabetSymbolListKey = Symbol('alphabetSymbolListKey');

class Alphabet {
  constructor(symbolList = []) {
    const uniqueSymbolList = symbolList.filter(_functions.uniquePredicate);

    if (uniqueSymbolList.length < 2) {
      throw new Error('Invalid symbolList length');
    }

    const isSymbolListValid = uniqueSymbolList.every(symbol => typeof symbol === 'string' && symbol.length === 1);

    if (!isSymbolListValid) {
      throw new Error('symbolList contains invalid symbol');
    }

    this[alphabetSymbolListKey] = Array.from(uniqueSymbolList);
  }

  get symbolList() {
    return Array.from(this[alphabetSymbolListKey]);
  }

  get blankSymbol() {
    return this[alphabetSymbolListKey][0];
  }

  has(symbol) {
    return this[alphabetSymbolListKey].indexOf(symbol) >= 0;
  }

  get(index) {
    if (index < 0 || index >= this[alphabetSymbolListKey].length) {
      throw new Error('Invalid index');
    }

    return this[alphabetSymbolListKey][index];
  }

  index(symbol) {
    return this[alphabetSymbolListKey].indexOf(symbol);
  }

}

exports.default = Alphabet;