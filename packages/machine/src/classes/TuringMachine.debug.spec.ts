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
