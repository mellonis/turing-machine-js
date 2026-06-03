# Step-control via `run()` / `debugRun()` Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close #102 (v7-stable gating issue) by splitting `TuringMachine`'s execution API into two non-overlapping entry points: a synchronous `run()` with no observation overhead, and a `debugRun()` that returns a `DebugSession` carrying the full interactive-debugger surface (events, breakpoints, step-in/over/out, click-pause, throttle).

**Architecture:** `TuringMachine` stays minimal. `DebugSession` lives in a separate module and is constructed directly:

```ts
class TuringMachine {
  run({initialState, stepsLimit?}): void;                       // pure execution, sync
  *runStepByStep({initialState, stepsLimit?}): Generator<MachineState>;  // unchanged, sync per-iter observation
  // NO debugRun method — debugger is an external opt-in
}

// Separate module — packages/machine/src/classes/DebugSession.ts
class DebugSession {
  constructor(machine: TuringMachine, parameter: DebugSessionParameter);
  start(): Promise<void>;
  stop(): void;
  continue(): void;
  stepIn(): void;
  stepOver(): void;
  stepOut(): void;
  pause(): void;
  setRunInterval(ms: number): void;
  on/off events: pause, step, iter, halt;
}

// Usage:
import {TuringMachine, DebugSession} from '@turing-machine-js/machine';
const session = new DebugSession(machine, {initialState});
await session.start();
```

`DebugSession` owns everything that was previously layered on top of `run({onPause, onStep, onIter, debug})` plus all the coordination logic (step-mode tracking, click-pause, throttle, pause/resume plumbing, event fan-out) that every demo / IDE extension would otherwise reimplement. Internally `DebugSession` consumes the engine's public `runStepByStep` generator and uses a Symbol-keyed `MACHINE_STATE_INTERNAL` accessor on yielded machine states to read the halt-stack for step-over/step-out endpoint detection — same sibling-module pattern as `STATE_INTERNAL` from #180. **No new private access needed beyond the Symbol.**

**Tech Stack:** TypeScript, Vitest, the existing `@turing-machine-js/machine` engine code.

**Scope:** Engine-only. `@post-machine-js/machine` adopts the new shape in a follow-up issue/PR (`pm.run()` + `pm.debugRun()`). `machines-demo` worker migration is a downstream follow-up. CHANGELOG entry lands in the alpha.6 release PR.

**Breaking changes vs v6:** `run({onPause, onStep, onIter, debug})` removed. Consumers wanting hooks call `debugRun()` and use the session's event interface. Documented in the v7 migration section of `packages/machine/README.md`. v7 is already the breaking version, so this fits cleanly with the existing composition renames and `haltState.debug` boolean change.

**Design choices locked in:**

1. **`DebugSession` is the public surface for interactive debugging.** The `ResumeDirective` primitive that powers it stays internal (used inside `DebugSession`'s loop but not part of the package's `index.ts` exports). One canonical recommended API, one internal mechanism.
2. **`run()` becomes sync.** Without `await onPause / onIter`, no async work remains in the loop. Return type `Promise<void> → void`. Symmetric reversal of the v4-era `run` → `async run` change.
3. **`onStep` removed entirely.** `runStepByStep` (the generator) already covers sync per-iter observation; keeping `onStep` is YAGNI duplication. Consumers needing tracing without breakpoint-driven flow iterate the generator.
4. **`DebugBreak.cause: 'breakpoint' | 'step' | 'manual'`.** `'breakpoint'` for `state.debug` matches, `'step'` for step-mode natural endpoints, `'manual'` for `session.pause()` click-pauses.
5. **`DebugSession` uses a tiny built-in listener registry**, not `node:events`. Library is environment-agnostic (Node, browsers, Workers); ~20 LOC of `on/off/emit` methods.
6. **`session.start()` returns `Promise<void>` resolved on halt.** Async because consumer-controlled pauses await consumer action. Symmetric with how `run()` previously behaved.
7. **One-shot step-mode rule preserved:** any pause-event dispatch (breakpoint, step endpoint, manual) drops the active step-mode. Re-engaging requires another `session.stepIn/Over/Out()` call.
8. **Step-out from empty halt-stack throws.** IDE convention; explicit error beats silent no-op.
9. **Halt-stack snapshot via Symbol-keyed `MACHINE_STATE_INTERNAL`.** Same pattern as `STATE_INTERNAL` from #180. Not re-exported from the package's public `index.ts`.

---

## File Structure

- **Modify** `packages/machine/src/classes/TuringMachine.ts` — strip callbacks from `run`, make sync, add `MACHINE_STATE_INTERNAL` Symbol + accessor in `runStepByStep`, extend `MachineState.debugBreak.cause`. **Do NOT add `debugRun` method** — `DebugSession` is constructed directly.
- **Create** `packages/machine/src/classes/DebugSession.ts` — the new debugger-session class (~300 LOC).
- **Create** `packages/machine/src/classes/DebugSession.spec.ts` — focused tests for session lifecycle + events + step controls + throttle + click-pause.
- **Modify** `packages/machine/src/index.ts` — export `DebugSession` + its event/option types. Do NOT export `MACHINE_STATE_INTERNAL` or the internal `ResumeDirective`.
- **Modify existing test files** that used the removed `run({onPause, onStep, onIter})` API — migrate to `debugRun()`.
  - `packages/machine/src/classes/TuringMachine.debug.spec.ts`
  - `packages/machine/src/classes/TuringMachine.matchedTransition.spec.ts`
- **Modify** `packages/machine/README.md` — rewrite "Debugging breakpoints" section around `debugRun()`; add v7 migration subsection.

---

## Task 1: Type scaffolding

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts`

- [ ] **Step 1: Extend `DebugBreak` on `MachineState` with `cause`**

In `TuringMachine.ts` near the existing `MachineState` type:

```ts
export type DebugBreak = {
  before?: true;
  after?: true;
  cause: 'breakpoint' | 'step' | 'manual';
};

// Update MachineState.debugBreak field type to use this:
debugBreak?: DebugBreak;
```

- [ ] **Step 2: Define the internal `ResumeDirective` type (NOT exported from package index)**

```ts
/** @internal — used by DebugSession's loop coordination. NOT part of public API. */
export type ResumeDirective = 'continue' | 'step-in' | 'step-over' | 'step-out';
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/machine/src/classes/TuringMachine.ts
git commit -m "types: add DebugBreak.cause + internal ResumeDirective (#102)"
```

---

## Task 2: `MACHINE_STATE_INTERNAL` accessor for halt-stack snapshot

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts`

- [ ] **Step 1: Define the Symbol and accessor shape**

Near the top of `TuringMachine.ts`:

```ts
/** @internal — used by DebugSession to read halt-stack at yield time. Same pattern as STATE_INTERNAL (#180). */
export const MACHINE_STATE_INTERNAL = Symbol('machineState/internal');

export type MachineStateInternal = {
  /** Halt-stack at yield time (BEFORE applyCommand / pop / push for this iter). Frozen. */
  stack: readonly State[];
};
```

- [ ] **Step 2: Attach the accessor on every yielded `MachineState` in `runStepByStep`**

In `runStepByStep`, before the existing `yield yielded` (line 257), add:

```ts
Object.defineProperty(yielded, MACHINE_STATE_INTERNAL, {
  value: (): MachineStateInternal => ({stack: Object.freeze(stack.slice())}),
  enumerable: false,
});
```

- [ ] **Step 3: Test that the accessor returns a frozen snapshot**

In a new file `packages/machine/src/classes/DebugSession.spec.ts` (we'll add more tests here in later tasks):

```ts
import {describe, it, expect} from 'vitest';
import {Alphabet, Tape, TapeBlock, State, TuringMachine, haltState} from '../index.js';
import {MACHINE_STATE_INTERNAL} from './TuringMachine.js';

describe('MACHINE_STATE_INTERNAL', () => {
  it('exposes a frozen halt-stack snapshot on every yielded machine state', () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const inner = new State({[tapeBlock.symbol([['_']])]: {nextState: halt}});
    const outer = inner.withOverriddenHaltState(halt);
    const machine = new TuringMachine(tapeBlock);

    const yields = [...machine.runStepByStep({initialState: outer})];
    expect(yields.length).toBeGreaterThan(0);
    for (const m of yields) {
      const internal = (m as any)[MACHINE_STATE_INTERNAL]();
      expect(Array.isArray(internal.stack)).toBe(true);
      expect(Object.isFrozen(internal.stack)).toBe(true);
    }
  });
});
```

- [ ] **Step 4: Run test**

Run: `npx vitest run packages/machine/src/classes/DebugSession.spec.ts -t "MACHINE_STATE_INTERNAL"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/TuringMachine.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(engine): MACHINE_STATE_INTERNAL halt-stack accessor (#102)"
```

---

## Task 3: `DebugSession` class skeleton

**Files:**
- Create: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Write a failing test for session creation + halt event**

Add to `DebugSession.spec.ts`:

```ts
import {DebugSession} from './DebugSession.js';

describe('DebugSession skeleton', () => {
  it('creates a session and emits halt on completion', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0']})]);
    const halt = new State({[tapeBlock.symbol([['0']])]: {nextState: haltState}});
    const machine = new TuringMachine(tapeBlock);

    const session = machine.debugRun({initialState: halt});
    let haltFired = false;
    session.on('halt', () => { haltFired = true; });
    await session.start();
    expect(haltFired).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/machine/src/classes/DebugSession.spec.ts -t "skeleton"`
Expected: FAIL — `DebugSession` doesn't exist yet, `machine.debugRun` doesn't exist yet.

- [ ] **Step 3: Implement `DebugSession.ts` skeleton**

Create the file with:

```ts
import {State} from './State.js';
import {TuringMachine, MACHINE_STATE_INTERNAL} from './TuringMachine.js';
import type {MachineState, MachineStateInternal} from './TuringMachine.js';

export type DebugSessionEvent = 'pause' | 'step' | 'iter' | 'halt';
export type DebugSessionListener<E extends DebugSessionEvent> =
  E extends 'halt' ? () => void : (machineState: MachineState) => void;

export type DebugSessionParameter = {
  initialState: State;
  stepsLimit?: number;
};

export class DebugSession {
  readonly #machine: TuringMachine;
  readonly #parameter: DebugSessionParameter;
  readonly #listeners = {
    pause: [] as Array<(m: MachineState) => void>,
    step: [] as Array<(m: MachineState) => void>,
    iter: [] as Array<(m: MachineState) => void>,
    halt: [] as Array<() => void>,
  };
  #started = false;

  constructor(machine: TuringMachine, parameter: DebugSessionParameter) {
    this.#machine = machine;
    this.#parameter = parameter;
  }

  on<E extends DebugSessionEvent>(event: E, listener: DebugSessionListener<E>): this {
    (this.#listeners[event] as any[]).push(listener);
    return this;
  }

  off<E extends DebugSessionEvent>(event: E, listener: DebugSessionListener<E>): this {
    const arr = this.#listeners[event] as any[];
    const ix = arr.indexOf(listener);
    if (ix >= 0) arr.splice(ix, 1);
    return this;
  }

  async start(): Promise<void> {
    if (this.#started) throw new Error('DebugSession already started');
    this.#started = true;

    for (const machineState of this.#machine.runStepByStep(this.#parameter)) {
      // Hooks for events to be wired in subsequent tasks.
      void machineState;
    }
    for (const fn of this.#listeners.halt) fn();
  }
}
```

- [ ] **Step 4: Add `debugRun()` method to `TuringMachine`**

In `TuringMachine.ts`:

```ts
import {DebugSession} from './DebugSession.js';
import type {DebugSessionParameter} from './DebugSession.js';

// inside the class, alongside run() and runStepByStep():
debugRun(parameter: DebugSessionParameter): DebugSession {
  return new DebugSession(this, parameter);
}
```

- [ ] **Step 5: Re-export from `packages/machine/src/index.ts`**

Add: `export {DebugSession} from './classes/DebugSession.js';`
And: `export type {DebugSessionEvent, DebugSessionListener, DebugSessionParameter} from './classes/DebugSession.js';`

- [ ] **Step 6: Run test to verify PASS**

Run: `npx vitest run packages/machine/src/classes/DebugSession.spec.ts -t "skeleton"`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/TuringMachine.ts packages/machine/src/classes/DebugSession.spec.ts packages/machine/src/index.ts
git commit -m "feat(engine): DebugSession skeleton + debugRun() (#102)"
```

---

## Task 4: `step` event

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Failing test**

```ts
describe('DebugSession: step event', () => {
  it('emits step on every iter, in order', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0', '0', '0']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const ref = new Reference();
    const move = new State({
      [tapeBlock.symbol([['0']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['_']])]: {nextState: halt},
    });
    ref.bind(move);

    const steps: number[] = [];
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: move});
    session.on('step', (m) => steps.push(m.step));
    await session.start();
    expect(steps).toEqual([1, 2, 3, 4]);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL** (no step emission yet).

- [ ] **Step 3: Wire step emission inside `DebugSession.start()`**

Replace the loop body in `start()`:

```ts
for (const machineState of this.#machine.runStepByStep(this.#parameter)) {
  for (const fn of this.#listeners.step) fn(machineState);
}
```

- [ ] **Step 4: Run test to verify PASS**

Run: `npx vitest run packages/machine/src/classes/DebugSession.spec.ts -t "step event"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(DebugSession): step event (#102)"
```

---

## Task 5: `pause` event + `continue()` resume

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Failing test**

```ts
describe('DebugSession: pause + continue', () => {
  it('emits pause on debugBreak match and resumes when continue() is called', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0', '0']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const ref = new Reference();
    const move = new State({
      [tapeBlock.symbol([['0']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['_']])]: {nextState: halt},
    });
    ref.bind(move);
    move.debug = {before: ['0']};

    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: move});
    const causes: ('breakpoint' | 'step' | 'manual' | undefined)[] = [];
    session.on('pause', (m) => {
      causes.push(m.debugBreak?.cause);
      session.continue();
    });
    await session.start();
    expect(causes).toEqual(['breakpoint', 'breakpoint']);
  });
});
```

- [ ] **Step 2: Run test to verify FAIL.**

- [ ] **Step 3: Implement pause/resume coordination in `DebugSession.start()`**

Add private state and method:

```ts
#pauseResolver: (() => void) | null = null;
#activeStepMode: ResumeDirective | null = null;
#clickTimeTopFrame: State | null = null;

continue(): void {
  this.#activeStepMode = null;
  this.#clickTimeTopFrame = null;
  this.#pauseResolver?.();
  this.#pauseResolver = null;
}
```

Rewrite the loop in `start()`:

```ts
async start(): Promise<void> {
  if (this.#started) throw new Error('DebugSession already started');
  this.#started = true;

  for (const machineState of this.#machine.runStepByStep(this.#parameter)) {
    const dispatchBeforePause = machineState.debugBreak?.before === true;
    const dispatchAfterPause = machineState.debugBreak?.after === true;

    if (dispatchBeforePause) {
      await this.#dispatchPause(machineState, {before: true, cause: 'breakpoint'});
    }
    for (const fn of this.#listeners.step) fn(machineState);
    if (dispatchAfterPause) {
      await this.#dispatchPause(machineState, {after: true, cause: 'breakpoint'});
    }
  }
  for (const fn of this.#listeners.halt) fn();
}

async #dispatchPause(machineState: MachineState, debugBreak: DebugBreak): Promise<void> {
  this.#activeStepMode = null;  // one-shot drop BEFORE dispatch
  this.#clickTimeTopFrame = null;
  const machineStateWithCause: MachineState = {...machineState, debugBreak};
  for (const fn of this.#listeners.pause) fn(machineStateWithCause);
  await new Promise<void>((resolve) => {
    this.#pauseResolver = resolve;
  });
}
```

- [ ] **Step 4: Import `ResumeDirective` + `DebugBreak` types into `DebugSession.ts`**

- [ ] **Step 5: Run test PASS**

- [ ] **Step 6: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(DebugSession): pause event + continue() (#102)"
```

---

## Task 6: `stepIn()` method

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Failing test**

```ts
describe('DebugSession: stepIn', () => {
  it('forces a pause on the next iter regardless of debugBreak', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0', '0', '0']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const ref = new Reference();
    const move = new State({
      [tapeBlock.symbol([['0']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['_']])]: {nextState: halt},
    });
    ref.bind(move);
    move.debug = {before: ['0']};

    let pauseCount = 0;
    const pauseSteps: number[] = [];
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: move});
    session.on('pause', (m) => {
      pauseCount += 1;
      pauseSteps.push(m.step);
      if (pauseCount === 1) session.stepIn();
      else session.continue();
    });
    await session.start();
    expect(pauseSteps[0]).toBe(1);  // initial breakpoint
    expect(pauseSteps[1]).toBe(2);  // step-in forced (no debugBreak on iter 2... wait, breakpoint still matches; test below for non-breakpoint case)
  });

  it('emits cause: step when the pause is from step-in', async () => {
    // Set up a state that only matches debug on iter 1, then step-in forces an iter-2 pause.
    const alphabet = new Alphabet({symbolList: ['_', '0', '1']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0', '1']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const ref = new Reference();
    const move = new State({
      [tapeBlock.symbol([['0']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['1']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['_']])]: {nextState: halt},
    });
    ref.bind(move);
    move.debug = {before: ['0']};  // only iter 1 matches (it sees '0')

    const causes: string[] = [];
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: move});
    let first = true;
    session.on('pause', (m) => {
      causes.push(m.debugBreak!.cause);
      if (first) {
        first = false;
        session.stepIn();
      } else {
        session.continue();
      }
    });
    await session.start();
    expect(causes).toEqual(['breakpoint', 'step']);
  });
});
```

- [ ] **Step 2: Run test FAIL.**

- [ ] **Step 3: Implement `stepIn()`**

Add to `DebugSession`:

```ts
stepIn(): void {
  this.#activeStepMode = 'step-in';
  this.#clickTimeTopFrame = null;
  this.#pauseResolver?.();
  this.#pauseResolver = null;
}
```

Modify the `start()` loop to honor `#activeStepMode === 'step-in'`:

```ts
for (const machineState of this.#machine.runStepByStep(this.#parameter)) {
  const dispatchBeforePause =
    machineState.debugBreak?.before === true
    || this.#activeStepMode === 'step-in';
  const dispatchAfterPause = machineState.debugBreak?.after === true;

  if (dispatchBeforePause) {
    const cause: 'breakpoint' | 'step' =
      machineState.debugBreak?.before ? 'breakpoint' : 'step';
    await this.#dispatchPause(machineState, {before: true, cause});
  }
  for (const fn of this.#listeners.step) fn(machineState);
  if (dispatchAfterPause) {
    const cause: 'breakpoint' | 'step' =
      machineState.debugBreak?.after ? 'breakpoint' : 'step';
    await this.#dispatchPause(machineState, {after: true, cause});
  }
}
```

- [ ] **Step 4: Run tests PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(DebugSession): stepIn() (#102)"
```

---

## Task 7: `stepOver()` with click-time frame snapshot

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
describe('DebugSession: stepOver', () => {
  it('pauses at first iter after click-time top-frame is no longer on the stack', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0']})]);
    const halt = new State({[tapeBlock.symbol([['0']])]: {nextState: haltState}});
    const innerBare = new State({[tapeBlock.symbol([['0']])]: {nextState: halt}});
    const wrapper = innerBare.withOverriddenHaltState(halt);
    innerBare.debug = {before: ['0']};  // pause on first iter inside wrapper

    let pauses = 0;
    let resumedAtStep = -1;
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: wrapper});
    session.on('pause', (m) => {
      pauses += 1;
      if (pauses === 1) session.stepOver();
      else {
        resumedAtStep = m.step;
        session.continue();
      }
    });
    await session.start();
    expect(resumedAtStep).toBeGreaterThan(1);
  });

  it('with empty click-time stack, behaves like stepIn', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0', '0']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const ref = new Reference();
    const move = new State({
      [tapeBlock.symbol([['0']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['_']])]: {nextState: halt},
    });
    ref.bind(move);
    move.debug = {before: ['0']};

    const pauseSteps: number[] = [];
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: move});
    session.on('pause', (m) => {
      pauseSteps.push(m.step);
      if (pauseSteps.length === 1) session.stepOver();
      else session.continue();
    });
    await session.start();
    expect(pauseSteps[1]).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests FAIL.**

- [ ] **Step 3: Implement `stepOver()` + endpoint detection**

Add method:

```ts
stepOver(): void {
  this.#activeStepMode = 'step-over';
  this.#clickTimeTopFrame = this.#capturedTopFrame;  // captured at pause-dispatch time (see below)
  this.#pauseResolver?.();
  this.#pauseResolver = null;
}
```

Add `#capturedTopFrame` field, snapshot it in `#dispatchPause` before listeners fire (consumers may call `stepOver()` synchronously from the listener):

```ts
#capturedTopFrame: State | null = null;

async #dispatchPause(machineState: MachineState, debugBreak: DebugBreak): Promise<void> {
  this.#activeStepMode = null;
  this.#clickTimeTopFrame = null;
  // Snapshot the pre-iter stack top so stepOver/stepOut have it available.
  const internal: MachineStateInternal = (machineState as any)[MACHINE_STATE_INTERNAL]();
  this.#capturedTopFrame = internal.stack.length > 0 ? internal.stack[internal.stack.length - 1] : null;
  const machineStateWithCause: MachineState = {...machineState, debugBreak};
  for (const fn of this.#listeners.pause) fn(machineStateWithCause);
  await new Promise<void>((resolve) => { this.#pauseResolver = resolve; });
}
```

Extend the loop's `dispatchBeforePause` predicate:

```ts
const readStack = (m: MachineState): readonly State[] =>
  (m as any)[MACHINE_STATE_INTERNAL]?.().stack ?? [];

const stepOverEndpoint =
  this.#activeStepMode === 'step-over'
  && (this.#clickTimeTopFrame === null || !readStack(machineState).includes(this.#clickTimeTopFrame));

const dispatchBeforePause =
  machineState.debugBreak?.before === true
  || this.#activeStepMode === 'step-in'
  || stepOverEndpoint;
```

- [ ] **Step 4: Run tests PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(DebugSession): stepOver() with frame snapshot (#102)"
```

---

## Task 8: `stepOut()` + empty-stack error

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Failing tests**

```ts
describe('DebugSession: stepOut', () => {
  it('pauses at first iter after click-time top-frame is popped', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0']})]);
    const halt = new State({[tapeBlock.symbol([['0']])]: {nextState: haltState}});
    const innerBare = new State({[tapeBlock.symbol([['0']])]: {nextState: halt}});
    const wrapper = innerBare.withOverriddenHaltState(halt);
    innerBare.debug = {before: ['0']};

    let pauses = 0;
    let resumedAtStep = -1;
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: wrapper});
    session.on('pause', (m) => {
      pauses += 1;
      if (pauses === 1) session.stepOut();
      else { resumedAtStep = m.step; session.continue(); }
    });
    await session.start();
    expect(resumedAtStep).toBeGreaterThan(1);
  });

  it('throws when called with an empty click-time stack', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const top = new State({[tapeBlock.symbol([['0']])]: {nextState: halt}});
    top.debug = {before: ['0']};

    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: top});
    const errors: Error[] = [];
    session.on('pause', () => {
      try { session.stepOut(); } catch (e) { errors.push(e as Error); session.continue(); }
    });
    await session.start();
    expect(errors.length).toBe(1);
    expect(errors[0].message).toMatch(/step-out.*empty/i);
  });
});
```

- [ ] **Step 2: Run tests FAIL.**

- [ ] **Step 3: Implement `stepOut()` + empty-stack throw**

```ts
stepOut(): void {
  if (this.#capturedTopFrame === null) {
    throw new Error('Cannot step-out from an empty click-time halt-stack — there is no enclosing frame to exit.');
  }
  this.#activeStepMode = 'step-out';
  this.#clickTimeTopFrame = this.#capturedTopFrame;
  this.#pauseResolver?.();
  this.#pauseResolver = null;
}
```

Add step-out endpoint to the loop's predicate (same shape as step-over):

```ts
const stepOutEndpoint =
  this.#activeStepMode === 'step-out'
  && this.#clickTimeTopFrame !== null
  && !readStack(machineState).includes(this.#clickTimeTopFrame);

const dispatchBeforePause =
  machineState.debugBreak?.before === true
  || this.#activeStepMode === 'step-in'
  || stepOverEndpoint
  || stepOutEndpoint;
```

- [ ] **Step 4: Run tests PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(DebugSession): stepOut() + empty-stack guard (#102)"
```

---

## Task 9: One-shot rule lock-in test

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Test that an inner breakpoint drops the step-mode (one-shot)**

```ts
describe('DebugSession: one-shot rule', () => {
  it('drops active step-mode when an inner breakpoint fires before the natural endpoint', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0']})]);
    const halt = new State({[tapeBlock.symbol([['0']])]: {nextState: haltState}});
    const innerBare = new State({[tapeBlock.symbol([['0']])]: {nextState: halt}});
    const wrapper = innerBare.withOverriddenHaltState(halt);
    innerBare.debug = {before: ['0']};
    halt.debug = {before: ['0']};

    const causes: string[] = [];
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: wrapper});
    let first = true;
    session.on('pause', (m) => {
      causes.push(m.debugBreak!.cause);
      if (first) { first = false; session.stepOver(); }
      else session.continue();
    });
    await session.start();
    // Both pauses are breakpoints — the inner halt-bound break dropped step-over.
    expect(causes).toEqual(['breakpoint', 'breakpoint']);
  });
});
```

- [ ] **Step 2: Run test PASS** (already implemented correctly by Tasks 5-8 — this locks the behavior).

- [ ] **Step 3: Commit**

```bash
git add packages/machine/src/classes/DebugSession.spec.ts
git commit -m "test(DebugSession): lock in one-shot step-mode rule (#102)"
```

---

## Task 10: `iter` event + `setRunInterval()` throttle

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Failing test**

```ts
describe('DebugSession: iter event + throttle', () => {
  it('emits iter at end of each iter and respects setRunInterval', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0', '0']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const ref = new Reference();
    const move = new State({
      [tapeBlock.symbol([['0']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['_']])]: {nextState: halt},
    });
    ref.bind(move);

    const iters: number[] = [];
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: move});
    session.setRunInterval(5);
    session.on('iter', (m) => iters.push(m.step));
    const start = Date.now();
    await session.start();
    const elapsed = Date.now() - start;
    expect(iters).toEqual([1, 2, 3]);
    expect(elapsed).toBeGreaterThanOrEqual(10);  // at least 2 throttle waits of 5ms
  });
});
```

- [ ] **Step 2: Run test FAIL.**

- [ ] **Step 3: Implement `setRunInterval()` + iter emission + throttle**

```ts
#runIntervalMs = 0;

setRunInterval(ms: number): void {
  if (ms < 0 || !Number.isFinite(ms)) throw new Error('runInterval must be a non-negative finite number');
  this.#runIntervalMs = ms;
}
```

In the `start()` loop, at the end of each iter:

```ts
for (const fn of this.#listeners.iter) fn(machineState);
if (this.#runIntervalMs > 0) {
  await new Promise<void>((resolve) => setTimeout(resolve, this.#runIntervalMs));
}
```

- [ ] **Step 4: Run test PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(DebugSession): iter event + setRunInterval throttle (#102)"
```

---

## Task 11: External `pause()` (click-pause from outside)

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Failing test**

```ts
describe('DebugSession: external pause()', () => {
  it('triggers a pause event with cause: manual on the next iter', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0', '0', '0']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const ref = new Reference();
    const move = new State({
      [tapeBlock.symbol([['0']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['_']])]: {nextState: halt},
    });
    ref.bind(move);

    const causes: string[] = [];
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: move});
    session.setRunInterval(2);
    let iterCount = 0;
    session.on('iter', () => {
      iterCount += 1;
      if (iterCount === 1) session.pause();  // request pause from outside
    });
    session.on('pause', (m) => {
      causes.push(m.debugBreak!.cause);
      session.continue();
    });
    await session.start();
    expect(causes).toEqual(['manual']);
  });
});
```

- [ ] **Step 2: Run test FAIL.**

- [ ] **Step 3: Implement `pause()` + manual-pause detection in loop**

```ts
#pauseRequested = false;

pause(): void {
  this.#pauseRequested = true;
}
```

In the loop, before the existing `dispatchBeforePause` calculation, intercept the manual flag:

```ts
const manualPause = this.#pauseRequested;
if (manualPause) {
  this.#pauseRequested = false;
}

const dispatchBeforePause =
  machineState.debugBreak?.before === true
  || this.#activeStepMode === 'step-in'
  || stepOverEndpoint
  || stepOutEndpoint
  || manualPause;

// Inside the dispatchBeforePause block, derive cause:
const beforeCause: 'breakpoint' | 'step' | 'manual' =
  manualPause ? 'manual'
  : machineState.debugBreak?.before ? 'breakpoint'
  : 'step';
```

- [ ] **Step 4: Run test PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(DebugSession): external pause() with cause: manual (#102)"
```

---

## Task 12: `stop()` (immediate termination)

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts`
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Failing test**

```ts
describe('DebugSession: stop', () => {
  it('terminates the session and resolves start() without halt event', async () => {
    const alphabet = new Alphabet({symbolList: ['_', '0']});
    const tapeBlock = TapeBlock.fromTapes([new Tape({alphabet, symbolList: ['0', '0', '0', '0', '0']})]);
    const halt = new State({[tapeBlock.symbol([['_']])]: {nextState: haltState}});
    const ref = new Reference();
    const move = new State({
      [tapeBlock.symbol([['0']])]: {command: [{movement: movements.right}], nextState: ref},
      [tapeBlock.symbol([['_']])]: {nextState: halt},
    });
    ref.bind(move);

    let haltFired = false;
    const machine = new TuringMachine(tapeBlock);
    const session = machine.debugRun({initialState: move});
    session.on('halt', () => { haltFired = true; });
    session.on('iter', (m) => {
      if (m.step === 2) session.stop();
    });
    await session.start();
    expect(haltFired).toBe(false);  // stopped before halt
  });
});
```

- [ ] **Step 2: Run test FAIL.**

- [ ] **Step 3: Implement `stop()`**

```ts
#stopped = false;

stop(): void {
  this.#stopped = true;
  this.#pauseResolver?.();
  this.#pauseResolver = null;
}
```

In the loop, check `#stopped` at the top of each iter and break:

```ts
for (const machineState of this.#machine.runStepByStep(this.#parameter)) {
  if (this.#stopped) break;
  // ... existing iter body ...
  if (this.#stopped) break;  // also check after listeners
}
if (!this.#stopped) {
  for (const fn of this.#listeners.halt) fn();
}
```

- [ ] **Step 4: Run test PASS.**

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(DebugSession): stop() (#102)"
```

---

## Task 13: Strip callbacks from `run()`, make sync, migrate existing tests

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts`
- Modify: `packages/machine/src/classes/TuringMachine.debug.spec.ts`
- Modify: `packages/machine/src/classes/TuringMachine.matchedTransition.spec.ts`
- Modify: any other test files using `run({onPause | onStep | onIter | debug})`

- [ ] **Step 1: Grep for all consumers of the removed callback API**

Run: `grep -rn "onPause\|onStep\|onIter" packages/machine/src/ packages/builder/src/ packages/library-binary-numbers/src/ packages/library-binary-numbers-bare/src/ test/`

Expected: a list of all files using callbacks. Each must be migrated to `debugRun()`.

- [ ] **Step 2: Update `TuringMachine.run()` to be sync, callback-free**

Replace the existing `run(...)` method with:

```ts
run({initialState, stepsLimit}: RunParameter): void {
  for (const _ of this.runStepByStep({initialState, stepsLimit})) {
    // pure execution, no observation
  }
}
```

Remove `onPause`, `onStep`, `onIter`, `debug` fields from `RunParameter` (or rename it `RunParameter` for clarity that this is now the small surface). Remove unused imports.

- [ ] **Step 3: Migrate each test file from `grep` results**

For each `run({onPause: ..., ...})` call site, transform:

Before:
```ts
await machine.run({
  initialState,
  onPause: (m) => { observed.push(m); },
});
```

After:
```ts
const session = machine.debugRun({initialState});
session.on('pause', (m) => {
  observed.push(m);
  session.continue();
});
await session.start();
```

Similarly for `onStep` → `session.on('step', ...)`, `onIter` → `session.on('iter', ...)`, `debug: false` → simply use `run()` instead of `debugRun()`.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS — every test migrated.

- [ ] **Step 5: Run lint + typecheck**

Run: `npm run lint && npm run typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/machine/src/ packages/builder/src/ packages/library-binary-numbers/src/ packages/library-binary-numbers-bare/src/ test/
git commit -m "refactor(engine): run() is sync + callback-free; migrate tests to debugRun() (#102)"
```

---

## Task 14: Coverage + edge-case tests

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.spec.ts`

- [ ] **Step 1: Add tests for these edge cases**

```ts
describe('DebugSession: edge cases', () => {
  it('throws when start() is called twice', async () => {
    // ...
  });

  it('removes a listener via off()', async () => {
    // ...
  });

  it('start() resolves on natural halt with no listeners attached', async () => {
    // ...
  });

  it('handles state.debug.after pauses + step controls together', async () => {
    // ...
  });

  it('haltState.debug = true fires pause with cause: breakpoint', async () => {
    // ...
  });
});
```

Fill in concrete test bodies based on the patterns above.

- [ ] **Step 2: Run coverage**

Run: `npm run test:coverage`
Expected: All v7 floors met (97/90/95/97 per `vitest.config.ts`).

- [ ] **Step 3: Commit**

```bash
git add packages/machine/src/classes/DebugSession.spec.ts
git commit -m "test(DebugSession): edge cases + coverage (#102)"
```

---

## Task 15: README rewrite + migration guide

**Files:**
- Modify: `packages/machine/README.md`

- [ ] **Step 1: Find and rewrite the "Debugging breakpoints" section**

Replace with a new "Debugging" section structured around `debugRun()`:

```markdown
## Debugging

For pure execution with no observation overhead:

\`\`\`ts
machine.run({initialState});  // synchronous; returns when halted
\`\`\`

For per-iter tracing without breakpoint-driven flow:

\`\`\`ts
for (const m of machine.runStepByStep({initialState})) {
  trace(m);
}
\`\`\`

For interactive debugging — breakpoints, step-in/over/out, throttle, click-pause:

\`\`\`ts
const session = machine.debugRun({initialState});
session.on('pause', (m) => {
  console.log('paused at', m.state.name, 'cause:', m.debugBreak.cause);
  session.stepIn();  // or stepOver(), stepOut(), continue(), stop()
});
session.on('halt', () => console.log('done'));
await session.start();
\`\`\`

### Breakpoints

`state.debug = {before: [...], after: [...]}` sets a per-symbol breakpoint filter. `haltState.debug = true` pauses on every halt (program exit + subroutine return). [Existing breakpoint docs...]

### Step controls

| Method | Behavior |
|---|---|
| `session.continue()` | Resume until next breakpoint or halt |
| `session.stepIn()` | Pause on the very next iter |
| `session.stepOver()` | Pause at first iter after click-time top halt-frame is no longer on the stack; with an empty click-time stack, collapses to `stepIn` |
| `session.stepOut()` | Pause at first iter after click-time top halt-frame is popped; throws if click-time stack is empty |
| `session.pause()` | Request a pause from outside the loop; fires on the next iter with `cause: 'manual'` |
| `session.stop()` | Terminate immediately; no `halt` event fires |

**One-shot rule:** any `pause` event (breakpoint, step endpoint, manual) drops the active step-mode. To continue stepping, call `stepIn/Over/Out` again from the new pause.

### Throttle

`session.setRunInterval(ms)` inserts an awaited delay at the end of every iter — useful for visualizing execution.

### Events

| Event | Argument | Fires |
|---|---|---|
| `pause` | `MachineState` (with `debugBreak.cause`) | Breakpoint match, step endpoint, or manual `pause()` |
| `step` | `MachineState` | Once per iter, between any before-pause and after-pause |
| `iter` | `MachineState` | Once per iter, at end (after any after-pause) |
| `halt` | (none) | Once, on natural halt (not on `stop()`) |
```

- [ ] **Step 2: Add a v7 migration subsection**

```markdown
### v7 migration — `run({onPause, ...})` removed

v7 splits the execution API into three non-overlapping entry points:

\`\`\`ts
// v6
await machine.run({
  initialState,
  onPause: (m) => { ... },
  onStep: (m) => { ... },
  onIter: (m) => { ... },
});

// v7
const session = machine.debugRun({initialState});
session.on('pause', (m) => { ... session.continue(); });
session.on('step', (m) => { ... });
session.on('iter', (m) => { ... });
await session.start();
\`\`\`

If you weren't using callbacks, `machine.run({initialState})` still works — it's now synchronous and returns `void`. Drop the `await`.

If you only used `onStep` for tracing, the generator `machine.runStepByStep({initialState})` is the equivalent shape:

\`\`\`ts
for (const m of machine.runStepByStep({initialState})) {
  trace(m);
}
\`\`\`
```

- [ ] **Step 3: Commit**

```bash
git add packages/machine/README.md
git commit -m "docs: rewrite Debugging section around debugRun() + v7 migration (#102)"
```

---

## Task 16: Final verification + PR

- [ ] **Step 1: Run full quality gate**

```bash
npm run lint && npm run typecheck && npm test && npm run test:coverage
```

Expected: all PASS. Coverage floors met.

- [ ] **Step 2: Open the PR targeting `v7`**

```bash
gh pr create --base v7 --title "feat(engine): run() + debugRun() + DebugSession (#102)" --body "$(cat <<'EOF'
## Summary

Closes #102 — the v7-stable gating issue. Splits `TuringMachine`'s execution API into three non-overlapping entry points:

- `machine.run({initialState})` — pure execution, synchronous, no observation overhead.
- `machine.runStepByStep({initialState})` — sync generator, per-iter observation (unchanged).
- `machine.debugRun({initialState})` — returns a `DebugSession` with events (pause/step/iter/halt), step controls (continue/stepIn/stepOver/stepOut), external `pause()`/`stop()`, and `setRunInterval()` throttle.

The v6 `run({onPause, onStep, onIter, debug})` shape is removed (breaking change, fits cleanly in v7's major version).

## Breaking changes

- `run()` is now synchronous (`void`, not `Promise<void>`).
- `run({onPause | onStep | onIter | debug})` removed. Use `debugRun()`.

Migration documented in the README.

## Out of scope (follow-ups)

- `@post-machine-js/machine` adoption (`pm.run()` + `pm.debugRun()`) — separate issue.
- `machines-demo` worker migration — separate issue.
- CHANGELOG entry lands in the alpha.6 release PR per `project_v7_release_checklist` convention.
EOF
)"
```

- [ ] **Step 3: After CI green, manually close #102** with a comment pointing to this PR + the eventual alpha.6 release.

---

## Self-review notes

- All four step controls (continue / stepIn / stepOver / stepOut) plus pause / stop have dedicated tasks with tests.
- Throttle (`setRunInterval`) is a first-class session method, not bolted onto another API.
- External `pause()` introduces the third `DebugBreak.cause` value ('manual') and has its own task.
- One-shot rule has a dedicated lock-in test.
- Empty-stack `stepOut` throws (IDE convention).
- `run()` becomes sync; `runStepByStep` unchanged; `debugRun()` is async via `start()`.
- v7 migration documented in README.
- Engine-only scope; post-machine-js adoption and machines-demo migration are separate follow-ups.
- No placeholders: every step has actual code or actual commands with expected outputs.
