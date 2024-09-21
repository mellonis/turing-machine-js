import { uniquePredicate } from '../utilities/functions';

export default class Alphabet {
  readonly #symbols: string[];

  constructor(symbols: string[] | Alphabet) {
    if (symbols instanceof Alphabet) {
      symbols = symbols.symbols;
    }

    const uniqueSymbols = symbols.filter(uniquePredicate);

    if (uniqueSymbols.length < 2) {
      throw new Error('Invalid symbols length');
    }

    const isSymbolsValid = uniqueSymbols.every((symbol) => symbol.length === 1);

    if (!isSymbolsValid) {
      throw new Error('symbols contains invalid symbol');
    }

    this.#symbols = Array.from(uniqueSymbols);
  }

  get symbols() {
    return Array.from(this.#symbols);
  }

  get blankSymbol() {
    return this.#symbols[0];
  }

  has(symbol: string) {
    return this.#symbols.indexOf(symbol) >= 0;
  }

  get(index: number) {
    if (index < 0 || index >= this.#symbols.length) {
      throw new Error('Invalid index');
    }

    return this.#symbols[index];
  }

  index(symbol: string) {
    return this.#symbols.indexOf(symbol);
  }
}
