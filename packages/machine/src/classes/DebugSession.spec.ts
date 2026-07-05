import {describe, it, expect} from 'vitest';
import Alphabet from './Alphabet';
import State, {abortState, haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {MACHINE_STATE_INTERNAL, type MachineStateInternal, type RunResult} from './TuringMachine';
import {movements, symbolCommands} from './TapeCommand';
import DebugSession from './DebugSession';

// Shared helper: builds a 1-state machine that halts on the first A.
const buildSimple = () => {
  const alphabet = new Alphabet(' A'.split(''));
  const tape = new Tape({alphabet, symbols: ['A']});
  const tapeBlock = TapeBlock.fromTapes([tape]);
  const machine = new TuringMachine({tapeBlock});
  const {symbol} = tapeBlock;
  const haltWrapper = new State({[symbol(['A'])]: {nextState: haltState}});
  return {machine, haltWrapper, tapeBlock};
};

const readInternal = (m: unknown): MachineStateInternal =>
  (m as Record<symbol, () => MachineStateInternal>)[MACHINE_STATE_INTERNAL]();

describe('MACHINE_STATE_INTERNAL accessor on yielded MachineState', () => {
  it('exposes a frozen halt-stack snapshot on every iter', () => {
    const {machine, haltWrapper} = buildSimple();
    const inner = haltWrapper;
    const outer = inner.withOverriddenHaltState(haltWrapper);

    const yields = [...machine.runStepByStep({initialState: outer})];

    expect(yields.length).toBeGreaterThan(0);
    for (const m of yields) {
      const internal = readInternal(m);
      expect(Array.isArray(internal.stack)).toBe(true);
      expect(Object.isFrozen(internal.stack)).toBe(true);
    }
  });

  it("does NOT include the accessor in enumerable spread / toEqual", () => {
    const {machine, haltWrapper} = buildSimple();

    const [m] = [...machine.runStepByStep({initialState: haltWrapper})];
    // Enumerable spread must NOT include the symbol-keyed accessor.
    expect(Object.keys(m)).not.toContain(MACHINE_STATE_INTERNAL.toString());
    // toEqual on the visible shape must succeed even though the symbol prop is present.
    expect(m).toEqual(expect.objectContaining({state: haltWrapper, step: 1}));
  });

  it('captures the PRE-iter stack (snapshot taken before this iter advances)', () => {
    const {machine, haltWrapper} = buildSimple();
    const outer = haltWrapper.withOverriddenHaltState(haltWrapper);

    const [first] = [...machine.runStepByStep({initialState: outer})];
    const internal = readInternal(first);
    // Iter 1 is inside the wrapper — the wrapper's overriddenHaltState (haltWrapper) is on the stack.
    expect(internal.stack.length).toBe(1);
    expect(internal.stack[0]).toBe(haltWrapper);
  });
});

describe('DebugSession skeleton', () => {
  it('runs to natural halt and fires the halt listener', async () => {
    const {machine, haltWrapper} = buildSimple();
    const session = new DebugSession(machine, {initialState: haltWrapper});
    let halted = false;
    session.on('halt', () => { halted = true; });
    await session.start();
    expect(halted).toBe(true);
  });

  it("doesn't fire halt when stop() is called", async () => {
    const {machine, haltWrapper} = buildSimple();
    const session = new DebugSession(machine, {initialState: haltWrapper});
    let halted = false;
    session.on('halt', () => { halted = true; });
    session.stop();
    await session.start();
    expect(halted).toBe(false);
  });

  it('throws on a second start() call', async () => {
    const {machine, haltWrapper} = buildSimple();
    const session = new DebugSession(machine, {initialState: haltWrapper});
    await session.start();
    await expect(session.start()).rejects.toThrow(/already been called/);
  });

  it('rejects a second concurrent session on the same machine with a clear error', async () => {
    // Two sessions on one machine fight over the single TapeBlock lock. The
    // first to start holds it while paused; the second's start() should reject
    // with a cause-naming message, NOT the low-level 'Lock check failed'.
    const {machine, state} = buildWalker(['A', 'A']);
    state.debug = {before: true};

    const sessionA = new DebugSession(machine, {initialState: state});
    let aPaused = false;
    sessionA.on('pause', () => { aPaused = true; /* hold the pause — don't resume */ });
    // Start A but don't await — it parks on the first before-pause, holding the lock.
    const aPromise = sessionA.start();
    // Yield a macrotask so A reaches its first pause.
    await new Promise((r) => setTimeout(r, 0));
    expect(aPaused).toBe(true);

    const sessionB = new DebugSession(machine, {initialState: state});
    await expect(sessionB.start()).rejects.toThrow(/already in progress on this machine/);

    // Clean up A so the test doesn't leak a held lock.
    sessionA.stop();
    await aPromise;
  });

  it('off() removes a previously registered listener', async () => {
    const {machine, haltWrapper} = buildSimple();
    const session = new DebugSession(machine, {initialState: haltWrapper});
    let fired = 0;
    const handler = () => { fired += 1; };
    session.on('halt', handler);
    session.off('halt', handler);
    await session.start();
    expect(fired).toBe(0);
  });
});

// Builds a many-step machine that walks right across the tape until blank.
const buildWalker = (symbols: string[]) => {
  const alphabet = new Alphabet(' A'.split(''));
  const tape = new Tape({alphabet, symbols});
  const tapeBlock = TapeBlock.fromTapes([tape]);
  const machine = new TuringMachine({tapeBlock});
  const {symbol} = tapeBlock;
  const state: State = new State({
    [symbol(['A'])]: {command: [{symbol: symbolCommands.keep, movement: movements.right}]},
    [symbol([' '])]: {nextState: haltState},
  });
  return {machine, state};
};

describe('DebugSession: step event', () => {
  it('emits step once per iter, in iter order', async () => {
    const {machine, state} = buildWalker(['A', 'A', 'A']);
    const session = new DebugSession(machine, {initialState: state});
    const steps: number[] = [];
    session.on('step', (m) => { steps.push(m.step); });
    await session.start();
    expect(steps).toEqual([1, 2, 3, 4]);  // 3 A-iters + 1 blank-halt iter
  });

  it('passes the live MachineState to listeners (state field is the current State)', async () => {
    const {machine, state} = buildWalker(['A']);
    const session = new DebugSession(machine, {initialState: state});
    const seen: State[] = [];
    session.on('step', (m) => { seen.push(m.state); });
    await session.start();
    expect(seen.length).toBe(2);
    expect(seen[0]).toBe(state);  // iter 1
    expect(seen[1]).toBe(state);  // iter 2 (blank → halt)
  });
});

describe('DebugSession: pause event + continue()', () => {
  it('emits pause on before-side match with cause: breakpoint', async () => {
    const {machine, state} = buildWalker(['A', 'A']);
    state.debug = {before: true};
    const session = new DebugSession(machine, {initialState: state});
    const pauses: Array<{step: number; side: string; cause: string}> = [];
    session.on('pause', (m) => {
      pauses.push({step: m.step, ...m.pause});
      session.continue();
    });
    await session.start();
    // Three iters total (iter 1 = A, iter 2 = A, iter 3 = blank → halt);
    // {before: true} matches every symbol so all three pause.
    expect(pauses).toEqual([
      {step: 1, side: 'before', cause: 'breakpoint'},
      {step: 2, side: 'before', cause: 'breakpoint'},
      {step: 3, side: 'before', cause: 'breakpoint'},
    ]);
  });

  it('emits pause on after-side match too', async () => {
    const {machine, state} = buildWalker(['A']);
    state.debug = {after: true};
    const session = new DebugSession(machine, {initialState: state});
    const causes: Array<{side: string; cause: string}> = [];
    session.on('pause', (m) => {
      causes.push({
        side: m.pause.side,
        cause: m.pause.cause,
      });
      session.continue();
    });
    await session.start();
    // Two iters (iter 1 = A, iter 2 = blank → halt); both match after-side filter.
    expect(causes).toEqual([
      {side: 'after', cause: 'breakpoint'},
      {side: 'after', cause: 'breakpoint'},
    ]);
  });

  it('blocks the loop until continue() is called (no step fires during a held pause)', async () => {
    const {machine, state} = buildWalker(['A', 'A']);
    state.debug = {before: true};
    const session = new DebugSession(machine, {initialState: state});

    let firstPauseFired = false;
    let firstPauseResumed = false;
    let stepsDuringFirstHold = 0;

    session.on('step', () => {
      if (firstPauseFired && !firstPauseResumed) stepsDuringFirstHold += 1;
    });
    session.on('pause', async () => {
      if (!firstPauseFired) {
        firstPauseFired = true;
        await new Promise((r) => setTimeout(r, 10));
        firstPauseResumed = true;
      }
      session.continue();
    });
    await session.start();
    expect(stepsDuringFirstHold).toBe(0);  // pause genuinely blocks the loop
  });

  it('a synchronous continue() inside the listener releases the pause immediately', async () => {
    const {machine, state} = buildWalker(['A']);
    state.debug = {before: true};
    const session = new DebugSession(machine, {initialState: state});
    let resumeCalledSync = false;
    session.on('pause', () => {
      session.continue();
      resumeCalledSync = true;
    });
    await session.start();
    expect(resumeCalledSync).toBe(true);
  });

  it('stepIn() forces a pause on the next iter with cause: step', async () => {
    // Walker has 'A' symbols that loop; final iter sees blank and halts.
    // We arm a breakpoint that matches ONLY iter 1, then stepIn from there;
    // iter 2's pause should fire even though no filter matches.
    const alphabet = new Alphabet(' AB'.split(''));
    const tape = new Tape({alphabet, symbols: ['A', 'B']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const state = new State({
      [symbol(['A'])]: {command: [{symbol: symbolCommands.keep, movement: movements.right}]},
      [symbol(['B'])]: {command: [{symbol: symbolCommands.keep, movement: movements.right}]},
      [symbol([' '])]: {nextState: haltState},
    });
    state.debug = {before: [symbol(['A'])]};  // matches iter 1 only (sees 'A' on first iter)

    const session = new DebugSession(machine, {initialState: state});
    const causes: Array<{step: number; cause: string}> = [];
    let firstHandled = false;
    session.on('pause', (m) => {
      causes.push({step: m.step, cause: m.pause.cause});
      if (!firstHandled) {
        firstHandled = true;
        session.stepIn();
      } else {
        session.continue();
      }
    });
    await session.start();
    expect(causes[0]).toEqual({step: 1, cause: 'breakpoint'});
    expect(causes[1]).toEqual({step: 2, cause: 'step'});
  });

  it('stepOver() pauses at the first iter after click-time top-frame is no longer on the stack', async () => {
    // Setup: outer wrapper around an inner state. Click-time stack at iter 1
    // (inside outer's bare) contains the wrapper's overriddenHaltState (= haltWrapper).
    // stepOver should run until that frame is gone — which happens at iter 2,
    // when the inner halts → halt-pop → state advances to halt; iter 2's pause
    // fires because the stack is now empty.
    const alphabet = new Alphabet(' A'.split(''));
    const tape = new Tape({alphabet, symbols: ['A']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const haltWrapper = new State({[symbol(['A'])]: {nextState: haltState}, [symbol([' '])]: {nextState: haltState}});
    const inner = new State({[symbol(['A'])]: {nextState: haltWrapper}, [symbol([' '])]: {nextState: haltWrapper}});
    const outer = inner.withOverriddenHaltState(haltWrapper);
    inner.debug = {before: true};

    const session = new DebugSession(machine, {initialState: outer});
    const pauses: Array<{step: number; cause: string}> = [];
    let firstHandled = false;
    session.on('pause', (m) => {
      pauses.push({step: m.step, cause: m.pause.cause});
      if (!firstHandled) {
        firstHandled = true;
        session.stepOver();
      } else {
        session.continue();
      }
    });
    await session.start();
    // First pause: iter 1 breakpoint inside outer. Second pause: step endpoint
    // after the wrapper's frame popped. cause: 'step' confirms it's the
    // stepOver endpoint, not a stray breakpoint.
    expect(pauses[0]).toMatchObject({cause: 'breakpoint'});
    expect(pauses[1]).toMatchObject({cause: 'step'});
    expect(pauses[1].step).toBeGreaterThan(pauses[0].step);
  });

  it('stepOver() with empty click-time stack collapses to stepIn (next-iter pause)', async () => {
    // Top-level walker — no wrappers, no halt-stack entries at iter 1.
    const alphabet = new Alphabet(' AB'.split(''));
    const tape = new Tape({alphabet, symbols: ['A', 'B']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const state = new State({
      [symbol(['A'])]: {command: [{symbol: symbolCommands.keep, movement: movements.right}]},
      [symbol(['B'])]: {command: [{symbol: symbolCommands.keep, movement: movements.right}]},
      [symbol([' '])]: {nextState: haltState},
    });
    state.debug = {before: [symbol(['A'])]};  // iter 1 only

    const session = new DebugSession(machine, {initialState: state});
    const pauseSteps: number[] = [];
    let firstHandled = false;
    session.on('pause', (m) => {
      pauseSteps.push(m.step);
      if (!firstHandled) {
        firstHandled = true;
        session.stepOver();
      } else {
        session.continue();
      }
    });
    await session.start();
    expect(pauseSteps[0]).toBe(1);
    expect(pauseSteps[1]).toBe(2);  // next iter — exactly stepIn semantics
  });

  it('stepOut() pauses at the first iter after the click-time top-frame is popped', async () => {
    const alphabet = new Alphabet(' A'.split(''));
    const tape = new Tape({alphabet, symbols: ['A']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const haltWrapper = new State({[symbol(['A'])]: {nextState: haltState}, [symbol([' '])]: {nextState: haltState}});
    const inner = new State({[symbol(['A'])]: {nextState: haltWrapper}, [symbol([' '])]: {nextState: haltWrapper}});
    const outer = inner.withOverriddenHaltState(haltWrapper);
    inner.debug = {before: true};

    const session = new DebugSession(machine, {initialState: outer});
    const pauses: Array<{step: number; cause: string}> = [];
    let firstHandled = false;
    session.on('pause', (m) => {
      pauses.push({step: m.step, cause: m.pause.cause});
      if (!firstHandled) {
        firstHandled = true;
        session.stepOut();
      } else {
        session.continue();
      }
    });
    await session.start();
    expect(pauses[0]).toMatchObject({cause: 'breakpoint'});
    expect(pauses[1]).toMatchObject({cause: 'step'});
    expect(pauses[1].step).toBeGreaterThan(pauses[0].step);
  });

  it('stepOut() with empty click-time stack throws', async () => {
    // Top-level machine, no wrappers — paused state has empty halt-stack.
    const alphabet = new Alphabet(' A'.split(''));
    const tape = new Tape({alphabet, symbols: ['A']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const state = new State({
      [symbol(['A'])]: {command: [{symbol: symbolCommands.keep, movement: movements.right}]},
      [symbol([' '])]: {nextState: haltState},
    });
    state.debug = {before: true};

    const session = new DebugSession(machine, {initialState: state});
    const errors: unknown[] = [];
    session.on('pause', () => {
      try {
        session.stepOut();
      } catch (e) {
        errors.push(e);
        session.continue();
      }
    });
    await session.start();
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect((errors[0] as Error).message).toMatch(/stepOut.*empty/);
  });

  it('one-shot rule: an inner breakpoint dropped the active step-mode (no phantom endpoint)', async () => {
    // Scenario: wrapper around inner with one breakpoint on the WRAPPER's bare
    // and another on the inner state's halt path. User issues stepOver from
    // the wrapper's bare pause; the inner breakpoint fires next as a
    // 'breakpoint' cause, not as a 'step' endpoint.
    const alphabet = new Alphabet(' AB'.split(''));
    const tape = new Tape({alphabet, symbols: ['A', 'B']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;

    const haltWrapper = new State({
      [symbol(['A'])]: {nextState: haltState},
      [symbol(['B'])]: {nextState: haltState},
      [symbol([' '])]: {nextState: haltState},
    });
    const inner = new State({
      [symbol(['A'])]: {command: [{symbol: symbolCommands.keep, movement: movements.right}], nextState: haltWrapper},
      [symbol(['B'])]: {command: [{symbol: symbolCommands.keep, movement: movements.right}], nextState: haltWrapper},
      [symbol([' '])]: {nextState: haltWrapper},
    });
    const outer = inner.withOverriddenHaltState(haltWrapper);
    inner.debug = {before: [symbol(['A'])]};       // matches iter 1
    haltWrapper.debug = {before: true};            // matches when control reaches haltWrapper's pre-iter

    const session = new DebugSession(machine, {initialState: outer});
    const causes: string[] = [];
    let firstHandled = false;
    session.on('pause', (m) => {
      causes.push(m.pause.cause);
      if (!firstHandled) {
        firstHandled = true;
        session.stepOver();
      } else {
        session.continue();
      }
    });
    await session.start();
    expect(causes[0]).toBe('breakpoint');
    expect(causes[1]).toBe('breakpoint');  // NOT 'step' — the inner breakpoint dropped stepOver
    expect(causes.every((c) => c === 'breakpoint')).toBe(true);
  });

  it('iter event fires once at end of every iter, after step + after-pause', async () => {
    const {machine, state} = buildWalker(['A', 'A']);
    state.debug = {after: true};
    const session = new DebugSession(machine, {initialState: state});
    const order: string[] = [];
    session.on('step', (m) => { order.push(`step-${m.step}`); });
    session.on('pause', (m) => {
      order.push(`pause-${m.step}-${m.pause.side}`);
      session.continue();
    });
    session.on('iter', (m) => { order.push(`iter-${m.step}`); });
    await session.start();
    // Iter 1 (A): step, then after-pause, then iter.
    expect(order.slice(0, 3)).toEqual(['step-1', 'pause-1-after', 'iter-1']);
  });

  it('setRunInterval(ms) inserts a delay at end of each iter', async () => {
    const {machine, state} = buildWalker(['A', 'A']);
    const session = new DebugSession(machine, {initialState: state});
    session.setRunInterval(5);
    const start = performance.now();
    await session.start();
    const elapsed = performance.now() - start;
    // 3 iters total (2 A's + 1 blank-halt); 3 throttle waits of 5ms each ≥ 15ms.
    expect(elapsed).toBeGreaterThanOrEqual(10);
  });

  it('setRunInterval rejects negative / NaN / Infinity', () => {
    const {machine, haltWrapper} = buildSimple();
    const session = new DebugSession(machine, {initialState: haltWrapper});
    expect(() => session.setRunInterval(-1)).toThrow();
    expect(() => session.setRunInterval(NaN)).toThrow();
    expect(() => session.setRunInterval(Infinity)).toThrow();
  });

  it('external pause() fires a pause on next iter with cause: manual', async () => {
    const {machine, state} = buildWalker(['A', 'A', 'A']);
    const session = new DebugSession(machine, {initialState: state});
    session.setRunInterval(2);  // slow enough that we can pause externally

    let pauseRequestedOnce = false;
    const causes: string[] = [];
    session.on('iter', (m) => {
      // Trigger pause from outside on iter 1 (before iter 2 runs).
      if (m.step === 1 && !pauseRequestedOnce) {
        pauseRequestedOnce = true;
        session.pause();
      }
    });
    session.on('pause', (m) => {
      causes.push(m.pause.cause);
      session.continue();
    });
    await session.start();
    expect(causes).toEqual(['manual']);
  });

  it('stop() called from inside an iter listener terminates without firing halt', async () => {
    const {machine, state} = buildWalker(['A', 'A', 'A', 'A']);
    const session = new DebugSession(machine, {initialState: state});
    let haltFired = false;
    const iters: number[] = [];
    session.on('iter', (m) => {
      iters.push(m.step);
      if (m.step === 2) session.stop();
    });
    session.on('halt', () => { haltFired = true; });
    await session.start();
    expect(haltFired).toBe(false);
    expect(iters).toEqual([1, 2]);  // stop took effect at end of iter 2
  });

  it('stop() called between an after-pause and the iter event terminates without iter fire', async () => {
    // Arms after-pause; stop() called inside pause listener should terminate
    // the loop before the iter event fires for that iter.
    const {machine, state} = buildWalker(['A']);
    state.debug = {after: true};
    const session = new DebugSession(machine, {initialState: state});
    let iterFired = false;
    session.on('pause', () => {
      session.stop();
    });
    session.on('iter', () => { iterFired = true; });
    await session.start();
    expect(iterFired).toBe(false);
  });

  it('stop() called during a throttle wait terminates without further iters', async () => {
    // Throttle inserts a setTimeout between iters. stop() called from inside
    // an iter listener (the throttle hasn't started yet) takes effect when the
    // loop re-checks the flag at the next iter's top.
    const {machine, state} = buildWalker(['A', 'A', 'A']);
    const session = new DebugSession(machine, {initialState: state});
    session.setRunInterval(2);
    const iters: number[] = [];
    session.on('iter', (m) => {
      iters.push(m.step);
      if (m.step === 1) session.stop();
    });
    await session.start();
    expect(iters).toEqual([1]);
  });

  it('stop() called from inside a pause listener terminates immediately', async () => {
    const {machine, state} = buildWalker(['A', 'A']);
    state.debug = {before: true};
    const session = new DebugSession(machine, {initialState: state});
    let haltFired = false;
    let pauseCount = 0;
    session.on('pause', () => {
      pauseCount += 1;
      session.stop();
    });
    session.on('halt', () => { haltFired = true; });
    await session.start();
    expect(haltFired).toBe(false);
    expect(pauseCount).toBe(1);
  });

  it('stop() releases the TapeBlock lock so a fresh session on the same machine can start (#239 #drive rewrite regression check)', async () => {
    // The `for...of` this replaced (see #drive) called the generator's
    // `.return()` implicitly on an early exit (IteratorClose), which drives
    // `runStepByStep`'s own `finally { unlock(...) }`. The manual-iteration
    // rewrite reproduces that via its own wrapping `finally` — if it didn't,
    // this second session would reject with the "already in progress"
    // remapped error instead of completing normally.
    const {machine, state} = buildWalker(['A', 'A']);
    state.debug = {before: true};
    const sessionA = new DebugSession(machine, {initialState: state});
    sessionA.on('pause', () => { sessionA.stop(); });
    await sessionA.start();

    state.debug = null; // avoid re-arming the same breakpoint on sessionB
    const sessionB = new DebugSession(machine, {initialState: state});
    await expect(sessionB.start()).resolves.toBeUndefined();
  });

  it('multiple listeners on the same event all fire', async () => {
    const {machine, haltWrapper} = buildSimple();
    const session = new DebugSession(machine, {initialState: haltWrapper});
    let countA = 0;
    let countB = 0;
    session.on('step', () => { countA += 1; });
    session.on('step', () => { countB += 1; });
    await session.start();
    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it('continue() / stepIn() / stepOver() are no-op when no pause is active', () => {
    const {machine, haltWrapper} = buildSimple();
    const session = new DebugSession(machine, {initialState: haltWrapper});
    // No pause active — these must not throw.
    expect(() => session.continue()).not.toThrow();
    expect(() => session.stepIn()).not.toThrow();
    expect(() => session.stepOver()).not.toThrow();
  });

  it('breakpoint takes precedence over manual when both pending on same iter', async () => {
    const {machine, state} = buildWalker(['A']);
    state.debug = {before: true};
    const session = new DebugSession(machine, {initialState: state});

    let observedCause: string | undefined;
    // Set pause request BEFORE starting; iter 1 has both a breakpoint match
    // and a pending manual request. The breakpoint cause wins.
    session.pause();
    session.on('pause', (m) => {
      observedCause = observedCause ?? m.pause.cause;
      session.continue();
    });
    await session.start();
    expect(observedCause).toBe('breakpoint');
  });

  it('haltState.debug = true fires pause with after-side breakpoint cause', async () => {
    const {machine, state} = buildWalker(['A']);
    haltState.debug = true;
    try {
      const session = new DebugSession(machine, {initialState: state});
      const pauses: Array<{step: number; side: string; cause: string}> = [];
      session.on('pause', (m) => {
        pauses.push({
          step: m.step,
          side: m.pause.side,
          cause: m.pause.cause,
        });
        session.continue();
      });
      await session.start();
      // Two iters: iter 1 (A), iter 2 (blank → halt). Halt-debug fires on iter 2's after.
      expect(pauses).toEqual([{step: 2, side: 'after', cause: 'breakpoint'}]);
    } finally {
      haltState.debug = false;
    }
  });
});

describe('DebugSession: step granularity under genuine nesting (DevTools parity)', () => {
  // Build a machine with REAL depth-2 nesting (a bare that itself enters a
  // wrapper), so stepIn / stepOver / stepOut land at three DISTINCT iters.
  //
  // Trajectory (pre-iter halt-stack depth in parens):
  //   run start: enter `outer` → push outerCont           → depth 1
  //   iter 1 (d1): outerBare → nestedSub; end-of-iter pushes innerCont → depth 2
  //   iter 2 (d2): inner (via nestedSub) → halt; pop innerCont          → depth 1
  //   iter 3 (d1): innerCont → halt; pop outerCont                      → depth 0
  //   iter 4 (d0): outerCont → halt
  //
  // Paused at iter 1 (depth 1), the three step modes pause at:
  //   stepIn   → iter 2 (next iter, descends into the nested call, depth 2)
  //   stepOver → iter 3 (skip the nested call, back at click-time depth 1)
  //   stepOut  → iter 4 (current frame exited, depth 0)
  const build = () => {
    const alphabet = new Alphabet(' A'.split(''));
    const tape = new Tape({alphabet, symbols: ['A', 'A', 'A']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});

    const outerCont = new State({[ifOtherSymbol]: {command: [{movement: movements.stay}], nextState: haltState}});
    const innerCont = new State({[ifOtherSymbol]: {command: [{movement: movements.right}], nextState: haltState}});
    const inner = new State({[ifOtherSymbol]: {command: [{movement: movements.right}], nextState: haltState}});
    const nestedSub = inner.withOverriddenHaltState(innerCont);
    const outerBare = new State({[ifOtherSymbol]: {command: [{movement: movements.right}], nextState: nestedSub}});
    const outer = outerBare.withOverriddenHaltState(outerCont);

    // Breakpoint on iter 1: outerBare's #debugRef is shared with the `outer`
    // wrapper, so this fires on the first iter.
    outerBare.debug = {before: true};
    return {machine, outer};
  };

  // Pause at iter 1, issue the given step mode, return the step number of the
  // resulting (cause: 'step') endpoint pause.
  async function endpointOf(mode: 'stepIn' | 'stepOver' | 'stepOut'): Promise<number> {
    const {machine, outer} = build();
    const session = new DebugSession(machine, {initialState: outer});
    const pauses: Array<{step: number; cause: string}> = [];
    let first = true;
    session.on('pause', (m) => {
      pauses.push({step: m.step, cause: m.pause.cause});
      if (first) {
        first = false;
        session[mode]();
      } else {
        session.continue();
      }
    });
    await session.start();
    // pauses[0] = iter-1 breakpoint; pauses[1] = the step endpoint.
    expect(pauses[0]).toEqual({step: 1, cause: 'breakpoint'});
    expect(pauses[1].cause).toBe('step');
    return pauses[1].step;
  }

  it('stepIn descends into the nested call (depth 2) — pauses at iter 2', async () => {
    expect(await endpointOf('stepIn')).toBe(2);
  });

  it('stepOver skips the nested call, returns to click-time depth — pauses at iter 3', async () => {
    expect(await endpointOf('stepOver')).toBe(3);
  });

  it('stepOut exits the current frame — pauses at iter 4', async () => {
    expect(await endpointOf('stepOut')).toBe(4);
  });
});

// #239: DebugSession 'abort' event + abort breakpoint. Fixture mirrors
// TuringMachine.spec.ts's `buildAbortFixture` — a bare `inner` whose
// 'a'-transition targets `abortState` directly (a legal transition TARGET)
// and whose fallback halts, wrapped `inner.withOverriddenHaltState(cont)` so
// running `outer` pushes `cont` onto the halt-stack before `inner`'s own
// transition fires.
const buildAbortFixture = (tapeSymbol: string) => {
  const alphabet = new Alphabet([' ', 'a', 'b']);
  const tape = new Tape({alphabet, symbols: [tapeSymbol]});
  const tapeBlock = TapeBlock.fromTapes([tape]);
  const machine = new TuringMachine({tapeBlock});
  const {symbol} = tapeBlock;

  const cont = new State({[ifOtherSymbol]: {nextState: haltState}}, 'cont');
  const inner = new State({
    [symbol(['a'])]: {nextState: abortState},
    [ifOtherSymbol]: {nextState: haltState},
  }, 'inner');
  const outer = inner.withOverriddenHaltState(cont);

  return {machine, inner, cont, outer};
};

describe("DebugSession 'abort' event (#239)", () => {
  it('fires abort (not halt) with the RunResult payload', async () => {
    const halts: RunResult[] = [];
    const aborts: RunResult[] = [];
    const {machine, inner, outer} = buildAbortFixture('a');  // 'a' tape → aborts
    const session = new DebugSession(machine, {initialState: outer});
    session.on('halt', (r) => { halts.push(r); });
    session.on('abort', (r) => { aborts.push(r); });
    await session.start();
    expect(halts).toHaveLength(0);
    expect(aborts).toHaveLength(1);
    expect(aborts[0]).toMatchObject({outcome: 'aborted', state: inner});
  });

  it('halt listeners now receive the RunResult (additive)', async () => {
    let got: RunResult | undefined;
    const {machine, outer} = buildAbortFixture('b');  // 'b' tape → halts
    const session = new DebugSession(machine, {initialState: outer});
    session.on('halt', (r) => { got = r; });
    await session.start();
    expect(got).toMatchObject({outcome: 'halted', stack: []});
  });

  it('abortState.debug pauses on the after side before the abort event', async () => {
    abortState.debug = true;
    try {
      const order: string[] = [];
      const {machine, outer} = buildAbortFixture('a');
      const session = new DebugSession(machine, {initialState: outer});
      session.on('pause', (m) => {
        order.push(`pause:${m.pause.side}:${m.pause.cause}`);
        session.continue();
      });
      session.on('abort', () => { order.push('abort'); });
      await session.start();
      expect(order).toEqual(['pause:after:breakpoint', 'abort']);
    } finally {
      abortState.debug = null;
    }
  });

  it('no terminal event after stop() (existing stop()-from-pause pattern, applied to the abort-armed pause)', async () => {
    // Mirrors "stop() called from inside a pause listener terminates
    // immediately" above: arm the abort breakpoint so the pause fires, call
    // stop() from inside that pause listener, and assert the #stopped guard
    // suppresses BOTH terminal events (not just halt).
    abortState.debug = true;
    try {
      const {machine, outer} = buildAbortFixture('a');
      const session = new DebugSession(machine, {initialState: outer});
      let haltFired = false;
      let abortFired = false;
      let pauseCount = 0;
      session.on('pause', () => {
        pauseCount += 1;
        session.stop();
      });
      session.on('halt', () => { haltFired = true; });
      session.on('abort', () => { abortFired = true; });
      await session.start();
      expect(pauseCount).toBe(1);
      expect(haltFired).toBe(false);
      expect(abortFired).toBe(false);
    } finally {
      abortState.debug = null;
    }
  });
});
