import State from './State';
import TuringMachine, {type MachineState} from './TuringMachine';

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
  }

  async start(): Promise<void> {
    if (this.#started) {
      throw new Error('DebugSession.start() has already been called; construct a fresh session to re-run.');
    }
    this.#started = true;

    for (const machineState of this.#machine.runStepByStep(this.#parameter)) {
      if (this.#stopped) return;
      // Hooks (step / pause / iter dispatch) wire in here in subsequent tasks.
      void machineState;
    }

    if (!this.#stopped) {
      for (const fn of this.#listeners.halt) {
        void fn();
      }
    }
  }
}
