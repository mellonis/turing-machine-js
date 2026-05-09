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
   * Set only when this iteration boundary is a debug break.
   * Field is OMITTED entirely when no break fires (no `debugBreak: undefined`).
   * At least one of `before` / `after` is `true` when the field is present.
   *
   * For consumers of the `runStepByStep` generator the `state` field reflects
   * the current iteration regardless of timing; `run()` substitutes the prior
   * yield's snapshot for `after` calls so consumers see the source state.
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
     * Async hook fired only when `state.debug[when]` matches at the current
     * iteration. The promise is awaited inline, so the consumer can suspend
     * execution by deferring its resolution. Use for pause-capable inspection
     * (debugger UIs, conditional breakpoints in tests).
     *
     * Renamed from `onDebugBreak` in v5.0.0. The `m.debugBreak` payload field
     * keeps its name (it describes the engine's reason for pausing).
     */
    onPause?: (machineState: MachineState) => void | Promise<void>;
    /**
     * Master switch for `onPause` dispatch. When `false`, suppresses all
     * pause-fires (before, after, and the post-loop after-drain) regardless
     * of `state.debug` assignments. `onStep` is unaffected. Defaults to
     * `true`.
     *
     * The `m.debugBreak` field is still populated on yields by the underlying
     * generator (it's a property of the iteration, not of the consumer); only
     * `run()`'s hook dispatch is gated. Direct `runStepByStep` consumers see
     * the metadata regardless.
     */
    debug?: boolean;
  }): Promise<void> {
    const generator = this.runStepByStep({initialState, stepsLimit});
    let prevYield: MachineState | null = null;

    // Manual iteration so we can pick up the generator's RETURN value (the
    // post-loop after-fire drain from #108 part 1, signalled when the
    // halting iter armed an after).
    let result = generator.next();

    while (!result.done) {
      const machineState = result.value;

      // 'after' (from prev step) — fire FIRST, with prev yield substituted as the source view.
      if (debug && machineState.debugBreak?.after && onPause && prevYield) {
        await onPause({...prevYield, debugBreak: {after: true}});
      }

      // 'before' (current step) — pass current machineState with only the before flag.
      if (debug && machineState.debugBreak?.before && onPause) {
        await onPause({...machineState, debugBreak: {before: true}});
      }

      if (onStep instanceof Function) {
        onStep(machineState);
      }

      prevYield = machineState;
      result = generator.next();
    }

    // #108 part 1: drain the halting iter's after-fire if it armed one.
    // The generator returns a non-null tail when the last visited state's
    // `state.debug.after` matched its symbol but the loop exited before a
    // next yield could carry the metadata. We dispatch using the source
    // (prevYield), matching the in-loop after-fire payload shape.
    if (debug && result.value && onPause && prevYield) {
      await onPause({...prevYield, debugBreak: {after: true}});
    }
  }

  * runStepByStep({initialState, stepsLimit = 1e5}: RunParameter): Generator<MachineState, MachineState | null> {
    const executionSymbol = Symbol('execution');
    let lastYielded: MachineState | null = null;
    let pendingAfterFromPrev = false;

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
          const beforeMatch = matchFilter(state.debug?.before, symbol)
            || (nextState.isHalt && nextState.debug?.before === true);

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

          if (pendingAfterFromPrev || beforeMatch) {
            const dbg: { before?: true; after?: true } = {};
            if (pendingAfterFromPrev) dbg.after = true;
            if (beforeMatch) dbg.before = true;
            yielded.debugBreak = dbg;
          }

          yield yielded;
          lastYielded = yielded;

          // Re-evaluate 'after' for THIS visit, to fire on the NEXT yield
          // (or, if this turns out to be the halting iter, on the post-loop
          // drain — see #108 part 1).
          pendingAfterFromPrev = matchFilter(state.debug?.after, symbol);

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

    // #108 part 1: signal the after-fire armed by the halting iter so run()
    // (or any direct generator consumer) can dispatch one final after-break.
    // Returning the synthesized MachineState (rather than yielding it) keeps
    // `for..of` consumers — which ignore the return value — unaffected; only
    // consumers that opt in via manual iteration see the drain.
    if (pendingAfterFromPrev && lastYielded) {
      return {...lastYielded, debugBreak: {after: true}};
    }

    return null;
  }
}
