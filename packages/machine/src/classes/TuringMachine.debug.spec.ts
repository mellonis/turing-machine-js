import Alphabet from './Alphabet';
import State, {haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {type MachineState} from './TuringMachine';
import DebugSession from './DebugSession';
import {movements, symbolCommands} from './TapeCommand';

const alphabet = new Alphabet(' AB'.split(''));

// Deterministic single-state machine: tape ['A','B','A'] traverses 4 visits
// before halting on the trailing blank.
//   visit 1 (i=1): head 'A' → erase + right (state self-loops)
//   visit 2 (i=2): head 'B' → erase + right
//   visit 3 (i=3): head 'A' → erase + right
//   visit 4 (i=4): head blank → ifOtherSymbol → halt
const VISIT_COUNT = 4;
const A_VISIT_COUNT = 2; // visits 1, 3 have head 'A'
const HALT_VISIT_COUNT = 1; // visit 4 (blank/ifOtherSymbol)

const buildMachine = () => {
  const tape = new Tape({alphabet, symbols: ['A', 'B', 'A']});
  const tapeBlock = TapeBlock.fromTapes([tape]);
  const machine = new TuringMachine({tapeBlock});
  const {symbol} = tapeBlock;

  // Single state: erase + move right; halt on blank.
  const state = new State({
    [symbol(['A'])]: {
      command: [{symbol: symbolCommands.erase, movement: movements.right}],
    },
    [symbol(['B'])]: {
      command: [{symbol: symbolCommands.erase, movement: movements.right}],
    },
    [ifOtherSymbol]: {nextState: haltState},
  });

  return {machine, state, symbol};
};

// Drive a DebugSession to completion, collecting one record per pause event.
// Detection now lives in DebugSession (not in runStepByStep), so filter
// semantics are asserted through the pause stream.
type PauseRecord = {step: number; side: 'before' | 'after'; cause: string; symbol: string};
async function collectPauses(machine: TuringMachine, state: State): Promise<PauseRecord[]> {
  const session = new DebugSession(machine, {initialState: state});
  const pauses: PauseRecord[] = [];
  session.on('pause', (m) => {
    pauses.push({step: m.step, side: m.pause.side, cause: m.pause.cause, symbol: m.currentSymbols[0]});
    session.continue();
  });
  await session.start();
  return pauses;
}

describe('runStepByStep — no debug metadata on yields', () => {
  test('raw yields never carry a pause/debugBreak field, regardless of state.debug', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};  // even with filters armed…
    const steps: MachineState[] = [];
    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
      expect(step).not.toHaveProperty('pause');
    }
  });
});

describe('DebugSession — before-side detection', () => {
  test('no state.debug → no pauses', async () => {
    const {machine, state} = buildMachine();
    expect(await collectPauses(machine, state)).toEqual([]);
  });

  test('before = true pauses on every visit, side before', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const pauses = await collectPauses(machine, state);
    expect(pauses).toHaveLength(VISIT_COUNT);
    for (const p of pauses) expect({side: p.side, cause: p.cause}).toEqual({side: 'before', cause: 'breakpoint'});
  });

  test('before with symbol list pauses only on listed symbols', async () => {
    const {machine, state, symbol} = buildMachine();
    state.debug = {before: [symbol(['A'])]};
    const pauses = await collectPauses(machine, state);
    expect(pauses).toHaveLength(A_VISIT_COUNT);
    for (const p of pauses) expect({side: p.side, symbol: p.symbol}).toEqual({side: 'before', symbol: 'A'});
  });

  test('before with empty list never pauses', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: []};
    expect(await collectPauses(machine, state)).toEqual([]);
  });

  test('before with [ifOtherSymbol] pauses only on the catch-all (blank) visit', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: [ifOtherSymbol]};
    const pauses = await collectPauses(machine, state);
    expect(pauses).toHaveLength(HALT_VISIT_COUNT);
    expect(pauses[0].symbol).toBe(alphabet.blankSymbol);
    expect({side: pauses[0].side, cause: pauses[0].cause}).toEqual({side: 'before', cause: 'breakpoint'});
  });
});

describe('DebugSession — after-side detection', () => {
  test('after = true pauses on every visit, side after', async () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const pauses = await collectPauses(machine, state);
    expect(pauses).toHaveLength(VISIT_COUNT);
    for (const p of pauses) expect({side: p.side, cause: p.cause}).toEqual({side: 'after', cause: 'breakpoint'});
  });

  test('before AND after on same visit → two pause events per iter, before then after', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const pauses = await collectPauses(machine, state);
    // Each visit now produces TWO pause events (split), in before→after order.
    expect(pauses).toHaveLength(VISIT_COUNT * 2);
    for (let i = 0; i < pauses.length; i += 2) {
      expect(pauses[i].side).toBe('before');
      expect(pauses[i + 1].side).toBe('after');
      expect(pauses[i].step).toBe(pauses[i + 1].step);
    }
  });

  test('after with symbol list pauses only on listed symbols', async () => {
    const {machine, state, symbol} = buildMachine();
    state.debug = {after: [symbol(['A'])]};
    const pauses = await collectPauses(machine, state);
    expect(pauses).toHaveLength(A_VISIT_COUNT);
    for (const p of pauses) expect({side: p.side, symbol: p.symbol}).toEqual({side: 'after', symbol: 'A'});
  });
});

describe('TuringMachine — haltState.debug (boolean, #207)', () => {
  afterEach(() => {
    // haltState is a singleton — clear after each test to avoid cross-pollution.
    haltState.debug = false;
  });

  test('haltState.debug = true pauses (after-side) on the halt-triggering iter (#207)', async () => {
    const {machine, state} = buildMachine();
    haltState.debug = true;

    const session = new DebugSession(machine, {initialState: state});
    const pauses: Array<{step: number; side: string; cause: string; pausedState: State; nextState: State}> = [];
    session.on('pause', (m) => {
      pauses.push({step: m.step, side: m.pause.side, cause: m.pause.cause, pausedState: m.state, nextState: m.nextState});
      session.continue();
    });
    await session.start();

    // Only the visit whose transition leads to halt (trailing blank →
    // ifOtherSymbol → haltState) pauses. Earlier visits self-loop within
    // `state` — their nextState is `state`, not haltState.
    expect(pauses).toHaveLength(1);
    const p = pauses[0];
    expect(p.step).toBe(VISIT_COUNT);
    // #207: after-side; m.state is the TRIGGERING state, not haltState.
    expect(p.side).toBe('after');
    expect(p.cause).toBe('breakpoint');
    expect(p.pausedState).toBe(state);
    expect(p.nextState).toBe(haltState);
  });

  test('haltState.debug = true pauses on each halt entry — including subroutine return (halt-pop)', async () => {
    // Trajectory:
    //   visit 1: head 'A', state=wrapped → erase+right, transition to inner
    //   visit 2: head blank, state=inner → ifOtherSymbol → would halt;
    //            wrapped's override redirects to continuation. nextState=continuation.
    //            #207: halt-imminent → after-side pause (original nextState was haltState).
    //   visit 3: head blank, state=continuation → ifOtherSymbol → halt → after-side pause.
    const tape = new Tape({alphabet, symbols: ['A']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;

    const inner = new State({
      [symbol(['A'])]: {
        command: [{symbol: symbolCommands.erase, movement: movements.right}],
      },
      [ifOtherSymbol]: {nextState: haltState},
    });

    const continuation = new State({
      [ifOtherSymbol]: {nextState: haltState},
    });

    const wrapped = inner.withOverriddenHaltState(continuation);

    haltState.debug = true;
    const session = new DebugSession(machine, {initialState: wrapped});
    const pauses: Array<{step: number; side: string; nextState: State}> = [];
    session.on('pause', (m) => {
      pauses.push({step: m.step, side: m.pause.side, nextState: m.nextState});
      session.continue();
    });
    await session.start();

    // Two halt entries: the halt-pop (→ continuation) and the final halt.
    expect(pauses).toHaveLength(2);
    // halt-pop visit: nextState resolves to the continuation (post-pop).
    expect(pauses[0].side).toBe('after');
    expect(pauses[0].nextState).toBe(continuation);
    // final visit: transitions straight to halt.
    expect(pauses[1].side).toBe('after');
    expect(pauses[1].nextState).toBe(haltState);
  });

  test('haltState.debug = false / null → no pauses', async () => {
    const {machine, state} = buildMachine();
    haltState.debug = false;
    expect(await collectPauses(machine, state)).toEqual([]);
  });

  test('haltState.debug getter returns boolean (typed `boolean` via HaltState alias)', () => {
    haltState.debug = true;
    expect(haltState.debug).toBe(true);
    haltState.debug = false;
    expect(haltState.debug).toBe(false);
    haltState.debug = null;
    // null aliases to false (reset).
    expect(haltState.debug).toBe(false);
  });
});

describe('TuringMachine — run() with onPause', () => {
  afterEach(() => { haltState.debug = null; });

  test('run() is synchronous (returns a RunResult, not a Promise) (#239)', () => {
    // Obsoletes the pre-#239 `toBeUndefined()` assertion — `run()` now
    // returns a `RunResult` synchronously instead of `void`; the still-valid
    // intent ("sync, not a Promise") is preserved via the `not.toBeInstanceOf`
    // check.
    const {machine, state} = buildMachine();
    const result = machine.run({initialState: state});
    expect(result).not.toBeInstanceOf(Promise);
    expect(result.outcome).toBe('halted');
  });

  test('without DebugSession, breakpoints fire-and-resume invisibly', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const steps: MachineState[] = [];
    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }
    expect(steps).toHaveLength(VISIT_COUNT);
  });

  test('DebugSession pause event fires for "before" with current state', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const seen: Array<{state: State, side: string; cause: string}> = [];

    const session = new DebugSession(machine, {initialState: state});
    session.on('pause', (m) => {
      seen.push({state: m.state, side: m.pause.side, cause: m.pause.cause});
      session.continue();
    });
    await session.start();

    expect(seen).toHaveLength(VISIT_COUNT);
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect({side: entry.side, cause: entry.cause}).toEqual({side: 'before', cause: 'breakpoint'});
    }
  });

  test('DebugSession pause event for "after" carries the same iter\'s state', async () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const seen: Array<{state: State, side: string; cause: string; step: number}> = [];

    const session = new DebugSession(machine, {initialState: state});
    session.on('pause', (m) => {
      seen.push({state: m.state, side: m.pause.side, cause: m.pause.cause, step: m.step});
      session.continue();
    });
    await session.start();

    expect(seen).toHaveLength(VISIT_COUNT);
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect({side: entry.side, cause: entry.cause}).toEqual({side: 'after', cause: 'breakpoint'});
    }
  });

  test('both "before" and "after" on same iter → two pause events in lifecycle order', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const calls: Array<'before' | 'after'> = [];

    const session = new DebugSession(machine, {initialState: state});
    session.on('pause', (m) => {
      calls.push(m.pause.side);
      session.continue();
    });
    await session.start();

    // Per-iter lifecycle: before → step → after. Every iter dispatches both
    // pauses in this order. For VISIT_COUNT visits: [before, after, before, …]
    expect(calls).toHaveLength(VISIT_COUNT * 2);
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i]).toBe(i % 2 === 0 ? 'before' : 'after');
    }
  });

  test('async pause listener: session waits until continue() (not the listener return)', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    let released = false;
    let callCount = 0;

    const session = new DebugSession(machine, {initialState: state});
    session.on('pause', async () => {
      callCount += 1;
      await new Promise<void>((resolve) => {
        setTimeout(() => { released = true; resolve(); }, 10);
      });
      session.continue();
    });
    await session.start();

    expect(released).toBe(true);
    expect(callCount).toBe(VISIT_COUNT);
  });

  test('step event still fires on every yield, separate from pause', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    let stepCount = 0;
    let breakCount = 0;

    const session = new DebugSession(machine, {initialState: state});
    session.on('step', () => { stepCount += 1; });
    session.on('pause', () => { breakCount += 1; session.continue(); });
    await session.start();

    expect(stepCount).toBe(VISIT_COUNT);
    expect(breakCount).toBe(VISIT_COUNT);
  });
});

describe('TuringMachine — halt semantics for after-fire (#108)', () => {
  afterEach(() => { haltState.debug = null; });

  test('halting iter still fires its after (#108 part 1)', async () => {
    // debug.after = true matches every visit. The halting iter's after
    // dispatches on its own yield, so all VISIT_COUNT visits fire.
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const after: MachineState[] = [];

    const session = new DebugSession(machine, {initialState: state});
    session.on('pause', (m) => {
      if (m.pause.side === 'after') after.push(m);
      session.continue();
    });
    await session.start();

    expect(after).toHaveLength(VISIT_COUNT);
  });

  test('haltState.debug = {after: true} throws — boolean-only API (#207, supersedes #108 part 2)', () => {
    // #207 collapsed haltState's debug to a single boolean — the {before, after}
    // shape doesn't model anything meaningful for a terminal singleton. Any
    // object write throws at write-time with a clear message.
    expect(() => {
      // @ts-expect-error — HaltState typed alias narrows to `boolean`; the runtime throw
      // is the secondary line of defense for callers reaching haltState through a
      // generic `State` reference (e.g. `state.getNextState(sym).ref`).
      haltState.debug = {after: true};
    }).toThrow(/\.debug only accepts boolean/);
  });

  test('haltState.debug = {before: true} throws — boolean-only API (#207)', () => {
    expect(() => {
      // @ts-expect-error — see comment above.
      haltState.debug = {before: true};
    }).toThrow(/\.debug only accepts boolean/);
  });

  test('haltState.debug = {before: true, after: true} throws — boolean-only API (#207)', () => {
    expect(() => {
      // @ts-expect-error — see comment above.
      haltState.debug = {before: true, after: true};
    }).toThrow(/\.debug only accepts boolean/);
  });

  test('non-halt state.debug = boolean throws — DebugConfig-only on non-halt (#207)', () => {
    // Symmetric guard: only sentinels accept boolean. Non-halt states must
    // use the DebugConfig shape so the per-side granularity stays explicit.
    const s = new State();
    expect(() => {
      // @ts-expect-error — non-halt State's debug setter narrows to DebugConfig.
      s.debug = true;
    }).toThrow(/Boolean assignment is reserved for sentinel states/);
  });
});

describe('runStepByStep ignores breakpoints entirely (detection lives in DebugSession)', () => {
  afterEach(() => { haltState.debug = null; });

  // v7: breakpoint detection moved out of the generator. runStepByStep is the
  // pure-iteration primitive — even with state.debug armed, raw yields carry
  // NO pause/debugBreak field and iteration cadence is unchanged.

  test('raw yields carry no pause metadata even with state.debug armed', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    haltState.debug = true;
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: state})) { yields.push(m); }

    expect(yields).toHaveLength(VISIT_COUNT);
    for (const y of yields) {
      expect(y).not.toHaveProperty('pause');
      expect(y).not.toHaveProperty('debugBreak');
    }
  });

  test('a DebugSession with NO pause listener consumes breakpoints invisibly', async () => {
    // No pause listener registered — the session still dispatches into its
    // (empty) listener list and immediately resumes via the loop. End-to-end
    // behavior equivalent to v6's `debug: false` (run completes without
    // surfacing pauses), without the need for a master switch.
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    let stepCount = 0;
    const session = new DebugSession(machine, {initialState: state});
    session.on('step', () => { stepCount += 1; });
    session.on('pause', () => { session.continue(); });
    await session.start();
    expect(stepCount).toBe(VISIT_COUNT);
  });
});
