export const movements = {
  left: Symbol('move caret left command'),
  right: Symbol('move caret right command'),
  stay: Symbol('do not move carer'),
};
export const symbolCommands = {
  erase: Symbol('erase symbol command'),
  keep: Symbol('keep symbol command'),
};

type TapeCommandConstructorParam = { movement?: symbol, symbol?: string | symbol };

export default class TapeCommand {
  readonly #movement: typeof movements[keyof typeof movements];
  readonly #symbol;

  constructor({
                movement = movements.stay,
                symbol = symbolCommands.keep,
              }: TapeCommandConstructorParam) {
    const isValidMovement = [movements.left, movements.stay, movements.right].includes(movement);

    if (!isValidMovement) {
      throw new Error('invalid movement');
    }

    this.#movement = movement;

    const isValidSymbol = (
      (typeof symbol === 'string' && symbol.length === 1)
      || [symbolCommands.keep, symbolCommands.erase].includes(symbol as symbol)
    );

    if (!isValidSymbol) {
      throw new Error('invalid symbol');
    }

    this.#symbol = symbol;
  }

  get symbol() {
    return this.#symbol;
  }

  get movement() {
    return this.#movement;
  }
}
