import {describe, it, expect} from 'vitest';
import Alphabet from './Alphabet';
import State, {haltState} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {MACHINE_STATE_INTERNAL, type MachineStateInternal} from './TuringMachine';

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
