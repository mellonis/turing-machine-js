import State from './State';
import { movements, symbolCommands } from './Command';

// keys for private properties of the TuringMachine class
const tapeTapeKey = Symbol('commandSymbolKey');
const tapeStackKey = Symbol('commandMovementKey');

class TuringMachine {
  constructor(tape = null) {
    this[tapeTapeKey] = tape;
    this[tapeStackKey] = [];
  }

  run(initialState, stepsLimit = 1e5, onStep = null) {
    const iterator = this.runStepByStep(initialState, stepsLimit);

    // eslint-disable-next-line no-restricted-syntax
    for (const machineState of iterator) {
      if (onStep instanceof Function) {
        onStep(machineState);
      }
    }
  }

  * runStepByStep(initialState, stepsLimit = 1e5) {
    if (!(initialState instanceof State)) {
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
        case symbolCommands.erase:
          nextSymbol = this[tapeTapeKey].alphabet.blankSymbol;
          break;
        case symbolCommands.keep:
          nextSymbol = currentSymbol;
          break;
        default:
          nextSymbol = command.symbol;
          break;
      }

      const { movement: nextMovement, nextState } = command;

      if (!(nextState instanceof State)) {
        throw new Error('Invalid nextState');
      }

      // before apply

      try {
        const nextStateForYield = nextState.isHalt && this[tapeStackKey].length
          ? this[tapeStackKey].slice(-1)[0]
          : nextState;

        yield {
          step: i,
          state,
          currentSymbol,
          nextSymbol,
          nextMovement,
          nextState: nextStateForYield,
        };
      } catch (e) {
        throw new Error(`Execution halted because of ${e.message}`);
      }

      // apply

      this[tapeTapeKey].symbol = nextSymbol;

      switch (nextMovement) {
        case movements.left:
          this[tapeTapeKey].left();
          break;
        case movements.right:
          this[tapeTapeKey].right();
          break;

        // no default
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

export {
  TuringMachine as default,
};
