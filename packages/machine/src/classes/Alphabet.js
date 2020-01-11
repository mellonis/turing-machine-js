import { uniquePredicate } from '../utilities/functions';

export default class Alphabet {
  #symbolList;

  constructor({ symbolList = [] } = {}) {
    const uniqueSymbolList = symbolList.filter(uniquePredicate);

    if (uniqueSymbolList.length < 2) {
      throw new Error('Invalid symbolList length');
    }

    const isSymbolListValid = uniqueSymbolList.every((symbol) => typeof symbol === 'string' && symbol.length === 1);

    if (!isSymbolListValid) {
      throw new Error('symbolList contains invalid symbol');
    }

    this.#symbolList = Array.from(uniqueSymbolList);
  }

  get symbolList() {
    return Array.from(this.#symbolList);
  }

  get blankSymbol() {
    return this.#symbolList[0];
  }

  has(symbol) {
    return this.#symbolList.indexOf(symbol) >= 0;
  }

  get(index) {
    if (index < 0 || index >= this.#symbolList.length) {
      throw new Error('Invalid index');
    }

    return this.#symbolList[index];
  }

  index(symbol) {
    return this.#symbolList.indexOf(symbol);
  }
}
