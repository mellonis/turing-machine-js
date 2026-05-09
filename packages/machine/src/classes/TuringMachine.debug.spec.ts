import Alphabet from './Alphabet';
import State, {haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {type MachineState} from './TuringMachine';
import {movements, symbolCommands} from './TapeCommand';

const alphabet = new Alphabet(' AB'.split(''));

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
  test('without debug, no debugBreak field on yields', () => {
    const {machine, state} = buildMachine();
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });

  test('debug.before = true tags every visit with debugBreak.before', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({before: true});
    }
  });

  test('debug.before with symbol list matches only listed symbols', () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol(['A']);
    state.debug = {before: [symA]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Visits where head shows 'A' carry debugBreak.before; others don't.
    const aVisits = steps.filter((s) => s.currentSymbols[0] === 'A');
    const nonAVisits = steps.filter((s) => s.currentSymbols[0] !== 'A');

    expect(aVisits.length).toBeGreaterThan(0);
    for (const v of aVisits) expect(v.debugBreak).toEqual({before: true});
    for (const v of nonAVisits) expect(v).not.toHaveProperty('debugBreak');
  });

  test('debug.before with empty list never matches', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: []};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });

  test('debug.before with [ifOtherSymbol] matches only the catch-all visit', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: [ifOtherSymbol]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // The only catch-all visit is when the head shows blank (ifOtherSymbol path).
    const blankVisits = steps.filter((s) => s.currentSymbols[0] === alphabet.blankSymbol);
    const nonBlankVisits = steps.filter((s) => s.currentSymbols[0] !== alphabet.blankSymbol);

    expect(blankVisits.length).toBe(1);
    expect(blankVisits[0].debugBreak).toEqual({before: true});
    for (const v of nonBlankVisits) expect(v).not.toHaveProperty('debugBreak');
  });
});

describe('TuringMachine — debug.after filter (loop yields)', () => {
  // v6.0.0 (#119): both `before` and `after` refer to THIS iter, dispatched
  // on the same yield. Previously `after` was on the NEXT yield with a
  // substituted source-state payload — see #109/#119 for the rationale.

  test('debug.after = true tags every yield with debugBreak.after', () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Every yield (including the first) carries debugBreak.after because the
    // wildcard filter matches every visit's resolved symbol.
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({after: true});
    }
  });

  test('before AND after on same visit produce both flags on every yield', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // No "first yield is special" anymore: each iter's before and after both
    // refer to that iter, so both flags appear together on every yield where
    // the wildcard filters match.
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({before: true, after: true});
    }
  });

  test('after with symbol list matches only listed symbols', () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol(['A']);
    state.debug = {after: [symA]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // The 'after' fires on yield N if yield N's resolved symbol matches the
    // filter (no longer "yield N+1 if yield N's symbol matched").
    for (const step of steps) {
      if (step.currentSymbols[0] === 'A') {
        expect(step.debugBreak).toEqual({after: true});
      } else {
        expect(step).not.toHaveProperty('debugBreak');
      }
    }
  });
});

describe('TuringMachine — haltState.debug.before', () => {
  afterEach(() => {
    // haltState is a singleton — clear after each test to avoid cross-pollution.
    haltState.debug = null;
  });

  test('haltState.debug.before = true fires on program halt', () => {
    const {machine, state} = buildMachine();
    haltState.debug = {before: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Last step's transition leads to halt — that yield should carry debugBreak.before
    // (because nextState is halt and haltState.debug.before === true).
    const last = steps[steps.length - 1];
    expect(last.nextState).toBe(haltState);
    expect(last.debugBreak?.before).toBe(true);
  });

  test('haltState.debug.before fires on subroutine return (halt-pop)', () => {
    const tape = new Tape({alphabet, symbols: ['A']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;

    // Inner subroutine: erases 'A', halts.
    const inner = new State({
      [symbol(['A'])]: {
        command: [{symbol: symbolCommands.erase, movement: movements.right}],
      },
      [ifOtherSymbol]: {nextState: haltState},
    });

    // Outer continuation: just halts on blank.
    const continuation = new State({
      [ifOtherSymbol]: {nextState: haltState},
    });

    const wrapped = inner.withOverrodeHaltState(continuation);

    haltState.debug = {before: true};
    const steps: MachineState[] = [];

    machine.run({initialState: wrapped, onStep: (s) => steps.push(s)});

    // The yield where inner transitions to haltState (which gets popped to continuation)
    // should still carry debugBreak.before — we paused before entering halt logic.
    const popYield = steps.find((s) => s.nextState === continuation);
    expect(popYield?.debugBreak?.before).toBe(true);
  });

  test('haltState.debug.before with symbol list NEVER matches (no head symbol at halt)', () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol(['A']);
    haltState.debug = {before: [symA]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Halt has no head symbol; list filter cannot match. No debug break should fire
    // because of haltState.debug. (state.debug is null, so no other source.)
    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
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

    await machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Trajectory unaffected — onStep sees same number of yields as without debug.
    expect(steps.length).toBeGreaterThan(0);
    // No exception, no hang.
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

    expect(seen.length).toBeGreaterThan(0);
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

    // v6.0.0: the after-call's `m.state` is the iter that armed the after
    // (no substitution dance — `before` and `after` for the SAME iter both
    // fire on that iter's own yield).
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

    // v6.0.0 per-iter lifecycle: before → step → after. Every yield (including
    // the first) dispatches both hooks in this order.
    expect(calls.length).toBeGreaterThan(0);
    // Pattern is purely alternating: [before, after, before, after, ...].
    for (let i = 0; i < calls.length; i++) {
      expect(calls[i]).toBe(i % 2 === 0 ? 'before' : 'after');
    }
  });

  test('onPause can be async (run awaits it)', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    let released = false;

    const hookDone = new Promise<void>((resolve) => {
      setTimeout(() => { released = true; resolve(); }, 10);
    });

    await machine.run({
      initialState: state,
      onPause: () => hookDone, // run() awaits this
    });

    expect(released).toBe(true);
  });

  test('onStep still fires on every yield, separate from onPause', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const stepCount = {n: 0};
    const breakCount = {n: 0};

    await machine.run({
      initialState: state,
      onStep: () => { stepCount.n += 1; },
      onPause: () => { breakCount.n += 1; },
    });

    expect(stepCount.n).toBeGreaterThan(0);
    expect(breakCount.n).toBeGreaterThan(0);
  });
});

describe('TuringMachine — halt semantics for after-fire (#108)', () => {
  afterEach(() => { haltState.debug = null; });

  test('halting iter still fires its after (#108 part 1)', async () => {
    // Tape ['A','B','A'] traverses 4 visits in the single-state machine:
    //   visit 1 head 'A'  → erase+right (state self-loops)
    //   visit 2 head 'B'  → erase+right
    //   visit 3 head 'A'  → erase+right
    //   visit 4 head blank→ ifOtherSymbol → halt
    // debug.after = true matches every visit. v6.0.0 (#119) dispatches the
    // halting iter's after directly on its own yield, so all 4 visits fire.
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const after: MachineState[] = [];

    await machine.run({
      initialState: state,
      onPause: (m) => { if (m.debugBreak?.after) after.push(m); },
    });

    expect(after.length).toBe(4);
  });

  test('haltState.debug.after = true throws on assignment (#108 part 2)', () => {
    // Halt is terminal — no iteration-after-halt for an after-fire to anchor on.
    // v5 rejects the assignment to surface the misuse rather than silently
    // ignore it.
    expect(() => {
      haltState.debug = {after: true};
    }).toThrow();
  });

  test('haltState.debug with both flags throws (#108 part 2)', () => {
    // Setting before+after symmetrically is the most likely user mistake; the
    // .after part is meaningless and v5 rejects the whole assignment. Use
    // { before: true } alone.
    expect(() => {
      haltState.debug = {before: true, after: true};
    }).toThrow();
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

    expect(pauses.length).toBeGreaterThan(0);
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

    expect(stepCount).toBeGreaterThan(0);
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

    // At least one yield carries the metadata even though no onPause fires.
    expect(yields.some((y) => y.debugBreak?.before)).toBe(true);
  });
});
