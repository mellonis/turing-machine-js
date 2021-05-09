export const movements = {
  left: Symbol('move caret left command'),
  right: Symbol('move caret right command'),
  stay: Symbol('do not move carer'),
};
export const symbolCommands = {
  erase: Symbol('erase symbol command'),
  keep: Symbol('keep symbol command'),
};

export default class TapeCommand {
  #movement;

  #symbol;

  constructor({
    movement = movements.stay,
    symbol = symbolCommands.keep,
  }) {
    const isValidMovement = (
      movement === movements.left
      || movement === movements.stay
      || movement === movements.right
    );

    if (!isValidMovement) {
      throw new Error('invalid movement');
    }

    this.#movement = movement;

    const isValidSymbol = (
      (typeof symbol === 'string' && symbol.length === 1)
      || symbol === symbolCommands.keep
      || symbol === symbolCommands.erase
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
