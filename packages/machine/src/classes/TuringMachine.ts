import State, {haltState} from './State';
import TapeBlock from './TapeBlock';
import {symbolCommands} from './TapeCommand';

type RunParameter = { initialState: State, stepsLimit?: number };

export type MachineState = {
  step: number;
  state: State;
  currentSymbols: string[];
  nextSymbols: string[];
  movements: symbol[];
  nextState: State;
};

export default class TuringMachine {
  readonly #tapeBlock: TapeBlock;
  readonly #stack: State[] = [];

  constructor({
                tapeBlock,
              }: { tapeBlock?: TapeBlock } = {}) {
    if (!tapeBlock) {
      throw new Error('invalid tapeBlock');
    }

    this.#tapeBlock = tapeBlock;
  }

  get tapeBlock() {
    return this.#tapeBlock;
  }

  run({initialState, stepsLimit = 1e5, onStep}: RunParameter & { onStep?: (machineState: MachineState) => void }) {
    const iterator = this.runStepByStep({initialState, stepsLimit});

    for (const machineState of iterator) {
      if (onStep instanceof Function) {
        onStep(machineState);
      }
    }
  }

  * runStepByStep({initialState, stepsLimit = 1e5}: RunParameter): Generator<MachineState> {
    const stack = this.#stack;
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
          currentSymbols: this.#tapeBlock.currentSymbols,
          nextSymbols: command.tapesCommands.map((tapeCommand, ix) => {
            if (typeof tapeCommand.symbol === 'symbol') {
              switch (tapeCommand.symbol) {
                case symbolCommands.erase:
                  return this.#tapeBlock.tapes[ix].alphabet.blankSymbol;
                case symbolCommands.keep:
                  return this.#tapeBlock.tapes[ix].symbol;
                default:
                  throw new Error('invalid symbol command');
              }
            }

            return tapeCommand.symbol;
          }),
          movements: command.tapesCommands.map((tapeCommand) => tapeCommand.movement),
          nextState: nextStateForYield,
        };
      } catch (error) {
        if (error === haltState) {
          throw new Error(`Execution was stopped because of STOP`);
        }

        throw error;
      }

      this.#tapeBlock.applyCommand(command);

      if (nextState.isHalt && stack.length) {
        nextState = stack.pop()!;
      }

      if (state !== nextState && nextState.overrodeHaltState) {
        stack.push(nextState.overrodeHaltState);
      }

      state = nextState;
    }
  }
}
