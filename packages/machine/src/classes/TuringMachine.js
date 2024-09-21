import State, { haltState } from './State';
import TapeBlock, { lockSymbol } from './TapeBlock';
import { symbolCommands } from './TapeCommand';

export default class TuringMachine {
  #tapeBlock;

  #stack;

  constructor({
    tapeBlock,
  }) {
    this.#tapeBlock = tapeBlock;

    if (!(this.#tapeBlock instanceof TapeBlock)) {
      throw new Error('invalid tapeBlock');
    }

    this.#stack = [];
  }

  get tapeBlock() {
    return this.#tapeBlock;
  }

  run({ initialState, stepsLimit = 1e5, onStep = null } = {}) {
    const generator = this.runStepByStep({ initialState, stepsLimit });

    // eslint-disable-next-line no-restricted-syntax
    for (const machineState of generator) {
      if (onStep instanceof Function) {
        onStep(machineState);
      }
    }
  }

  * runStepByStep({ initialState, stepsLimit = 1e5 } = {}) {
    const executionSymbol = Symbol('execution');

    try {
      this.#tapeBlock[lockSymbol].check(executionSymbol);
      this.#tapeBlock[lockSymbol].lock(executionSymbol);

      if (!(initialState instanceof State)) {
        throw new Error('Invalid parameters');
      }

      const stack = this.#stack; // cope reference to use in generator
      let state = initialState;

      if (state.overrodeHaltState) {
        stack.push(state.overrodeHaltState);
      }

      let i = 0;

      while (!state.isHalt) {
        if (i === stepsLimit) {
          throw new Error('Long execution');
        }

        i += 1;

        const symbol = state.getSymbol(this.#tapeBlock);
        const command = state.getCommand(symbol);
        let nextState = state.getNextState(symbol).ref;

        try {
          const nextStateForYield = nextState.isHalt && stack.length
            ? stack.slice(-1)[0]
            : nextState;

          yield {
            step: i,
            state,
            currentSymbolList: this.#tapeBlock.currentSymbolList,
            nextSymbolList: command.tapeCommandList.map((tapeCommand, ix) => {
              switch (tapeCommand.symbol) {
                case symbolCommands.erase:
                  return this.#tapeBlock.tapeList[ix].alphabet.blankSymbol;
                case symbolCommands.keep:
                  return this.#tapeBlock.tapeList[ix].symbol;
                default:
                  return tapeCommand.symbol;
              }
            }),
            movementList: command.tapeCommandList.map((tapeCommand) => tapeCommand.movement),
            nextState: nextStateForYield,
          };

          this.#tapeBlock.applyCommand(command, executionSymbol);

          if (nextState.isHalt && stack.length) {
            nextState = stack.pop();
          }

          if (state !== nextState && nextState.overrodeHaltState) {
            stack.push(nextState.overrodeHaltState);
          }

          state = nextState;
        } catch (error) {
          if (error !== haltState) {
            throw error;
          }

          break;
        }
      }
    } finally {
      this.#tapeBlock[lockSymbol].unlock(executionSymbol);
    }
  }
}
