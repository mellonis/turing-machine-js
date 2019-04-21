"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ifOtherSymbol = exports.haltState = exports.default = void 0;

var _functions = require("../utilities/functions");

var _classes = require("../utilities/classes");

var _Command = _interopRequireDefault(require("./Command"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const stateSymbolToCommandMapKey = Symbol('stateSymbolToCommandMapKey');
const stateOverrodeHaltStateKey = Symbol('stateOverrodeHaltStateKey');
const stateIdKey = Symbol('stateNameKey');
const ifOtherSymbol = Symbol('other symbol');
exports.ifOtherSymbol = ifOtherSymbol;

class State {
  constructor(stateDefinition = null) {
    this[stateIdKey] = (0, _functions.id)(this);

    if (stateDefinition) {
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
        const nextState = stateDefinition[key].nextState || this;

        if (nextState instanceof State || nextState instanceof _classes.Reference) {
          key.split('').forEach(symbol => {
            this[stateSymbolToCommandMapKey].set(symbol, new _Command.default({ ...stateDefinition[key],
              nextState
            }));
          });
        } else {
          throw new Error('Invalid nextState');
        }
      });

      if (stateDefinition[ifOtherSymbol]) {
        const nextState = stateDefinition[ifOtherSymbol].nextState || this;

        if (nextState instanceof State || nextState instanceof _classes.Reference) {
          this[stateSymbolToCommandMapKey].set(ifOtherSymbol, new _Command.default({ ...stateDefinition[ifOtherSymbol],
            nextState
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

exports.default = State;
const haltState = new State(null);
exports.haltState = haltState;
