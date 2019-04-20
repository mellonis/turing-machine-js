"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ifOtherSymbol = exports.haltState = exports.default = void 0;

var _functions = require("../utilities/functions");

var _Command = _interopRequireDefault(require("./Command"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const stateSymbolToCommandMapKey = Symbol('stateSymbolToCommandMapKey');
const stateOverrodeHaltStateKey = Symbol('stateOverrodeHaltStateKey');
const stateNameKey = Symbol('stateNameKey');
const ifOtherSymbol = Symbol('other symbol');
exports.ifOtherSymbol = ifOtherSymbol;

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

      if (symbolList.length !== symbolList.filter(_functions.uniquePredicate).length) {
        isValidStateDefinition = false;
      }

      if (!isValidStateDefinition) {
        throw new Error('Invalid state definition');
      }

      keyList.forEach(key => {
        key.split('').forEach(symbol => {
          this[stateSymbolToCommandMapKey].set(symbol, new _Command.default({
            nextState: this,
            ...stateDefinition[key]
          }));
        });
      });

      if (stateDefinition[ifOtherSymbol]) {
        this[stateSymbolToCommandMapKey].set(ifOtherSymbol, new _Command.default({
          nextState: this,
          ...stateDefinition[ifOtherSymbol]
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

exports.default = State;
const haltState = new State(null);
exports.haltState = haltState;