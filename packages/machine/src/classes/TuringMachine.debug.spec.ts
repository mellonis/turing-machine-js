import Alphabet from './Alphabet';
import State, {haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {type MachineState} from './TuringMachine';
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

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });

  test('debug.before = true tags every visit with debugBreak.before', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({before: true});
    }
  });

  test('debug.before with symbol list matches only listed symbols', async () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol(['A']);
    state.debug = {before: [symA]};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    const aVisits = steps.filter((s) => s.currentSymbols[0] === 'A');
    const nonAVisits = steps.filter((s) => s.currentSymbols[0] !== 'A');

    expect(aVisits).toHaveLength(A_VISIT_COUNT);
    expect(nonAVisits).toHaveLength(VISIT_COUNT - A_VISIT_COUNT);
    for (const v of aVisits) expect(v.debugBreak).toEqual({before: true});
    for (const v of nonAVisits) expect(v).not.toHaveProperty('debugBreak');
  });

  test('debug.before with empty list never matches', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: []};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });

  test('debug.before with [ifOtherSymbol] matches only the catch-all visit', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: [ifOtherSymbol]};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    const blankVisits = steps.filter((s) => s.currentSymbols[0] === alphabet.blankSymbol);
    const nonBlankVisits = steps.filter((s) => s.currentSymbols[0] !== alphabet.blankSymbol);

    expect(blankVisits).toHaveLength(HALT_VISIT_COUNT);
    expect(blankVisits[0].debugBreak).toEqual({before: true});
    for (const v of nonBlankVisits) expect(v).not.toHaveProperty('debugBreak');
  });
});

describe('TuringMachine — debug.after filter (loop yields)', () => {
  // Both `before` and `after` refer to THIS iter, dispatched on the same yield.

  test('debug.after = true tags every yield with debugBreak.after', async () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({after: true});
    }
  });

  test('before AND after on same visit produce both flags on every yield', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    expect(steps).toHaveLength(VISIT_COUNT);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({before: true, after: true});
    }
  });

  test('after with symbol list matches only listed symbols', async () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol(['A']);
    state.debug = {after: [symA]};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    expect(steps).toHaveLength(VISIT_COUNT);
    const aHits = steps.filter((s) => s.currentSymbols[0] === 'A');
    const nonAHits = steps.filter((s) => s.currentSymbols[0] !== 'A');
    expect(aHits).toHaveLength(A_VISIT_COUNT);

    for (const step of aHits) expect(step.debugBreak).toEqual({after: true});
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

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

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
    expect(last.debugBreak).toEqual({after: true});
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

    await machine.run({initialState: wrapped, onStep: (s) => { steps.push(s); }});

    expect(steps).toHaveLength(3);

    // Visit 1: just self-loops into inner — no halt-related break.
    expect(steps[0]).not.toHaveProperty('debugBreak');

    // Visit 2: transitions to continuation via halt-pop. `debugBreak.after`
    // fires because the transition's original nextState was haltState (the
    // pop-redirect to continuation happens AFTER the engine's halt check).
    const popYield = steps.find((s) => s.nextState === continuation);
    expect(popYield).toBeDefined();
    expect(popYield).toBe(steps[1]);
    expect(popYield!.debugBreak).toEqual({after: true});

    // Visit 3: transitions to halt directly. `debugBreak.after` fires.
    expect(steps[2].nextState).toBe(haltState);
    expect(steps[2].debugBreak).toEqual({after: true});
  });

  test('haltState.debug = false / null suppresses dispatch on every iter', async () => {
    const {machine, state} = buildMachine();
    haltState.debug = false;
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

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

  test('run() returns a Promise', () => {
    const {machine, state} = buildMachine();
    const result = machine.run({initialState: state});
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  test('without onPause, breaks fire-and-resume invisibly', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => { steps.push(s); }});

    // Trajectory unaffected — onStep sees same number of yields as without debug.
    expect(steps).toHaveLength(VISIT_COUNT);
  });

  test('onPause fires for "before" with current state', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const seen: Array<{state: State, debugBreak?: MachineState['debugBreak']}> = [];

    await machine.run({
      initialState: state,
      onPause: (m) => {
        seen.push({state: m.state, debugBreak: m.debugBreak});
      },
    });

    expect(seen).toHaveLength(VISIT_COUNT);
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect(entry.debugBreak).toEqual({before: true});
    }
  });

  test('onPause for "after" carries the same iter\'s state', async () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const seen: Array<{state: State, debugBreak?: MachineState['debugBreak'], step: number}> = [];

    await machine.run({
      initialState: state,
      onPause: (m) => {
        seen.push({state: m.state, debugBreak: m.debugBreak, step: m.step});
      },
    });

    expect(seen).toHaveLength(VISIT_COUNT);
    // The after-call's `m.state` is the iter that armed the after; `before`
    // and `after` for the SAME iter both fire on that iter's own yield.
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect(entry.debugBreak).toEqual({after: true});
    }
  });

  test('both "before" and "after" on same yield → two hook calls in lifecycle order', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const calls: Array<'before' | 'after'> = [];

    await machine.run({
      initialState: state,
      onPause: (m) => {
        if (m.debugBreak?.before) calls.push('before');
        if (m.debugBreak?.after) calls.push('after');
      },
    });

    // Per-iter lifecycle: before → step → after. Every yield dispatches both
    // hooks in this order. For VISIT_COUNT visits: [before, after, before, …]
    expect(calls).toHaveLength(VISIT_COUNT * 2);
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i]).toBe(i % 2 === 0 ? 'before' : 'after');
    }
  });

  test('onPause can be async (run awaits it)', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    let released = false;
    let callCount = 0;

    const hookFor = () => new Promise<void>((resolve) => {
      setTimeout(() => { released = true; resolve(); }, 10);
    });

    await machine.run({
      initialState: state,
      onPause: () => {
        callCount += 1;
        return hookFor(); // run() awaits this
      },
    });

    expect(released).toBe(true);
    expect(callCount).toBe(VISIT_COUNT);
  });

  test('onStep still fires on every yield, separate from onPause', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    let stepCount = 0;
    let breakCount = 0;

    await machine.run({
      initialState: state,
      onStep: () => { stepCount += 1; },
      onPause: () => { breakCount += 1; },
    });

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

    await machine.run({
      initialState: state,
      onPause: (m) => { if (m.debugBreak?.after) after.push(m); },
    });

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

describe('TuringMachine — run({debug}) flag (#106)', () => {
  afterEach(() => { haltState.debug = null; });

  test('debug: false suppresses onPause for "before" matches', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const pauses: MachineState[] = [];

    await machine.run({
      initialState: state,
      onPause: (m) => { pauses.push(m); },
      debug: false,
    });

    expect(pauses).toHaveLength(0);
  });

  test('debug: false suppresses onPause for "after" matches (every visit, including halting iter)', async () => {
    // With state.debug.after = true, every visit normally produces an
    // after-fire dispatch (including the halting iter, post-#108/#119). The
    // master switch must gate all of them.
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const pauses: MachineState[] = [];

    await machine.run({
      initialState: state,
      onPause: (m) => { pauses.push(m); },
      debug: false,
    });

    expect(pauses).toHaveLength(0);
  });

  test('debug: true (default) dispatches onPause as v4', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const pauses: MachineState[] = [];

    await machine.run({
      initialState: state,
      onPause: (m) => { pauses.push(m); },
      // debug omitted → defaults to true
    });

    expect(pauses).toHaveLength(VISIT_COUNT);
  });

  test('debug: false does NOT suppress onStep', async () => {
    // The flag is specifically about pause-capable dispatch; trace/logging
    // continues regardless.
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    let stepCount = 0;

    await machine.run({
      initialState: state,
      onStep: () => { stepCount += 1; },
      onPause: () => {},
      debug: false,
    });

    expect(stepCount).toBe(VISIT_COUNT);
  });

  test('debug: false leaves m.debugBreak metadata on yields (gating is run-level only)', async () => {
    // Direct runStepByStep consumers see the metadata regardless of how run()
    // is configured. Here we observe via onStep, which receives the original
    // yielded MachineState — its debugBreak field is unaffected.
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const yields: MachineState[] = [];

    await machine.run({
      initialState: state,
      onStep: (m) => { yields.push(m); },
      onPause: () => {},
      debug: false,
    });

    expect(yields).toHaveLength(VISIT_COUNT);
    // EVERY yield carries the metadata (wildcard before-filter), even though
    // no onPause fires.
    for (const y of yields) {
      expect(y.debugBreak).toEqual({before: true});
    }
  });
});
