import State from './State';
import TuringMachine, {MACHINE_STATE_INTERNAL, type DebugBreak, type MachineState, type MachineStateInternal, type ResumeDirective} from './TuringMachine';

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
 * Listener signatures by event. Listeners may return `void` or `Promise<void>` —
 * the session calls them fire-and-forget, matching Node's `EventEmitter`
 * contract: async listeners run to completion on their own, but the session
 * does NOT await them. Async control flow (pause/resume) is gated by the
 * session's own resume methods (continue / stepIn / stepOver / stepOut / stop)
 * rather than listener return values, because the resume signal is fundamentally
 * external to the listener's call site (UI click, postMessage, timer, etc.).
 */
export type DebugSessionListener<E extends DebugSessionEvent> =
  E extends 'halt'
    ? () => void | Promise<void>
    : (machineState: MachineState) => void | Promise<void>;

type ListenerMap = {
  pause: Array<(m: MachineState) => void | Promise<void>>;
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
  #pauseResolver: (() => void) | null = null;
  #activeStepMode: ResumeDirective | null = null;
  /**
   * Top of the halt-stack snapshotted at the most recent pause dispatch. Used by
   * stepOver / stepOut to recognize their natural endpoint (the click-time
   * frame is no longer on the stack). `null` when the click-time stack was
   * empty.
   */
  #capturedTopFrame: State | null = null;
  /**
   * The click-time top-frame frozen at the moment a step-over / step-out
   * directive was issued. Distinct from `#capturedTopFrame` (which tracks
   * EVERY pause); this one only updates when stepOver / stepOut accepts.
   */
  #clickTimeTopFrame: State | null = null;
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
    this.#clickTimeTopFrame = null;
    this.#releasePause();
  }

  /**
   * Resume and run until the click-time top halt-frame is no longer on the
   * stack, then pause at the first iter past that point. With an empty
   * click-time stack, collapses to `stepIn` (pause at next iter).
   *
   * One-shot: an inner breakpoint or any other pause drops the step-over
   * intent. The endpoint pause carries `cause: 'step'`.
   */
  stepOver(): void {
    this.#activeStepMode = 'step-over';
    this.#clickTimeTopFrame = this.#capturedTopFrame;
    this.#releasePause();
  }

  /**
   * Resume and run until the click-time top halt-frame is popped, then pause
   * at the next iter. Endpoint predicate is the same as stepOver; the
   * difference is the empty-stack contract:
   *   - stepOver: empty click-time stack → collapse to stepIn.
   *   - stepOut: empty click-time stack → throw (no enclosing frame to exit).
   *
   * Matches IDE convention: "step out of nothing" is a programming error,
   * not a silent no-op.
   */
  stepOut(): void {
    if (this.#capturedTopFrame === null) {
      throw new Error(
        'DebugSession.stepOut() called with an empty click-time halt-stack — there is no enclosing frame to exit.',
      );
    }
    this.#activeStepMode = 'step-out';
    this.#clickTimeTopFrame = this.#capturedTopFrame;
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
   * Emit a `pause` event with the synthesized debugBreak and await the consumer's
   * resume signal. Resolver is installed BEFORE listeners fire so a listener
   * that synchronously calls `session.continue()` (or any other resume method)
   * sees a live resolver to drop.
   *
   * One-shot rule: any pause dispatch (step-mode endpoint, inner breakpoint,
   * manual pause) drops the active step-mode BEFORE listeners fire. Listeners
   * that want to keep stepping must call stepIn/Over/Out from the new pause.
   *
   * The pre-iter halt-stack top is snapshotted into `#capturedTopFrame` so a
   * `stepOver` / `stepOut` issued from inside the listener can freeze it as
   * the click-time frame.
   */
  async #dispatchPause(machineState: MachineState, debugBreak: DebugBreak): Promise<void> {
    this.#activeStepMode = null;
    this.#clickTimeTopFrame = null;
    const stack = this.#readStack(machineState);
    this.#capturedTopFrame = stack.length > 0 ? stack[stack.length - 1] : null;

    // Note: the spread drops the non-enumerable MACHINE_STATE_INTERNAL Symbol
    // accessor — that's intentional. Pause listeners are public API; the
    // Symbol accessor is package-private and only consumed by the session's
    // OWN endpoint detection (which reads the original `machineState`,
    // not `paused`, via #readStack above).
    const paused: MachineState = {...machineState, debugBreak};
    const pausePromise = new Promise<void>((resolve) => {
      this.#pauseResolver = resolve;
    });
    for (const fn of this.#listeners.pause) {
      void fn(paused);
    }
    await pausePromise;
  }

  // Reads the pre-iter halt-stack snapshot installed by `runStepByStep`.
  // Returns empty if the accessor is missing (defensive — shouldn't happen
  // with the engine on this branch).
  #readStack(machineState: MachineState): readonly State[] {
    const fn = (machineState as unknown as Record<symbol, () => MachineStateInternal>)[MACHINE_STATE_INTERNAL];
    if (typeof fn !== 'function') return [];
    return fn().stack;
  }

  async start(): Promise<void> {
    if (this.#started) {
      throw new Error('DebugSession.start() has already been called; construct a fresh session to re-run.');
    }
    this.#started = true;

    for (const machineState of this.#machine.runStepByStep(this.#parameter)) {
      if (this.#stopped) return;

      const hasBeforeBreakpoint = machineState.debugBreak?.before === true;
      const hasAfterBreakpoint = machineState.debugBreak?.after === true;
      const stepInForcesPause = this.#activeStepMode === 'step-in';
      const stepOverEndpointReached =
        this.#activeStepMode === 'step-over'
        && (
          this.#clickTimeTopFrame === null  // empty click-time stack — collapse to stepIn
          || !this.#readStack(machineState).includes(this.#clickTimeTopFrame)
        );
      const stepOutEndpointReached =
        this.#activeStepMode === 'step-out'
        && this.#clickTimeTopFrame !== null
        && !this.#readStack(machineState).includes(this.#clickTimeTopFrame);
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
        const cause: DebugBreak['cause'] =
          hasBeforeBreakpoint ? 'breakpoint'
            : (stepInForcesPause || stepOverEndpointReached || stepOutEndpointReached) ? 'step'
              : 'manual';
        await this.#dispatchPause(machineState, {before: true, cause});
        if (this.#stopped) return;
      }

      // step: fires once per iter, after any before-pause and before any after-pause.
      for (const fn of this.#listeners.step) {
        void fn(machineState);
      }

      if (hasAfterBreakpoint) {
        await this.#dispatchPause(machineState, {after: true, cause: 'breakpoint'});
        if (this.#stopped) return;
      }

      // iter: end-of-iter, after both before- and after-pause have fired.
      for (const fn of this.#listeners.iter) {
        void fn(machineState);
      }

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
