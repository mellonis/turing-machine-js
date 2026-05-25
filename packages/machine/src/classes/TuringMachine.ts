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

/**
 * @internal — package-private accessor key for `MachineState` instances yielded
 * by `runStepByStep`. Calling `machineState[MACHINE_STATE_INTERNAL]()` returns a
 * frozen snapshot of the engine's halt-stack at yield time (BEFORE this iter's
 * applyCommand / pop / push). Consumed by `DebugSession` for step-over /
 * step-out endpoint detection without exposing the stack to public API.
 *
 * Re-exported from this module so the sibling `DebugSession` module can import
 * it; intentionally NOT re-exported from the package's public `index.ts` —
 * downstream consumers shouldn't reach for the stack. Same pattern as
 * `STATE_INTERNAL` (#180).
 */
export const MACHINE_STATE_INTERNAL = Symbol('MachineState.internal');

export type MachineStateInternal = {
  /** Frozen pre-iter halt-stack snapshot. Consumers must not mutate. */
  stack: readonly State[];
};

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

  /**
   * Run the machine to halt. Pure execution — synchronous, no observation
   * callbacks, no debug overhead. For breakpoint-driven interactive debugging
   * use `DebugSession`; for per-iter tracing use `runStepByStep`'s generator
   * directly.
   *
   * Breakpoint metadata (`state.debug` / `haltState.debug` matches) is still
   * resolved and attached to each yielded MachineState by the underlying
   * generator — `run()` simply doesn't dispatch on it. A consumer that wants
   * to dispatch on it constructs a `DebugSession` instead.
   *
   * Symmetric reversal of v4's `run` → `async run` change: v4 made the method
   * async to support awaited `onPause`; with callbacks moved to `DebugSession`
   * there's no async work left, so the method returns `void` again.
   */
  run({initialState, stepsLimit = 1e5}: RunParameter): void {
    // Drain the generator. We don't care about the yielded values — the
    // generator's job is to advance the tape; only side effects matter here.
    // Casting to unknown so eslint doesn't flag the unused `_` variable.
    for (const machineState of this.runStepByStep({initialState, stepsLimit})) {
      void machineState;
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

          // #102: expose the pre-iter halt-stack to DebugSession via a
          // Symbol-keyed accessor (non-enumerable so it doesn't leak into
          // serialization / spread / toEqual). The snapshot is frozen so a
          // consumer holding a reference can't mutate the engine's stack.
          const stackSnapshot: readonly State[] = Object.freeze(stack.slice());
          Object.defineProperty(yielded, MACHINE_STATE_INTERNAL, {
            value: (): MachineStateInternal => ({stack: stackSnapshot}),
            enumerable: false,
          });

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
