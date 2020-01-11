import Alphabet from './Alphabet';

export default class Tape {
  #alphabet;

  #symbolList;

  #position;

  #viewportWidth;

  constructor({
    alphabet, symbolList = [], position = 0, viewportWidth = 1,
  } = {}) {
    if (!(alphabet instanceof Alphabet)) {
      throw new Error('Invalid alphabet');
    }

    const isSymbolListValid = symbolList.every((symbol) => alphabet.has(symbol));

    if (!isSymbolListValid) {
      throw new Error('symbolList contains invalid symbol');
    }

    this.#alphabet = new Alphabet(alphabet);
    this.#symbolList = Array.from(symbolList);
    this.#position = position;

    if (this.#symbolList.length === 0) {
      this.#symbolList.push(this.#alphabet.blankSymbol);
    }

    this.#symbolList = this.#symbolList
      .map((symbol) => this.#alphabet.index(symbol));
    this.viewportWidth = viewportWidth;
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
    return this.#alphabet.get(this.#symbolList[this.#position]);
  }

  set symbol(symbol) {
    if (!this.#alphabet.has(symbol)) {
      throw new Error('Invalid symbol');
    }

    this.#symbolList[this.#position] = this.#alphabet.index(symbol);
  }

  get symbolList() {
    return this.#symbolList
      .map((index) => this.#alphabet.get(index));
  }

  get viewport() {
    const startIx = this.#position - this.extraCellsCount;
    const endIx = this.#position + this.extraCellsCount + 1;

    return this.#symbolList
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
      this.#symbolList.unshift(0);
      this.#position += 1;
    }

    while (this.#position + this.extraCellsCount >= this.#symbolList.length) {
      this.#symbolList.push(0);
    }
  }

  right() {
    this.#position += 1;
    this.normalise();
  }
}
