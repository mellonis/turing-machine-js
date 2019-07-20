import { id, uniquePredicate } from '../utilities/functions';
import { Reference } from '../utilities/classes';
import Command from './Command';

const stateSymbolToCommandMapKey = Symbol('stateSymbolToCommandMapKey');
const stateOverrodeHaltStateKey = Symbol('stateOverrodeHaltStateKey');
const stateIdKey = Symbol('stateNameKey');
const ifOtherSymbol = Symbol('other symbol');

class State {
  constructor(stateDefinition = null) {
    this[stateIdKey] = id(this);

    if (stateDefinition) {
      this[stateSymbolToCommandMapKey] = new Map();

      let isValidStateDefinition = true;
      const keyList = Object.keys(stateDefinition);

      if (keyList.some(symbol => symbol.length === 0)) {
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
        const nextState = stateDefinition[key].nextState || this;

        if (nextState instanceof State || nextState instanceof Reference) {
          key.split('').forEach((symbol) => {
            this[stateSymbolToCommandMapKey].set(symbol, new Command({
              ...stateDefinition[key],
              nextState,
            }));
          });
        } else {
          throw new Error('Invalid nextState');
        }
      });

      if (stateDefinition[ifOtherSymbol]) {
        const nextState = stateDefinition[ifOtherSymbol].nextState || this;

        if (nextState instanceof State || nextState instanceof Reference) {
          this[stateSymbolToCommandMapKey].set(ifOtherSymbol, new Command({
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

    if (this[stateSymbolToCommandMapKey].has(symbol)) {
      return this[stateSymbolToCommandMapKey].get(symbol);
    }

    if (this[stateSymbolToCommandMapKey].has(ifOtherSymbol)) {
      return this[stateSymbolToCommandMapKey].get(ifOtherSymbol);
    }

    throw new Error(`No command for symbol '${symbol}' at state named ${this[stateIdKey]}`);
  }

  get isHalt() {
    return !this[stateSymbolToCommandMapKey];
  }

  get id() {
    return this[stateIdKey];
  }

  get overrodeHaltState() {
    return this[stateOverrodeHaltStateKey];
  }

  get ref() {
    return this;
  }

  withOverrodeHaltState(overrodeHaltState) {
    const state = new State(null);

    state[stateSymbolToCommandMapKey] = this[stateSymbolToCommandMapKey];
    state[stateOverrodeHaltStateKey] = overrodeHaltState;
    state[stateIdKey] = `${this[stateIdKey]}>${overrodeHaltState[stateIdKey]}`;

    return state;
  }
}

const haltState = new State(null);

export {
  State as default,
  haltState,
  ifOtherSymbol,
};
