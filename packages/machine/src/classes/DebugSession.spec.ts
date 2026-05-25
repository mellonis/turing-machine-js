import {describe, it, expect} from 'vitest';
import Alphabet from './Alphabet';
import State, {haltState} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {MACHINE_STATE_INTERNAL, type MachineStateInternal} from './TuringMachine';
import {movements, symbolCommands} from './TapeCommand';
import DebugSession from './DebugSession';

// Shared helper: builds a 1-state machine that halts on the first A.
const buildSimple = () => {
  const alphabet = new Alphabet(' A'.split(''));
  const tape = new Tape({alphabet, symbols: ['A']});
  const tapeBlock = TapeBlock.fromTapes([tape]);
  const machine = new TuringMachine({tapeBlock});
  const {symbol} = tapeBlock;
  const halt = new State({[symbol(['A'])]: {nextState: haltState}});
  return {machine, halt, tapeBlock};
};

const readInternal = (m: unknown): MachineStateInternal =>
  (m as Record<symbol, () => MachineStateInternal>)[MACHINE_STATE_INTERNAL]();

describe('MACHINE_STATE_INTERNAL accessor on yielded MachineState', () => {
  it('exposes a frozen halt-stack snapshot on every iter', () => {
    const {machine, halt} = buildSimple();
    const inner = halt;
    const outer = inner.withOverriddenHaltState(halt);

    const yields = [...machine.runStepByStep({initialState: outer})];

    expect(yields.length).toBeGreaterThan(0);
    for (const m of yields) {
      const internal = readInternal(m);
      expect(Array.isArray(internal.stack)).toBe(true);
      expect(Object.isFrozen(internal.stack)).toBe(true);
    }
  });

  it("does NOT include the accessor in enumerable spread / toEqual", () => {
    const {machine, halt} = buildSimple();

    const [m] = [...machine.runStepByStep({initialState: halt})];
    // Enumerable spread must NOT include the symbol-keyed accessor.
    expect(Object.keys(m)).not.toContain(MACHINE_STATE_INTERNAL.toString());
    // toEqual on the visible shape must succeed even though the symbol prop is present.
    expect(m).toEqual(expect.objectContaining({state: halt, step: 1}));
  });

  it('captures the PRE-iter stack (snapshot taken before this iter advances)', () => {
    const {machine, halt} = buildSimple();
    const outer = halt.withOverriddenHaltState(halt);

    const [first] = [...machine.runStepByStep({initialState: outer})];
    const internal = readInternal(first);
    // Iter 1 is inside the wrapper — the wrapper's overriddenHaltState (halt) is on the stack.
    expect(internal.stack.length).toBe(1);
    expect(internal.stack[0]).toBe(halt);
  });
});

describe('DebugSession skeleton', () => {
  it('runs to natural halt and fires the halt listener', async () => {
    const {machine, halt} = buildSimple();
    const session = new DebugSession(machine, {initialState: halt});
    let halted = false;
    session.on('halt', () => { halted = true; });
    await session.start();
    expect(halted).toBe(true);
  });

  it("doesn't fire halt when stop() is called", async () => {
    const {machine, halt} = buildSimple();
    const session = new DebugSession(machine, {initialState: halt});
    let halted = false;
    session.on('halt', () => { halted = true; });
    session.stop();
    await session.start();
    expect(halted).toBe(false);
  });

  it('throws on a second start() call', async () => {
    const {machine, halt} = buildSimple();
    const session = new DebugSession(machine, {initialState: halt});
    await session.start();
    await expect(session.start()).rejects.toThrow(/already been called/);
  });

  it('off() removes a previously registered listener', async () => {
    const {machine, halt} = buildSimple();
    const session = new DebugSession(machine, {initialState: halt});
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
  it('emits pause on debugBreak.before match with cause: breakpoint', async () => {
    const {machine, state} = buildWalker(['A', 'A']);
    state.debug = {before: true};
    const session = new DebugSession(machine, {initialState: state});
    const pauses: Array<{step: number; before?: true; after?: true; cause: string}> = [];
    session.on('pause', (m) => {
      pauses.push({step: m.step, ...m.debugBreak!});
      session.continue();
    });
    await session.start();
    // Three iters total (iter 1 = A, iter 2 = A, iter 3 = blank → halt);
    // {before: true} matches every symbol so all three pause.
    expect(pauses).toEqual([
      {step: 1, before: true, cause: 'breakpoint'},
      {step: 2, before: true, cause: 'breakpoint'},
      {step: 3, before: true, cause: 'breakpoint'},
    ]);
  });

  it('emits pause on debugBreak.after match too', async () => {
    const {machine, state} = buildWalker(['A']);
    state.debug = {after: true};
    const session = new DebugSession(machine, {initialState: state});
    const causes: Array<{side: string; cause: string}> = [];
    session.on('pause', (m) => {
      causes.push({
        side: m.debugBreak!.before ? 'before' : 'after',
        cause: m.debugBreak!.cause,
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
      causes.push({step: m.step, cause: m.debugBreak!.cause});
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
    // (inside outer's bare) contains the wrapper's overriddenHaltState (= halt).
    // stepOver should run until that frame is gone — which happens at iter 2,
    // when the inner halts → halt-pop → state advances to halt; iter 2's pause
    // fires because the stack is now empty.
    const alphabet = new Alphabet(' A'.split(''));
    const tape = new Tape({alphabet, symbols: ['A']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const halt = new State({[symbol(['A'])]: {nextState: haltState}, [symbol([' '])]: {nextState: haltState}});
    const inner = new State({[symbol(['A'])]: {nextState: halt}, [symbol([' '])]: {nextState: halt}});
    const outer = inner.withOverriddenHaltState(halt);
    inner.debug = {before: true};

    const session = new DebugSession(machine, {initialState: outer});
    const pauses: Array<{step: number; cause: string}> = [];
    let firstHandled = false;
    session.on('pause', (m) => {
      pauses.push({step: m.step, cause: m.debugBreak!.cause});
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

  it('haltState.debug = true fires pause with after-side breakpoint cause', async () => {
    const {machine, state} = buildWalker(['A']);
    haltState.debug = true;
    try {
      const session = new DebugSession(machine, {initialState: state});
      const pauses: Array<{step: number; side: string; cause: string}> = [];
      session.on('pause', (m) => {
        pauses.push({
          step: m.step,
          side: m.debugBreak!.after ? 'after' : 'before',
          cause: m.debugBreak!.cause,
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
