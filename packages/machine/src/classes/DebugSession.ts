import State from './State';
import TuringMachine, {type DebugBreak, type MachineState} from './TuringMachine';

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
   * Resume from the current pause, returning to normal execution until the
   * next breakpoint or natural halt. No-op when called outside of a paused
   * state.
   */
  continue(): void {
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
   */
  async #dispatchPause(machineState: MachineState, debugBreak: DebugBreak): Promise<void> {
    const paused: MachineState = {...machineState, debugBreak};
    const pausePromise = new Promise<void>((resolve) => {
      this.#pauseResolver = resolve;
    });
    for (const fn of this.#listeners.pause) {
      void fn(paused);
    }
    await pausePromise;
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

      if (hasBeforeBreakpoint) {
        await this.#dispatchPause(machineState, {before: true, cause: 'breakpoint'});
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
    }

    if (!this.#stopped) {
      for (const fn of this.#listeners.halt) {
        void fn();
      }
    }
  }
}
