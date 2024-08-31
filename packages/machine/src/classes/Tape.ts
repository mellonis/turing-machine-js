import Alphabet from './Alphabet';

type TapeConstructorParameter = { alphabet: Alphabet, symbols?: string[], position?: number, viewportWidth?: number };

export default class Tape {
  readonly #alphabet: Alphabet;
  readonly #symbols: number[];

  #position;
  #viewportWidth: number;

  constructor({
                alphabet, symbols = [], position = 0, viewportWidth = 1,
              }: TapeConstructorParameter) {
    const isSymbolsValid = symbols.every((symbol) => alphabet.has(symbol));

    if (!isSymbolsValid) {
      throw new Error('symbolList contains invalid symbol');
    }

    this.#alphabet = new Alphabet(alphabet);
    this.#position = position;
    this.#viewportWidth = viewportWidth;

    const symbolsCopy = Array.from(symbols);

    if (symbolsCopy.length === 0) {
      symbolsCopy.push(this.#alphabet.blankSymbol);
    }

    this.#symbols = symbolsCopy.map((symbol) => this.#alphabet.index(symbol));
  }

  get alphabet() {
    return this.#alphabet;
  }

  get extraCellsCount() {
    return (this.#viewportWidth - 1) / 2;
  }

  get position() {
    return this.#position;
  }

  get symbol() {
    return this.#alphabet.get(this.#symbols[this.#position]);
  }

  set symbol(symbol) {
    if (!this.#alphabet.has(symbol)) {
      throw new Error('Invalid symbol');
    }

    this.#symbols[this.#position] = this.#alphabet.index(symbol);
  }

  get symbols() {
    return this.#symbols
      .map((index) => this.#alphabet.get(index));
  }

  get viewport() {
    const startIx = this.#position - this.extraCellsCount;
    const endIx = this.#position + this.extraCellsCount + 1;

    return this.#symbols
      .slice(startIx, endIx)
      .map((index) => this.#alphabet.get(index));
  }

  get viewportWidth() {
    return this.#viewportWidth;
  }

  set viewportWidth(width) {
    let finalWidth = width;

    if (finalWidth < 1) {
      throw new Error('Invalid viewportWidth');
    }

    if (finalWidth % 2 === 0) {
      finalWidth += 1;
    }

    this.#viewportWidth = finalWidth;

    this.normalise();
  }

  left() {
    this.#position -= 1;
    this.normalise();
  }

  normalise() {
    while (this.#position - this.extraCellsCount < 0) {
      this.#symbols.unshift(0);
      this.#position += 1;
    }

    while (this.#position + this.extraCellsCount >= this.#symbols.length) {
      this.#symbols.push(0);
    }
  }

  right() {
    this.#position += 1;
    this.normalise();
  }
}
