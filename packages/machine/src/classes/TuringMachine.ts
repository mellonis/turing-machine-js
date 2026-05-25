import State, {haltState, STATE_INTERNAL, type DebugConfig} from './State';
import TapeBlock, {lockSymbol} from './TapeBlock';
import {symbolCommands} from './TapeCommand';

type RunParameter = { initialState: State, stepsLimit?: number };

/**
 * Set only on iterations whose `MachineState` represents a pause point.
 * - Side flags: at least one of `before` / `after` is `true`.
 * - `cause` identifies the pause origin:
 *   - `'breakpoint'` — a `state.debug[when]` filter or `haltState.debug === true` matched.
 *   - `'step'` — a DebugSession step-mode endpoint fired (stepIn / stepOver / stepOut).
 *   - `'manual'` — a `DebugSession.pause()` call fired.
 *
 * On `runStepByStep` yields, `cause` is always `'breakpoint'` (the generator only
 * knows about engine-level breakpoint filters). DebugSession synthesizes `'step'`
 * and `'manual'` causes when dispatching its `pause` event.
 */
export type DebugBreak = {
  before?: true;
  after?: true;
  cause: 'breakpoint' | 'step' | 'manual';
};

/**
 * @internal — directive returned from a DebugSession's internal pause coordination
 * to drive step-mode bookkeeping. NOT part of the public API; exported only for
 * sibling-module use inside `packages/machine/src/classes/DebugSession.ts`.
 */
export type ResumeDirective = 'continue' | 'step-in' | 'step-over' | 'step-out';

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
   * See `DebugBreak` for the field's shape and `cause` semantics.
   */
  debugBreak?: DebugBreak;
  /**
   * The transition the engine picked for this iter (#205). Always present
   * — `runStepByStep` resolves it at the very start of every iter via
   * `state.getMatchedTransition(symbol)`, well before any callback fires.
   *
   * - `id` — resolvable in `toGraph`'s output: `graph.nodes[…].transitions`
   *   contains a `GraphTransition` whose `.id` equals this value. Format is
   *   `${stateId}.${transitionIx}`. **For wrapper-entry iters (`state` is
   *   produced by `withOverriddenHaltState`): the wrapper's own
   *   `transitions` array in `toGraph` is empty because wrappers delegate
   *   to the bare; this field carries the BARE's transition id, where the
   *   pattern actually lives.** Consumers can detect this case by
   *   comparing `id.split('.')[0]` against `state.id` — different = wrapper
   *   delegation.
   * - `matchKinds` — per-tape match kind for the picked transition's
   *   pattern at each tape position. `'wildcard'` if the matched
   *   alternative had `ifOtherSymbol` at that position, `'literal'`
   *   otherwise. Length equals tape count.
   */
  matchedTransition: {
    id: string;
    matchKinds: ('wildcard' | 'literal')[];
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
    onIter,
    debug = true,
  }: RunParameter & {
    /**
     * Sync, ~free hook fired on every iteration. Use for logging/tracing —
     * the hot loop runs this without a microtask boundary, so it must not
     * be async.
     *
     * For per-iter throttle / coordination ("wait between iters" UIs):
     * use `onIter` (v6.4.0+, awaited at end-of-iter).
     */
    onStep?: (machineState: MachineState) => void;
    /**
     * Async hook fired when `state.debug[when]` matches at the current
     * iteration. The promise is awaited inline, so the consumer can suspend
     * execution by deferring its resolution. Use for pause-capable inspection
     * (debugger UIs, conditional breakpoints in tests). Per-iter lifecycle:
     * `before` and `after` for the same iter fire on the same yield.
     */
    onPause?: (machineState: MachineState) => void | Promise<void>;
    /**
     * Awaited hook fired ONCE at the end of every iteration (v6.4.0+), AFTER
     * any `onPause(after, K)` dispatch on the same yield. Use for per-iter
     * coordination that needs to suspend the run loop — throttling between
     * iters (interactive debugger UIs), prev-state bookkeeping that must
     * observe iter K's final state once all `onPause` hooks have read their
     * own snapshots, yield-to-other-work in batched runs.
     *
     * Three-hook contract recap:
     * - `onStep`: sync, microtask-free — tracing/logging during the iter
     * - `onPause`: awaited, conditional on `state.debug[when]` match — user
     *   breakpoints with iter-correct payload
     * - `onIter`: awaited, unconditional — once per iter, at end-of-iter
     *
     * `onIter` is unaffected by the `debug` master switch — it fires on
     * every iter regardless. Sync consumers should prefer `onStep` to avoid
     * the per-iter microtask boundary `onIter` carries.
     */
    onIter?: (machineState: MachineState) => void | Promise<void>;
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
        await onPause({...machineState, debugBreak: {before: true, cause: 'breakpoint'}});
      }

      if (onStep) {
        onStep(machineState);
      }

      if (debug && machineState.debugBreak?.after && onPause) {
        await onPause({...machineState, debugBreak: {after: true, cause: 'breakpoint'}});
      }

      if (onIter) {
        await onIter(machineState);
      }
    }
  }

  * runStepByStep({initialState, stepsLimit = 1e5}: RunParameter): Generator<MachineState> {
    const executionSymbol = Symbol('execution');

    try {
      this.#tapeBlock[lockSymbol].check(executionSymbol);
      this.#tapeBlock[lockSymbol].lock(executionSymbol);


      // Halt-stack is run-scoped, not machine-scoped (#196) — local
      // declaration prevents leftover entries from a previous
      // `runStepByStep` call (e.g. a build-time peek that never drained
      // the generator) from leaking into a subsequent halt-bound transition.
      const stack: State[] = [];
      let state = initialState;

      if (state.overriddenHaltState) {
        stack.push(state.overriddenHaltState);
      }

      let i = 0;

      while (!state.isHalt) {
        if (i === stepsLimit) {
          throw new Error('Long execution');
        }

        i += 1;

        const symbol = state.getSymbol(this.#tapeBlock);
        const command = state.getCommand(symbol);
        const matched = state.getMatchedTransition(symbol);
        let nextState = matched.nextState.ref;
        // For wrapper-entry iters, the wrapper's transitions in `toGraph`
        // are empty (wrappers delegate to the bare via shared
        // `#symbolToDataMap`); the resolvable transition id lives under
        // the bare's stateId. `bareState` is non-null only when `state`
        // is a wrapper produced by `withOverriddenHaltState`. Accessed
        // via the STATE_INTERNAL package-private view (same pattern
        // `utilities/stateGraph.ts` uses) to avoid widening the public
        // State API for this internal need.
        const stateInternal = state[STATE_INTERNAL]();
        const resolvableStateId = stateInternal.bareState?.id ?? state.id;
        const matchedTransition: MachineState['matchedTransition'] = {
          id: `${resolvableStateId}.${matched.ix}`,
          matchKinds: this.#tapeBlock.patternKinds(matched.matchedSymbol),
        };

        try {
          // Both before and after refer to THIS iter (#119 / v6.0.0).
          // The halting iter's after-fire just rides along on the iter's
          // own yield — no post-loop drain needed.
          //
          // #207 spec: `haltState.debug` is a boolean; the pause anchors on
          // the AFTER side of the halt-triggering iter so consumers see the
          // just-fired transition with the diagram cursor still on the
          // triggering state.
          //
          // `state` here is always non-halt (halt is terminal — the run loop
          // never iterates with state === haltState), so `state.debug` is
          // always `DebugConfig` at runtime.
          const beforeMatch = matchFilter(state.debug?.before, symbol);
          const afterMatch = matchFilter(state.debug?.after, symbol)
            || (nextState === haltState && haltState.debug);

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
            matchedTransition,
          };

          if (beforeMatch || afterMatch) {
            const dbg: DebugBreak = {cause: 'breakpoint'};
            if (beforeMatch) dbg.before = true;
            if (afterMatch) dbg.after = true;
            yielded.debugBreak = dbg;
          }

          yield yielded;

          this.#tapeBlock.applyCommand(command, executionSymbol);

          if (nextState.isHalt && stack.length) {
            nextState = stack.pop()!;
          }

          if (state !== nextState && nextState.overriddenHaltState) {
            stack.push(nextState.overriddenHaltState);
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
