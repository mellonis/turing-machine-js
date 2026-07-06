import State, {CallFrame, abortState, haltState, type DebugConfig} from './State';
import TapeBlock, {lockSymbol} from './TapeBlock';
import {symbolCommands} from './TapeCommand';

type RunParameter = { initialState: State, stepsLimit?: number };

/**
 * Descriptor attached to a `DebugSession` `pause` event. Lives ONLY on the
 * pause-event payload (`PausedMachineState`) — never on a raw `runStepByStep`
 * yield, which is a minimal `MachineState` with no debug concern.
 *
 * - `side` — exactly one of `'before'` / `'after'`. DebugSession dispatches the
 *   two timings as separate `pause` events, so a single descriptor is always
 *   one-sided (the v6 "both timings on one yield" set no longer exists, because
 *   detection moved out of the generator).
 * - `cause` — pause origin:
 *   - `'breakpoint'` — a `state.debug[when]` filter or `haltState.debug === true` matched.
 *   - `'step'` — a step-mode endpoint fired (stepIn / stepOver / stepOut).
 *   - `'manual'` — a `DebugSession.pause()` call fired.
 *
 * Precedence when an iter satisfies more than one trigger: `breakpoint > step >
 * manual`. `'step'` / `'manual'` only ever fire on the `'before'` side.
 */
export type PauseInfo = {
  side: 'before' | 'after';
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
  /** The interned symbol the engine matched for this iter (the result of
   *  `state.getSymbol(tapeBlock)`). DebugSession uses it to evaluate
   *  `state.debug` filters without re-reading the tape. */
  matchedSymbol: symbol;
  /** Whether this iter's transition leads to halt — computed on the RAW
   *  next-state (before any halt-pop redirect to a continuation). The yielded
   *  `MachineState.nextState` shows the post-pop continuation, so consumers
   *  can't recover halt-imminence from it; DebugSession reads this flag to
   *  honor `haltState.debug` on subroutine-return (halt-pop) iters. */
  haltImminent: boolean;
  /** Whether this iter's transition targets `abortState` (#239) — computed
   *  on the RAW next-state, same timing discipline as `haltImminent`. Unlike
   *  halt, abort never pops the stack, so there's no post-pop redirect to
   *  worry about; the flag exists for symmetry so a `DebugSession` consumer
   *  can react to an imminent abort the same way it reacts to imminent halt. */
  abortImminent: boolean;
};

export type MachineState = {
  step: number;
  state: State;
  currentSymbols: string[];
  nextSymbols: string[];
  movements: symbol[];
  nextState: State;
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

/**
 * The payload of a `DebugSession` `pause` event: a `MachineState` plus the
 * one-sided `pause` descriptor. Raw `runStepByStep` yields are plain
 * `MachineState` (no `pause` field) — only DebugSession produces this shape.
 */
export type PausedMachineState = MachineState & { pause: PauseInfo };

/**
 * The return value of `run()` / `runStepByStep()` (#239). A run always ends
 * one of two ways: it reaches `haltState` (the normal terminal case, `stack`
 * is `[]` by construction — every subroutine frame already popped) or it
 * punches through to `abortState` (the call stack is NOT unwound; `stack`
 * is the frozen backtrace of continuations abort short-circuited past).
 *
 * - `state` — the state whose transition triggered the sentinel. For a
 *   wrapper-entry iter (a `CallFrame` delegating to its bare), this is the
 *   BARE — the state whose transition table actually matched — not the
 *   transient wrapper, mirroring `MachineState.matchedTransition`'s same
 *   unwrap.
 * - `stack` — frozen; `[]` for `'halted'` by construction (halt always pops
 *   to empty before the run ends); for `'aborted'`, the continuations still
 *   pending when abort fired.
 * - `step` — the 1-based iter count at the moment of termination; `0` if
 *   `initialState` was itself a sentinel (zero iterations ran).
 *
 * The `stack === []` guarantee for `'halted'` and the "`state` is the
 * sentinel-triggering state" description above both assume the run
 * terminates NATURALLY (a halt or abort transition fires). A run stopped
 * externally via the `generator.throw(haltState)` idiom (see
 * `runStepByStep`) instead falls through to the same trailing `'halted'`
 * return with `stack` as it stood at the moment of the throw (not
 * necessarily `[]`) and `state` set to the PREVIOUS iteration's state (no
 * iter "triggered" the stop).
 */
export type RunResult = {
  outcome: 'halted' | 'aborted';
  state: State;
  stack: readonly State[];
  step: number;
};

/**
 * @internal — true iff `filter` matches `symbol` per the DebugConfig semantics.
 * undefined / [] -> never; true -> always; symbol[] -> exact membership.
 * Exported for sibling-module use in `DebugSession` (which now owns breakpoint
 * detection); NOT re-exported from the package's public `index.ts`.
 */
export function matchFilter(filter: DebugConfig['before'], symbol: symbol): boolean {
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
   *
   * As of #239, `run()` returns a `RunResult` — the generator's `return`
   * value, captured by draining it manually instead of a `for...of` (which
   * discards the return). Additive: existing callers that ignored the
   * previous `void` return stay valid.
   */
  run({initialState, stepsLimit = 1e5}: RunParameter): RunResult {
    const generator = this.runStepByStep({initialState, stepsLimit});
    let result = generator.next();

    while (!result.done) {
      result = generator.next();
    }

    return result.value;
  }

  * runStepByStep({initialState, stepsLimit = 1e5}: RunParameter): Generator<MachineState, RunResult> {
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
      // Triggering state of the most recently completed iter (#239) — used
      // by the post-loop halted-result return. Stays `null` when the loop
      // never runs (`initialState` is itself a sentinel), in which case the
      // result falls back to `state` (= initialState) directly.
      let lastIterState: State | null = null;

      // `isHalt` -> `isSentinel` (#239): covers a caller passing `abortState`
      // (or any future sentinel) directly as `initialState` without trying
      // to iterate a transitionless sentinel.
      while (!state.isSentinel) {
        if (i === stepsLimit) {
          throw new Error('Long execution');
        }

        i += 1;

        const symbol = state.getSymbol(this.#tapeBlock);
        const command = state.getCommand(symbol);
        const matched = state.getMatchedTransition(symbol);
        let nextState = matched.nextState.ref;
        // For wrapper-entry iters, a CallFrame's own transitions in `toGraph`
        // are empty (it delegates lookups to its bare); the resolvable
        // transition id lives under the bare's stateId. The same unwrap is
        // used below (#239) to report the triggering state on an abort
        // punch-through — the wrapper is call-stack plumbing, not the state
        // whose transition actually fired.
        const resolvableState = state instanceof CallFrame ? state.bare : state;
        const matchedTransition: MachineState['matchedTransition'] = {
          id: `${resolvableState.id}.${matched.ix}`,
          matchKinds: this.#tapeBlock.patternKinds(matched.matchedSymbol),
        };

        try {
          // `runStepByStep` is the minimal execution primitive: it advances the
          // machine and reports state. It does NO breakpoint detection — that's
          // a debug concern that lives entirely in `DebugSession`. The yielded
          // `MachineState` has no `pause` / `debugBreak` field.
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

          // #102: expose the pre-iter halt-stack + the matched symbol to
          // DebugSession via a Symbol-keyed accessor (non-enumerable, so it
          // doesn't leak into serialization / spread / toEqual). The stack
          // snapshot is frozen so a consumer holding a reference can't mutate
          // the engine's stack. DebugSession reads `matchedSymbol` to evaluate
          // `state.debug` filters — keeping breakpoint detection out of this
          // primitive.
          const stackSnapshot: readonly State[] = Object.freeze(stack.slice());
          // Snapshot halt-imminence on the RAW nextState NOW, before the
          // post-yield pop reassigns `nextState` — so the closure can't capture
          // the mutated value.
          const haltImminent = nextState === haltState;
          // Same timing discipline as haltImminent (#239) — snapshotted on
          // the RAW nextState before anything downstream can change it.
          const abortImminent = nextState === abortState;
          Object.defineProperty(yielded, MACHINE_STATE_INTERNAL, {
            value: (): MachineStateInternal => ({
              stack: stackSnapshot, matchedSymbol: symbol, haltImminent, abortImminent,
            }),
            enumerable: false,
          });

          yield yielded;

          this.#tapeBlock.applyCommand(command, executionSymbol);

          if (nextState.isAbort) {
            // Punch-through (#239): the stack is NOT popped — it becomes the
            // backtrace in the result. Freeze so the caller can't mutate
            // engine internals (same discipline as the #102 stack snapshot).
            // `state` is reported via `resolvableState` so a wrapper-entry
            // abort reports the bare — the state whose own transition table
            // matched — rather than the transient CallFrame.
            return {outcome: 'aborted', state: resolvableState, stack: Object.freeze(stack.slice()), step: i};
          }

          if (nextState.isHalt && stack.length) {
            nextState = stack.pop()!;
          }

          if (state !== nextState && nextState.overriddenHaltState) {
            stack.push(nextState.overriddenHaltState);
          }

          lastIterState = state;
          state = nextState;
        } catch (error) {
          if (error !== haltState) {
            throw error;
          }

          break;
        }
      }

      // Terminal return (#239): reached when the loop condition falls false
      // (state became a sentinel — halt via the normal pop-to-empty path, or
      // `initialState` itself was a sentinel and the loop never ran) or the
      // `catch` above breaks out on an externally-thrown `haltState`. The
      // `state.isAbort` ternary only matters for the zero-iteration
      // `initialState === abortState` case; mid-run aborts already returned
      // above from inside the loop.
      // For wrapper-entry halts, unwrap the CallFrame to its bare (same
      // discipline as the abort path above) — unless the loop never ran
      // (lastIterState === null), in which case return the sentinel as-is.
      const haltTriggeringState = lastIterState instanceof CallFrame ? lastIterState.bare : lastIterState;
      return {
        outcome: state.isAbort ? 'aborted' : 'halted',
        state: haltTriggeringState ?? state,
        stack: Object.freeze(stack.slice()),
        step: i,
      };
    } finally {
      this.#tapeBlock[lockSymbol].unlock(executionSymbol);
    }
  }
}
