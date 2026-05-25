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

describe('TuringMachine — debug.before filter (loop yields)', () => {
  test('without debug, no debugBreak field on yields', async () => {
    const {machine, state} = buildMachine();
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });

  test('debug.before = true tags every visit with debugBreak.before', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({before: true, cause: 'breakpoint'});
    }
  });

  test('debug.before with symbol list matches only listed symbols', async () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol(['A']);
    state.debug = {before: [symA]};
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    const aVisits = steps.filter((s) => s.currentSymbols[0] === 'A');
    const nonAVisits = steps.filter((s) => s.currentSymbols[0] !== 'A');

    expect(aVisits).toHaveLength(A_VISIT_COUNT);
    expect(nonAVisits).toHaveLength(VISIT_COUNT - A_VISIT_COUNT);
    for (const v of aVisits) expect(v.debugBreak).toEqual({before: true, cause: 'breakpoint'});
    for (const v of nonAVisits) expect(v).not.toHaveProperty('debugBreak');
  });

  test('debug.before with empty list never matches', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: []};
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });

  test('debug.before with [ifOtherSymbol] matches only the catch-all visit', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: [ifOtherSymbol]};
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    const blankVisits = steps.filter((s) => s.currentSymbols[0] === alphabet.blankSymbol);
    const nonBlankVisits = steps.filter((s) => s.currentSymbols[0] !== alphabet.blankSymbol);

    expect(blankVisits).toHaveLength(HALT_VISIT_COUNT);
    expect(blankVisits[0].debugBreak).toEqual({before: true, cause: 'breakpoint'});
    for (const v of nonBlankVisits) expect(v).not.toHaveProperty('debugBreak');
  });
});

describe('TuringMachine — debug.after filter (loop yields)', () => {
  // Both `before` and `after` refer to THIS iter, dispatched on the same yield.

  test('debug.after = true tags every yield with debugBreak.after', async () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({after: true, cause: 'breakpoint'});
    }
  });

  test('before AND after on same visit produce both flags on every yield', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({before: true, after: true, cause: 'breakpoint'});
    }
  });

  test('after with symbol list matches only listed symbols', async () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol(['A']);
    state.debug = {after: [symA]};
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    const aHits = steps.filter((s) => s.currentSymbols[0] === 'A');
    const nonAHits = steps.filter((s) => s.currentSymbols[0] !== 'A');
    expect(aHits).toHaveLength(A_VISIT_COUNT);

    for (const step of aHits) expect(step.debugBreak).toEqual({after: true, cause: 'breakpoint'});
    for (const step of nonAHits) expect(step).not.toHaveProperty('debugBreak');
  });
});

describe('TuringMachine — haltState.debug (boolean, #207)', () => {
  afterEach(() => {
    // haltState is a singleton — clear after each test to avoid cross-pollution.
    haltState.debug = false;
  });

  test('haltState.debug = true fires `debugBreak.after` on the halt-triggering iter (#207)', async () => {
    const {machine, state} = buildMachine();
    haltState.debug = true;
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    // Only the visit whose transition leads to halt (the trailing blank →
    // ifOtherSymbol → haltState) carries `debugBreak.after`. The earlier
    // visits self-loop within `state`, so their nextState is `state` itself,
    // not haltState — no halt-imminent dispatch.
    for (let i = 0; i < VISIT_COUNT - 1; i++) {
      expect(steps[i]).not.toHaveProperty('debugBreak');
    }
    const last = steps[VISIT_COUNT - 1];
    expect(last.nextState).toBe(haltState);
    // #207 spec: fires on AFTER side (post-iter, before halt processing).
    // `m.state` is the TRIGGERING state (whose transition leads to halt),
    // not haltState itself.
    expect(last.state).toBe(state);
    expect(last.debugBreak).toEqual({after: true, cause: 'breakpoint'});
  });

  test('haltState.debug = true fires on each halt entry — including subroutine return (halt-pop)', async () => {
    // Custom 1-cell tape + nested-state setup. Trajectory:
    //   visit 1: head 'A', state=wrapped → erase+right, transition to inner
    //   visit 2: head blank, state=inner → ifOtherSymbol → would halt;
    //            wrapped's override redirects to continuation. nextState=continuation.
    //            #207: halt-imminent fires on AFTER side (transition's original
    //            nextState was haltState before the pop redirect).
    //   visit 3: head blank, state=continuation → ifOtherSymbol → halt.
    //            #207: halt-imminent fires on AFTER side.
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
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: wrapped})) { steps.push(s); }

    expect(steps).toHaveLength(3);

    // Visit 1: just self-loops into inner — no halt-related break.
    expect(steps[0]).not.toHaveProperty('debugBreak');

    // Visit 2: transitions to continuation via halt-pop. `debugBreak.after`
    // fires because the transition's original nextState was haltState (the
    // pop-redirect to continuation happens AFTER the engine's halt check).
    const popYield = steps.find((s) => s.nextState === continuation);
    expect(popYield).toBeDefined();
    expect(popYield).toBe(steps[1]);
    expect(popYield!.debugBreak).toEqual({after: true, cause: 'breakpoint'});

    // Visit 3: transitions to halt directly. `debugBreak.after` fires.
    expect(steps[2].nextState).toBe(haltState);
    expect(steps[2].debugBreak).toEqual({after: true, cause: 'breakpoint'});
  });

  test('haltState.debug = false / null suppresses dispatch on every iter', async () => {
    const {machine, state} = buildMachine();
    haltState.debug = false;
    const steps: MachineState[] = [];

    for (const s of machine.runStepByStep({initialState: state})) { steps.push(s); }

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
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

  test('run() is synchronous (returns void, not a Promise)', () => {
    const {machine, state} = buildMachine();
    const result = machine.run({initialState: state});
    expect(result).toBeUndefined();
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
    const seen: Array<{state: State, debugBreak?: MachineState['debugBreak']}> = [];

    const session = new DebugSession(machine, {initialState: state});
    session.on('pause', (m) => {
      seen.push({state: m.state, debugBreak: m.debugBreak});
      session.continue();
    });
    await session.start();

    expect(seen).toHaveLength(VISIT_COUNT);
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect(entry.debugBreak).toEqual({before: true, cause: 'breakpoint'});
    }
  });

  test('DebugSession pause event for "after" carries the same iter\'s state', async () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const seen: Array<{state: State, debugBreak?: MachineState['debugBreak'], step: number}> = [];

    const session = new DebugSession(machine, {initialState: state});
    session.on('pause', (m) => {
      seen.push({state: m.state, debugBreak: m.debugBreak, step: m.step});
      session.continue();
    });
    await session.start();

    expect(seen).toHaveLength(VISIT_COUNT);
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect(entry.debugBreak).toEqual({after: true, cause: 'breakpoint'});
    }
  });

  test('both "before" and "after" on same yield → two pause events in lifecycle order', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const calls: Array<'before' | 'after'> = [];

    const session = new DebugSession(machine, {initialState: state});
    session.on('pause', (m) => {
      if (m.debugBreak?.before) calls.push('before');
      if (m.debugBreak?.after) calls.push('after');
      session.continue();
    });
    await session.start();

    // Per-iter lifecycle: before → step → after. Every yield dispatches both
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
      if (m.debugBreak?.after) after.push(m);
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
    }).toThrow(/haltState\.debug only accepts boolean/);
  });

  test('haltState.debug = {before: true} throws — boolean-only API (#207)', () => {
    expect(() => {
      // @ts-expect-error — see comment above.
      haltState.debug = {before: true};
    }).toThrow(/haltState\.debug only accepts boolean/);
  });

  test('haltState.debug = {before: true, after: true} throws — boolean-only API (#207)', () => {
    expect(() => {
      // @ts-expect-error — see comment above.
      haltState.debug = {before: true, after: true};
    }).toThrow(/haltState\.debug only accepts boolean/);
  });

  test('non-halt state.debug = boolean throws — DebugConfig-only on non-halt (#207)', () => {
    // Symmetric guard: only haltState accepts boolean. Non-halt states must
    // use the DebugConfig shape so the per-side granularity stays explicit.
    const s = new State();
    expect(() => {
      // @ts-expect-error — non-halt State's debug setter narrows to DebugConfig.
      s.debug = true;
    }).toThrow(/Boolean assignment is reserved for `haltState`/);
  });
});

describe('debugBreak metadata on yields (no consumer dispatch)', () => {
  afterEach(() => { haltState.debug = null; });

  // v6's `run({debug: false})` master switch is gone in v7 (callbacks moved
  // entirely to DebugSession). The semantic that lived in those tests —
  // "yielded MachineStates carry debugBreak metadata regardless of consumer
  // dispatch" — still holds, and is observable by iterating `runStepByStep`
  // directly without constructing a session.

  test('runStepByStep yields debugBreak metadata even without a DebugSession', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const yields: MachineState[] = [];
    for (const m of machine.runStepByStep({initialState: state})) { yields.push(m); }

    expect(yields).toHaveLength(VISIT_COUNT);
    for (const y of yields) {
      expect(y.debugBreak).toEqual({before: true, cause: 'breakpoint'});
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
