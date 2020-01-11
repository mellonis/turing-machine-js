import { id, uniquePredicate } from '../utilities/functions';
// eslint-disable-next-line import/no-cycle
import Command from './Command';
import Reference from './Reference';

const ifOtherSymbol = Symbol('other symbol');

class State {
  #stateId = id(this);

  #stateSymbolToCommandMap;

  #stateOverrodeHaltState;

  constructor(stateDefinition = null) {
    if (stateDefinition) {
      this.#stateSymbolToCommandMap = new Map();

      let isValidStateDefinition = true;
      const keyList = Object.keys(stateDefinition);

      if (keyList.some((symbol) => symbol.length === 0)) {
        isValidStateDefinition = false;
      }

      const symbolList = keyList.join('').split('');

      if (symbolList.length !== symbolList.filter(uniquePredicate).length) {
        isValidStateDefinition = false;
      }

      if (!isValidStateDefinition) {
        throw new Error('Invalid state definition');
      }

      keyList.forEach((key) => {
        const nextState = stateDefinition[key].nextState == null
          ? this
          : stateDefinition[key].nextState;

        if (nextState instanceof State || nextState instanceof Reference) {
          key.split('').forEach((symbol) => {
            this.#stateSymbolToCommandMap.set(symbol, new Command({
              ...stateDefinition[key],
              nextState,
            }));
          });
        } else {
          throw new Error('Invalid nextState');
        }
      });

      if (stateDefinition[ifOtherSymbol]) {
        const nextState = stateDefinition[ifOtherSymbol].nextState == null
          ? this
          : stateDefinition[ifOtherSymbol].nextState;

        if (nextState instanceof State || nextState instanceof Reference) {
          this.#stateSymbolToCommandMap.set(ifOtherSymbol, new Command({
            ...stateDefinition[ifOtherSymbol],
            nextState,
          }));
        } else {
          throw new Error('Invalid nextState');
        }
      }
    }
  }

  getCommand(symbol) {
    if (symbol.length !== 1) {
      throw new Error('Invalid symbol');
    }

    if (this.#stateSymbolToCommandMap && this.#stateSymbolToCommandMap.has(symbol)) {
      return this.#stateSymbolToCommandMap.get(symbol);
    }

    if (this.#stateSymbolToCommandMap && this.#stateSymbolToCommandMap.has(ifOtherSymbol)) {
      return this.#stateSymbolToCommandMap.get(ifOtherSymbol);
    }

    throw new Error(`No command for symbol '${symbol}' at state named ${this.#stateId}`);
  }

  get isHalt() {
    return !this.#stateSymbolToCommandMap;
  }

  get id() {
    return this.#stateId;
  }

  get overrodeHaltState() {
    return this.#stateOverrodeHaltState;
  }

  get ref() {
    return this;
  }

  withOverrodeHaltState(overrodeHaltState) {
    const state = new State(null);

    state.#stateSymbolToCommandMap = this.#stateSymbolToCommandMap;
    state.#stateOverrodeHaltState = overrodeHaltState;
    state.#stateId = `${this.#stateId}>${overrodeHaltState.#stateId}`;

    return state;
  }
}

const haltState = new State(null);

export {
  State as default,
  haltState,
  ifOtherSymbol,
};
