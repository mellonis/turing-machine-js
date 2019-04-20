import { uniquePredicate } from '../utilities/functions';
import Command from './Command';

const stateSymbolToCommandMapKey = Symbol('stateSymbolToCommandMapKey');
const stateOverrodeHaltStateKey = Symbol('stateOverrodeHaltStateKey');
const stateNameKey = Symbol('stateNameKey');
const ifOtherSymbol = Symbol('other symbol');

class State {
  constructor(stateDefinition = null, name) {
    if (stateDefinition) {
      this[stateNameKey] = typeof name === 'string' ? name : null;
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
        key.split('').forEach((symbol) => {
          this[stateSymbolToCommandMapKey].set(symbol, new Command({
            nextState: this,
            ...stateDefinition[key],
          }));
        });
      });

      if (stateDefinition[ifOtherSymbol]) {
        this[stateSymbolToCommandMapKey].set(ifOtherSymbol, new Command({
          nextState: this,
          ...stateDefinition[ifOtherSymbol],
        }));
      }
    } else {
      this[stateNameKey] = '__HALT__';
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

    throw new Error(`No command for symbol '${symbol}' at state named ${this[stateNameKey]}`);
  }

  get isHalt() {
    return !this[stateSymbolToCommandMapKey];
  }

  get name() {
    return this[stateNameKey];
  }

  get overrodeHaltState() {
    return this[stateOverrodeHaltStateKey];
  }

  withOverrodeHaltState(overrodeHaltState) {
    const state = new State(null);

    state[stateSymbolToCommandMapKey] = this[stateSymbolToCommandMapKey];
    state[stateOverrodeHaltStateKey] = overrodeHaltState;
    state[stateNameKey] = `${this[stateNameKey]}>${overrodeHaltState[stateNameKey]}`;

    return state;
  }
}

const haltState = new State(null);

export {
  State as default,
  haltState,
  ifOtherSymbol,
};
