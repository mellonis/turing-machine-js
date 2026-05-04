import Alphabet from './Alphabet';

type TapeConstructorParameter = { alphabet: Alphabet, symbols?: string[], position?: number, viewportWidth?: number };

const BLANK_INDEX = 0;

export default class Tape {
  readonly #alphabet: Alphabet;
  readonly #right: number[] = [];
  readonly #left: number[] = [];

  #position: number;
  #viewportWidth: number;
  #viewportBuffer: string[] = [];
  #viewportDirty = true;

  constructor({
                alphabet, symbols = [], position = 0, viewportWidth = 1,
              }: TapeConstructorParameter) {
    const isSymbolsValid = symbols.every((symbol) => alphabet.has(symbol));

    if (!isSymbolsValid) {
      throw new Error('symbolList contains invalid symbol');
    }

    this.#alphabet = new Alphabet(alphabet);
    this.#position = position;
    this.#viewportWidth = 1;

    const initialSymbols = symbols.length === 0 ? [this.#alphabet.blankSymbol] : symbols;

    for (const symbol of initialSymbols) {
      this.#right.push(this.#alphabet.index(symbol));
    }

    this.viewportWidth = viewportWidth;
  }

  get alphabet() {
    return this.#alphabet;
  }

  get extraCellsCount() {
    return (this.#viewportWidth - 1) / 2;
  }

  get position() {
    // Public contract: index of the head in the `symbols` array. With the
    // two-array deque, `#position` is the head's logical position; adding
    // `#left.length` shifts it back into "index from the leftmost backed cell".
    return this.#position + this.#left.length;
  }

  get symbol() {
    return this.#alphabet.get(this.#cellAt(this.#position));
  }

  set symbol(symbol) {
    if (!this.#alphabet.has(symbol)) {
      throw new Error('Invalid symbol');
    }

    const index = this.#alphabet.index(symbol);

    if (this.#position >= 0) {
      this.#right[this.#position] = index;
    } else {
      this.#left[-this.#position - 1] = index;
    }

    this.#viewportDirty = true;
  }

  get symbols() {
    const result: string[] = new Array(this.#left.length + this.#right.length);

    for (let i = 0; i < this.#left.length; i += 1) {
      result[i] = this.#alphabet.get(this.#left[this.#left.length - 1 - i]);
    }
    for (let i = 0; i < this.#right.length; i += 1) {
      result[this.#left.length + i] = this.#alphabet.get(this.#right[i]);
    }

    return result;
  }

  get viewport() {
    if (this.#viewportDirty) {
      const start = this.#position - this.extraCellsCount;

      for (let i = 0; i < this.#viewportWidth; i += 1) {
        this.#viewportBuffer[i] = this.#alphabet.get(this.#cellAt(start + i));
      }

      this.#viewportDirty = false;
    }

    return [...this.#viewportBuffer];
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
    this.#viewportBuffer.length = finalWidth;
    this.#viewportDirty = true;

    this.normalise();
  }

  left() {
    this.#position -= 1;
    this.normalise();
    this.#viewportDirty = true;
  }

  normalise() {
    const minLogical = this.#position - this.extraCellsCount;
    const maxLogical = this.#position + this.extraCellsCount;

    while (-this.#left.length > minLogical) {
      this.#left.push(BLANK_INDEX);
    }

    while (this.#right.length - 1 < maxLogical) {
      this.#right.push(BLANK_INDEX);
    }
  }

  right() {
    this.#position += 1;
    this.normalise();
    this.#viewportDirty = true;
  }

  #cellAt(logical: number): number {
    if (logical >= 0) {
      return logical < this.#right.length ? this.#right[logical] : BLANK_INDEX;
    }

    const ix = -logical - 1;

    return ix < this.#left.length ? this.#left[ix] : BLANK_INDEX;
  }
}
