import State from './State';
import { movements, symbolCommands } from './Command';
import { Reference } from '../utilities/classes';

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
        case symbolCommands.erase:
          nextSymbol = tape.alphabet.blankSymbol;
          break;
        case symbolCommands.keep:
          nextSymbol = currentSymbol;
          break;
        default:
          nextSymbol = command.symbol;
          break;
      }

      const nextMovement = command.movement;

      if (!(
        command.nextState instanceof State
        || command.nextState instanceof Reference
      )) {
        throw new Error('Invalid nextState');
      }

      let nextState = command.nextState.ref;

      // before apply

      try {
        const nextStateForYield = nextState.isHalt && stack.length
          ? stack.slice(-1)[0]
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

      tape.symbol = nextSymbol;

      switch (nextMovement) {
        case movements.left:
          tape.left();
          break;
        case movements.right:
          tape.right();
          break;

        // no default
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

export {
  TuringMachine as default,
};
