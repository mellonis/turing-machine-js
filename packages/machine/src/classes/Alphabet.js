import { uniquePredicate } from '../utilities/functions';

// keys for private properties of the Alphabet class
const alphabetSymbolListKey = Symbol('alphabetSymbolListKey');

export default class Alphabet {
  constructor(symbolList = []) {
    const uniqueSymbolList = symbolList.filter(uniquePredicate);

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
    if (index < 0 && index >= this[alphabetSymbolListKey].length) {
      throw new Error('Invalid index');
    }

    return this[alphabetSymbolListKey][index];
  }

  index(symbol) {
    return this[alphabetSymbolListKey].indexOf(symbol);
  }
}
