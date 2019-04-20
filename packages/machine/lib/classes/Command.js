"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.symbolCommands = exports.movements = exports.default = void 0;
const movements = {
  left: Symbol('move caret left command'),
  right: Symbol('move caret right command'),
  stay: Symbol('do not move carer')
};
exports.movements = movements;
const symbolCommands = {
  erase: Symbol('erase symbol command'),
  keep: Symbol('keep symbol command')
};
exports.symbolCommands = symbolCommands;
const commandSymbolKey = Symbol('commandSymbolKey');
const commandMovementKey = Symbol('commandMovementKey');
const commandNextStateKey = Symbol('commandNextStateKey');

class Command {
  constructor({
    symbol = symbolCommands.keep,
    movement = movements.stay,
    nextState
  }) {
    const isValidSymbol = typeof symbol === 'string' && symbol.length === 1 || symbol === symbolCommands.keep || symbol === symbolCommands.erase;

    if (!isValidSymbol) {
      throw new Error('Invalid symbol');
    }

    this[commandSymbolKey] = symbol;
    const isValidMovement = movement === movements.left || movement === movements.stay || movement === movements.right;

    if (!isValidMovement) {
      throw new Error('Invalid movement');
    }

    this[commandMovementKey] = movement;
    this[commandNextStateKey] = nextState;
  }

  get symbol() {
    return this[commandSymbolKey];
  }

  get movement() {
    return this[commandMovementKey];
  }

  get nextState() {
    return this[commandNextStateKey];
  }

}

exports.default = Command;