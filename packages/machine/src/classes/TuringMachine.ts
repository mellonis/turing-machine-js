import State, {haltState, type DebugConfig} from './State';
import TapeBlock, {lockSymbol} from './TapeBlock';
import {symbolCommands} from './TapeCommand';

type RunParameter = { initialState: State, stepsLimit?: number };

export type MachineState = {
  step: number;
  state: State;
  currentSymbols: string[];
  nextSymbols: string[];
  movements: symbol[];
  nextState: State;
  /**
   * Set only when this iteration is a debug break point.
   * Field is OMITTED entirely when no break fires (no `debugBreak: undefined`).
   * At least one of `before` / `after` is `true` when the field is present.
   *
   * Both flags refer to THIS iter — `before` means the iter's `state.debug.before`
   * matched, `after` means the iter's `state.debug.after` matched. `run()`
   * dispatches the two timings as separate `onPause` calls (before-call has
   * `debugBreak: {before: true}` only; after-call has `debugBreak: {after: true}`
   * only) so consumers can distinguish without ambiguity.
   */
  debugBreak?: {
    before?: true;
    after?: true;
  };
};

// True iff `filter` matches `symbol` per the DebugConfig semantics.
// undefined / [] -> never; true -> always; symbol[] -> exact membership.
function matchFilter(filter: DebugConfig['before'], symbol: symbol): boolean {
  if (filter === undefined) return false;
  if (filter === true) return true;
  return filter.includes(symbol);
}

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

  async run({
    initialState,
    stepsLimit = 1e5,
    onStep,
    onPause,
    debug = true,
  }: RunParameter & {
    /**
     * Sync, ~free hook fired on every iteration. Use for logging/tracing —
     * the hot loop runs this without a microtask boundary, so it must not
     * be async.
     */
    onStep?: (machineState: MachineState) => void;
    /**
     * Async hook fired when `state.debug[when]` matches at the current
     * iteration. The promise is awaited inline, so the consumer can suspend
     * execution by deferring its resolution. Use for pause-capable inspection
     * (debugger UIs, conditional breakpoints in tests).
     *
     * Renamed from `onDebugBreak` in v5.0.0. In v6.0.0 the dispatch order
     * was changed so that `before` and `after` for the SAME iter fire on the
     * same yield (per-iter lifecycle: before → step → after); previously the
     * `after` of iter K fired on iter K+1's tick with a substituted source
     * view. The `m.debugBreak` payload field keeps its name (it describes the
     * engine's reason for pausing).
     */
    onPause?: (machineState: MachineState) => void | Promise<void>;
    /**
     * Master switch for `onPause` dispatch. When `false`, suppresses all
     * pause-fires (before and after) regardless of `state.debug` assignments.
     * `onStep` is unaffected. Defaults to `true`.
     *
     * The `m.debugBreak` field is still populated on yields by the underlying
     * generator (it's a property of the iteration, not of the consumer); only
     * `run()`'s hook dispatch is gated. Direct `runStepByStep` consumers see
     * the metadata regardless.
     */
    debug?: boolean;
  }): Promise<void> {
    const generator = this.runStepByStep({initialState, stepsLimit});

    for (const machineState of generator) {
      // Per-iter lifecycle: before → step → after. All three operate on the
      // same yielded MachineState, so the consumer sees a coherent ordering
      // within each iteration without cross-tick coordination.
      if (debug && machineState.debugBreak?.before && onPause) {
        await onPause({...machineState, debugBreak: {before: true}});
      }

      if (onStep instanceof Function) {
        onStep(machineState);
      }

      if (debug && machineState.debugBreak?.after && onPause) {
        await onPause({...machineState, debugBreak: {after: true}});
      }
    }
  }

  * runStepByStep({initialState, stepsLimit = 1e5}: RunParameter): Generator<MachineState> {
    const executionSymbol = Symbol('execution');

    try {
      this.#tapeBlock[lockSymbol].check(executionSymbol);
      this.#tapeBlock[lockSymbol].lock(executionSymbol);


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
          // Both before and after refer to THIS iter (#119 / v6.0.0).
          // The halting iter's after-fire just rides along on the iter's
          // own yield — no post-loop drain needed.
          const beforeMatch = matchFilter(state.debug?.before, symbol)
            || (nextState.isHalt && nextState.debug?.before === true);
          const afterMatch = matchFilter(state.debug?.after, symbol);

          const nextStateForYield = nextState.isHalt && stack.length
            ? stack.slice(-1)[0]
            : nextState;

          const yielded: MachineState = {
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

          if (beforeMatch || afterMatch) {
            const dbg: { before?: true; after?: true } = {};
            if (beforeMatch) dbg.before = true;
            if (afterMatch) dbg.after = true;
            yielded.debugBreak = dbg;
          }

          yield yielded;

          this.#tapeBlock.applyCommand(command, executionSymbol);

          if (nextState.isHalt && stack.length) {
            nextState = stack.pop()!;
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
