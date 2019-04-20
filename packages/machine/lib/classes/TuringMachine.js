"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _State = _interopRequireDefault(require("./State"));

var _Command = require("./Command");

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

    let state = initialState;

    if (state.overrodeHaltState) {
      this[tapeStackKey].push(state.overrodeHaltState);
    }

    let i = 0;

    while (!state.isHalt) {
      if (i > stepsLimit) {
        throw new Error('Long execution');
      }

      i += 1;
      const currentSymbol = this[tapeTapeKey].symbol;
      const command = state.getCommand(currentSymbol);
      let nextSymbol;

      switch (command.symbol) {
        case _Command.symbolCommands.erase:
          nextSymbol = this[tapeTapeKey].alphabet.blankSymbol;
          break;

        case _Command.symbolCommands.keep:
          nextSymbol = currentSymbol;
          break;

        default:
          nextSymbol = command.symbol;
          break;
      }

      const {
        movement: nextMovement,
        nextState
      } = command;

      if (!(nextState instanceof _State.default)) {
        throw new Error('Invalid nextState');
      }

      try {
        const nextStateForYield = nextState.isHalt && this[tapeStackKey].length ? this[tapeStackKey].slice(-1)[0] : nextState;
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

      this[tapeTapeKey].symbol = nextSymbol;

      switch (nextMovement) {
        case _Command.movements.left:
          this[tapeTapeKey].left();
          break;

        case _Command.movements.right:
          this[tapeTapeKey].right();
          break;
      }

      let finalNextState = nextState;

      if (finalNextState.isHalt && this[tapeStackKey].length) {
        finalNextState = this[tapeStackKey].pop();
      }

      if (state !== finalNextState && finalNextState.overrodeHaltState) {
        this[tapeStackKey].push(finalNextState.overrodeHaltState);
      }

      state = finalNextState;
    }
  }

}

exports.default = TuringMachine;