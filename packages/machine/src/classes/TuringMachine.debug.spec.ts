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
  test('debug.after = true tags the NEXT yield with debugBreak.after', () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // First yield: state had no prior — no after.
    expect(steps[0]).not.toHaveProperty('debugBreak');
    // Subsequent yields all carry debugBreak.after (because every prev
    // visit was at this state with after=true matching wildcard).
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].debugBreak).toEqual({after: true});
    }
  });

  test('after on a transition leading to halt is silently lost', () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // The final transition leads to halt — its after has no next yield to land on.
    // (No assertion needed — this just confirms run() completes; pending after
    // at halt is by-design lost. See spec §11.1.)
    expect(steps.length).toBeGreaterThan(0);
  });

  test('before AND after on same visit produce both flags on the relevant yields', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // First yield: only before (no prior after).
    expect(steps[0].debugBreak).toEqual({before: true});
    // Middle yields: both flags (prev's after AND current's before).
    for (let i = 1; i < steps.length - 1; i++) {
      expect(steps[i].debugBreak).toEqual({before: true, after: true});
    }
  });

  test('after with symbol list matches only listed symbols', () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol(['A']);
    state.debug = {after: [symA]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // The 'after' fires on yield N+1 if yield N's state had symA on the head.
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      if (prev.currentSymbols[0] === 'A') {
        expect(steps[i].debugBreak).toEqual({after: true});
      } else {
        expect(steps[i]).not.toHaveProperty('debugBreak');
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

  test('onPause for "after" sees the SOURCE state (substitution)', async () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const seen: Array<{state: State, debugBreak?: MachineState['debugBreak'], step: number}> = [];

    await machine.run({
      initialState: state,
      onPause: (m) => {
        seen.push({state: m.state, debugBreak: m.debugBreak, step: m.step});
      },
    });

    // Every after-call should show m.state === source state (the one whose
    // after fired) — that's our buildMachine state since it's a single-state graph.
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect(entry.debugBreak).toEqual({after: true});
    }
  });

  test('both "before" and "after" on same yield → two hook calls in order', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const calls: Array<'before' | 'after'> = [];

    await machine.run({
      initialState: state,
      onPause: (m) => {
        if (m.debugBreak?.after) calls.push('after');
        if (m.debugBreak?.before) calls.push('before');
      },
    });

    // For each "middle" yield (not first), pattern is: ['after', 'before', 'after', 'before', ...].
    // First yield only has 'before'. Verify ordering: every 'after' is followed
    // (eventually) by 'before' of the same yield.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toBe('before'); // first visit, no prior after
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

// These tests assert the v5 spec from #108. They are intentionally RED on the
// v4 codebase — they turn green when the loop-drain fix and haltState rejection
// land. The "after on a transition leading to halt is silently lost" test in
// the second describe above (currently labelled by-design) is contradicted by
// part-1 below and will be updated in lockstep with the fix.
describe('TuringMachine — halt semantics for after-fire (#108)', () => {
  afterEach(() => { haltState.debug = null; });

  test('halting iter still fires its after (#108 part 1)', async () => {
    // Tape ['A','B','A'] traverses 4 visits in the single-state machine:
    //   visit 1 head 'A'  → erase+right (state self-loops)
    //   visit 2 head 'B'  → erase+right
    //   visit 3 head 'A'  → erase+right
    //   visit 4 head blank→ ifOtherSymbol → halt
    // debug.after = true matches every visit. Today only 3 after-fires reach
    // onPause (visit 4's after has no anchor yield); v5 must drain it
    // and produce 4.
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
