import {describe, it, expect} from 'vitest';
import Alphabet from './Alphabet';
import State, {haltState} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {MACHINE_STATE_INTERNAL, type MachineStateInternal} from './TuringMachine';
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
