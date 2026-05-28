import State, {haltState} from './State';
import TuringMachine, {
  MACHINE_STATE_INTERNAL,
  matchFilter,
  type MachineState,
  type MachineStateInternal,
  type PauseInfo,
  type PausedMachineState,
  type ResumeDirective,
} from './TuringMachine';

/**
 * Parameters mirror `TuringMachine.runStepByStep` / `run`. DebugSession passes
 * them straight through to the engine generator.
 */
export type DebugSessionParameter = {
  initialState: State;
  stepsLimit?: number;
};

export type DebugSessionEvent = 'pause' | 'step' | 'iter' | 'halt';

/**
 * Listener signatures and dispatch contract by event:
 *
 * - `step` — fire-and-forget. Sync hot-loop tracing; listener Promise (if any)
 *   is not awaited. Matches the v6 `onStep` contract.
 * - `iter` — **AWAITED** (sequenced, blocks the engine). For per-iter
 *   throttle / coordination / step-boundary synthesis where the engine
 *   genuinely needs to wait for the listener's work before advancing.
 *   Matches the v6 `onIter` contract.
 * - `pause` — implicitly awaited via the session's internal `#pauseResolver`:
 *   the engine pauses on the pause-promise, listeners fire (their Promises
 *   are NOT awaited individually), and resume is signaled by an explicit
 *   call to `session.continue()` / `stepIn` / `stepOver` / `stepOut` /
 *   `stop` — fundamentally external to the listener's call site (UI click,
 *   postMessage, timer, etc.).
 * - `halt` — fire-and-forget. Terminal notification.
 *
 * `pause` listeners receive a `PausedMachineState` (a `MachineState` plus the
 * one-sided `pause: {side, cause}` descriptor). `step` / `iter` listeners
 * receive a plain `MachineState` — raw yields carry no pause info.
 */
export type DebugSessionListener<E extends DebugSessionEvent> =
  E extends 'halt'
    ? () => void | Promise<void>
    : E extends 'pause'
      ? (machineState: PausedMachineState) => void | Promise<void>
      : (machineState: MachineState) => void | Promise<void>;

type ListenerMap = {
  pause: Array<(m: PausedMachineState) => void | Promise<void>>;
  step: Array<(m: MachineState) => void | Promise<void>>;
  iter: Array<(m: MachineState) => void | Promise<void>>;
  halt: Array<() => void | Promise<void>>;
};

/**
 * Interactive debugger session for `TuringMachine`. Owns the coordination
 * layer that every UI debugger / IDE extension / educational demo would
 * otherwise reimplement: breakpoint dispatch, step-in / step-over / step-out,
 * click-pause from outside, per-iter throttle, pause/resume promise plumbing.
 *
 * Construction is direct — the engine class stays minimal and doesn't expose a
 * `debugRun()` factory; consumers import both classes and write
 * `new DebugSession(machine, {initialState})`.
 *
 * Lifecycle:
 *   const session = new DebugSession(machine, {initialState});
 *   session.on('pause', (m) => { ...; session.continue(); });
 *   session.on('halt', () => { ... });
 *   await session.start();           // resolves on natural halt or stop()
 *
 * Each session is single-use: `start()` may only be called once. Construct a
 * fresh session to re-run.
 */
export default class DebugSession {
  readonly #machine: TuringMachine;
  readonly #parameter: DebugSessionParameter;
  readonly #listeners: ListenerMap = {
    pause: [],
    step: [],
    iter: [],
    halt: [],
  };
  #started = false;
  #stopped = false;
  #iterating = false;
  #pauseResolver: (() => void) | null = null;
  #activeStepMode: ResumeDirective | null = null;
  /**
   * Halt-stack DEPTH snapshotted at the most recent pause dispatch (= number
   * of frames on the stack). DevTools-style step granularity is depth-based:
   * stepOver pauses at the next iter with `depth <= clickTimeDepth` (skip
   * frames the stepped-over iter pushes, pause back at the start level);
   * stepOut at `depth < clickTimeDepth` (the current frame itself exited).
   * Captured on EVERY pause so a step* call from the listener can freeze it.
   */
  #capturedDepth = 0;
  /** The click-time depth frozen when a stepOver / stepOut directive is issued. */
  #clickTimeDepth = 0;
  #runIntervalMs = 0;
  #pauseRequested = false;

  constructor(machine: TuringMachine, parameter: DebugSessionParameter) {
    this.#machine = machine;
    this.#parameter = parameter;
  }

  on<E extends DebugSessionEvent>(event: E, listener: DebugSessionListener<E>): this {
    (this.#listeners[event] as Array<DebugSessionListener<E>>).push(listener);
    return this;
  }

  off<E extends DebugSessionEvent>(event: E, listener: DebugSessionListener<E>): this {
    const arr = this.#listeners[event] as Array<DebugSessionListener<E>>;
    const ix = arr.indexOf(listener);
    if (ix >= 0) arr.splice(ix, 1);
    return this;
  }

  stop(): void {
    this.#stopped = true;
    this.#releasePause();
  }

  /**
   * Request a pause from outside the run loop. The pause fires on the next
   * iter's before-side with `cause: 'manual'`. If a breakpoint matches that
   * same iter, the breakpoint takes precedence and the request is consumed
   * silently (one pause, cause: 'breakpoint').
   *
   * No-op if the session is already paused — the next `continue` / step call
   * resumes normal execution, then the flag fires on the iter AFTER that.
   * Equivalent to a debouncing one-shot.
   */
  pause(): void {
    this.#pauseRequested = true;
  }

  /**
   * Set the per-iter throttle delay in milliseconds. After each iter (including
   * any pause + step + iter listeners on that iter), the loop awaits
   * `setTimeout(ms)` before proceeding to the next iter. `0` disables the
   * throttle.
   *
   * Useful for visualization UIs that want to animate execution at a fixed
   * pace. Updates take effect on the next iter.
   */
  setRunInterval(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new Error(`DebugSession.setRunInterval(${ms}): expected a non-negative finite number.`);
    }
    this.#runIntervalMs = ms;
  }

  /**
   * Resume from the current pause, returning to normal execution until the
   * next breakpoint or natural halt. No-op when called outside of a paused
   * state.
   */
  continue(): void {
    this.#activeStepMode = null;
    this.#releasePause();
  }

  /**
   * Resume and force a pause on the next iter regardless of whether that
   * iter's `state.debug` filter matches. Step-mode is one-shot: any
   * subsequent pause dispatch (this step-in's endpoint, an inner
   * breakpoint, or a manual pause) drops it. To keep stepping, call
   * stepIn() again from the new pause.
   */
  stepIn(): void {
    this.#activeStepMode = 'step-in';
    this.#releasePause();
  }

  /**
   * Resume and pause at the next iter back at (or above) the click-time depth
   * — i.e. `depth <= clickTimeDepth`. Frames the stepped-over iter pushes are
   * run to completion without pausing inside (the engine's continuation-passing
   * `withOverriddenHaltState` "calls"). Mirrors DevTools Step Over.
   *
   * For a plain iter (no frame push) this coincides with stepIn (next iter is
   * already at the same depth). The Over-vs-In / Over-vs-Out distinction only
   * appears under genuine nesting (a bare that itself enters a wrapper).
   *
   * One-shot: an inner breakpoint or any other pause drops the step-over
   * intent. The endpoint pause carries `cause: 'step'`.
   */
  stepOver(): void {
    this.#activeStepMode = 'step-over';
    this.#clickTimeDepth = this.#capturedDepth;
    this.#releasePause();
  }

  /**
   * Resume and pause at the next iter STRICTLY shallower than the click-time
   * depth — `depth < clickTimeDepth` — i.e. once the current frame itself has
   * been popped. Mirrors DevTools Step Out.
   *
   * Throws when the click-time depth is 0: there's no enclosing frame to exit
   * (IDE convention — "step out of nothing" is a programming error, not a
   * silent no-op).
   */
  stepOut(): void {
    if (this.#capturedDepth === 0) {
      throw new Error(
        'DebugSession.stepOut() called with an empty click-time halt-stack — there is no enclosing frame to exit.',
      );
    }
    this.#activeStepMode = 'step-out';
    this.#clickTimeDepth = this.#capturedDepth;
    this.#releasePause();
  }

  // Release the internal pause-promise. Set #pauseResolver to null BEFORE
  // calling so a re-entrant resume from inside another listener doesn't
  // double-fire.
  #releasePause(): void {
    const resolver = this.#pauseResolver;
    if (resolver) {
      this.#pauseResolver = null;
      resolver();
    }
  }

  /**
   * Emit a `pause` event with the synthesized pause descriptor and await the
   * consumer's resume signal. Resolver is installed BEFORE listeners fire so a listener
   * that synchronously calls `session.continue()` (or any other resume method)
   * sees a live resolver to drop.
   *
   * One-shot rule: any pause dispatch (step-mode endpoint, inner breakpoint,
   * manual pause) drops the active step-mode BEFORE listeners fire. Listeners
   * that want to keep stepping must call stepIn/Over/Out from the new pause.
   *
   * The pre-iter halt-stack DEPTH is snapshotted into `#capturedDepth` so a
   * `stepOver` / `stepOut` issued from inside the listener can freeze it as
   * the click-time depth.
   */
  async #dispatchPause(machineState: MachineState, pause: PauseInfo): Promise<void> {
    this.#activeStepMode = null;
    this.#capturedDepth = this.#readStack(machineState).length;

    // Note: the spread drops the non-enumerable MACHINE_STATE_INTERNAL Symbol
    // accessor — that's intentional. Pause listeners are public API; the
    // Symbol accessor is package-private and only consumed by the session's
    // OWN detection (which reads the original `machineState` via #readInternal).
    const paused: PausedMachineState = {...machineState, pause};
    const pausePromise = new Promise<void>((resolve) => {
      this.#pauseResolver = resolve;
    });
    for (const fn of this.#listeners.pause) {
      void fn(paused);
    }
    await pausePromise;
  }

  // Reads the per-iter internal accessor installed by `runStepByStep` (halt
  // stack + matched symbol). Returns null if the accessor is missing
  // (defensive — shouldn't happen with the engine on this branch).
  #readInternal(machineState: MachineState): MachineStateInternal | null {
    const fn = (machineState as unknown as Record<symbol, () => MachineStateInternal>)[MACHINE_STATE_INTERNAL];
    return typeof fn === 'function' ? fn() : null;
  }

  #readStack(machineState: MachineState): readonly State[] {
    return this.#readInternal(machineState)?.stack ?? [];
  }

  async start(): Promise<void> {
    if (this.#started) {
      throw new Error('DebugSession.start() has already been called; construct a fresh session to re-run.');
    }
    this.#started = true;

    try {
      await this.#drive();
    } catch (error) {
      // `runStepByStep` acquires the TapeBlock lock at its first advance. If
      // another DebugSession (or a bare `run()`) is already active on this
      // machine, that acquisition throws the low-level 'Lock check failed'.
      // Remap it to a message that names the real cause. The `#iterating`
      // guard scopes the remap to the startup acquisition only — once we hold
      // the lock and are iterating, a same-named error can't originate here.
      if (!this.#iterating && error instanceof Error && error.message === 'Lock check failed') {
        throw new Error(
          'Cannot start this DebugSession: a run is already in progress on this machine. '
          + 'Only one DebugSession or run() may be active on a TuringMachine at a time — '
          + 'stop the active session (or let it halt) before starting another.',
        );
      }
      throw error;
    }
  }

  async #drive(): Promise<void> {
    for (const machineState of this.#machine.runStepByStep(this.#parameter)) {
      this.#iterating = true;
      if (this.#stopped) return;

      // Breakpoint detection lives HERE (not in the generator). Evaluate the
      // current state's debug filters against the matched symbol the generator
      // stashed in the internal accessor. `machineState.state` is always
      // non-halt (halt is terminal), so `.debug` is a DebugConfig at runtime.
      // The after side also fires on halt-imminent (`haltState.debug`, #207) —
      // read via the internal flag, since the yielded `nextState` shows the
      // post-pop continuation on subroutine-return iters, not haltState.
      const internal = this.#readInternal(machineState);
      const matchedSymbol = internal?.matchedSymbol;
      const hasBeforeBreakpoint = matchedSymbol !== undefined
        && matchFilter(machineState.state.debug?.before, matchedSymbol);
      const hasAfterBreakpoint = (matchedSymbol !== undefined
        && matchFilter(machineState.state.debug?.after, matchedSymbol))
        || (internal?.haltImminent === true && haltState.debug === true);
      const stepInForcesPause = this.#activeStepMode === 'step-in';
      // Depth-based endpoints (DevTools semantics). currentDepth = pre-iter
      // halt-stack length. stepOver: back at/above click-time depth (skip
      // pushed frames). stepOut: strictly shallower (current frame exited).
      const currentDepth = this.#readStack(machineState).length;
      const stepOverEndpointReached =
        this.#activeStepMode === 'step-over' && currentDepth <= this.#clickTimeDepth;
      const stepOutEndpointReached =
        this.#activeStepMode === 'step-out' && currentDepth < this.#clickTimeDepth;
      // Consume the manual-pause flag at iter start. If a breakpoint also
      // matches this iter, the request is silently consumed by the
      // breakpoint dispatch (one pause, cause: 'breakpoint').
      const manualPauseFires = this.#pauseRequested;
      if (manualPauseFires) this.#pauseRequested = false;

      // Before-side pause: fires if any of breakpoint / step-mode endpoint /
      // manual request is true. Precedence: breakpoint > step > manual.
      const fireBeforePause =
        hasBeforeBreakpoint || stepInForcesPause || stepOverEndpointReached || stepOutEndpointReached || manualPauseFires;
      if (fireBeforePause) {
        const cause: PauseInfo['cause'] =
          hasBeforeBreakpoint ? 'breakpoint'
            : (stepInForcesPause || stepOverEndpointReached || stepOutEndpointReached) ? 'step'
              : 'manual';
        await this.#dispatchPause(machineState, {side: 'before', cause});
        if (this.#stopped) return;
      }

      // step: fires once per iter, after any before-pause and before any after-pause.
      for (const fn of this.#listeners.step) {
        void fn(machineState);
      }

      if (hasAfterBreakpoint) {
        await this.#dispatchPause(machineState, {side: 'after', cause: 'breakpoint'});
        if (this.#stopped) return;
      }

      // iter: end-of-iter, after both before- and after-pause have fired.
      // Listeners are AWAITED (sequenced, blocking the engine) — matches the
      // v6 `onIter` contract that downstream consumers rely on for
      // throttle / per-iter coordination / step-boundary synthesis.
      for (const fn of this.#listeners.iter) {
        await fn(machineState);
      }
      if (this.#stopped) return;

      if (this.#runIntervalMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, this.#runIntervalMs));
        if (this.#stopped) return;
      }
    }

    if (!this.#stopped) {
      for (const fn of this.#listeners.halt) {
        void fn();
      }
    }
  }
}
