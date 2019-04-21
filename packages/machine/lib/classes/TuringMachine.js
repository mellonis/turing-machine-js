"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _State = _interopRequireDefault(require("./State"));

var _Command = require("./Command");

var _classes = require("../utilities/classes");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const tapeTapeKey = Symbol('commandSymbolKey');
const tapeStackKey = Symbol('commandMovementKey');

class TuringMachine {
  constructor(tape = null) {
    this[tapeTapeKey] = tape;
    this[tapeStackKey] = [];
  }

  run(initialState, stepsLimit = 1e5, onStep = null) {
    const iterator = this.runStepByStep(initialState, stepsLimit);

    for (const machineState of iterator) {
      if (onStep instanceof Function) {
        onStep(machineState);
      }
    }
  }

  *runStepByStep(initialState, stepsLimit = 1e5) {
    if (!(initialState instanceof _State.default)) {
      throw new Error('Invalid parameters');
    }

    const stack = this[tapeStackKey];
    let state = initialState;

    if (state.overrodeHaltState) {
      stack.push(state.overrodeHaltState);
    }

    let i = 0;

    while (!state.isHalt) {
      if (i > stepsLimit) {
        throw new Error('Long execution');
      }

      i += 1;
      const tape = this[tapeTapeKey];
      const currentSymbol = tape.symbol;
      const command = state.getCommand(currentSymbol);
      let nextSymbol;

      switch (command.symbol) {
        case _Command.symbolCommands.erase:
          nextSymbol = tape.alphabet.blankSymbol;
          break;

        case _Command.symbolCommands.keep:
          nextSymbol = currentSymbol;
          break;

        default:
          nextSymbol = command.symbol;
          break;
      }

      const nextMovement = command.movement;

      if (!(command.nextState instanceof _State.default || command.nextState instanceof _classes.Reference)) {
        throw new Error('Invalid nextState');
      }

      let nextState = command.nextState.ref;

      try {
        const nextStateForYield = nextState.isHalt && stack.length ? stack.slice(-1)[0] : nextState;
        yield {
          step: i,
          state,
          currentSymbol,
          nextSymbol,
          nextMovement,
          nextState: nextStateForYield
        };
      } catch (e) {
        throw new Error(`Execution halted because of ${e.message}`);
      }

      tape.symbol = nextSymbol;

      switch (nextMovement) {
        case _Command.movements.left:
          tape.left();
          break;

        case _Command.movements.right:
          tape.right();
          break;
      }

      if (nextState.isHalt && stack.length) {
        nextState = stack.pop();
      }

      if (state !== nextState && nextState.overrodeHaltState) {
        stack.push(nextState.overrodeHaltState);
      }

      state = nextState;
    }
  }

}

exports.default = TuringMachine;