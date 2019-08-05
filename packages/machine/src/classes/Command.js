import State from './State';
import Reference from './Reference';

const movements = {
  left: Symbol('move caret left command'),
  right: Symbol('move caret right command'),
  stay: Symbol('do not move carer'),
};
const symbolCommands = {
  erase: Symbol('erase symbol command'),
  keep: Symbol('keep symbol command'),
};

class Command {
  #symbol;
  #movement;
  #nextState;

  constructor({
    movement = movements.stay,
    symbol = symbolCommands.keep,
    nextState,
  } = {}) {
    const isValidMovement = (
      movement === movements.left
      || movement === movements.stay
      || movement === movements.right
    );

    if (!isValidMovement) {
      throw new Error('Invalid movement');
    }

    this.#movement = movement;

    const isValidSymbol = (
      (typeof symbol === 'string' && symbol.length === 1)
      || symbol === symbolCommands.keep
      || symbol === symbolCommands.erase
    );

    if (!isValidSymbol) {
      throw new Error('Invalid symbol');
    }

    this.#symbol = symbol;

    const isValidNextState = (
      nextState instanceof State
      || nextState instanceof Reference
    );

    if (!isValidNextState) {
      throw new Error('Invalid nextStep');
    }

    this.#nextState = nextState;
  }

  get symbol() {
    return this.#symbol;
  }

  get movement() {
    return this.#movement;
  }

  get nextState() {
    return this.#nextState;
  }
}

export {
  Command as default,
  movements,
  symbolCommands,
};
