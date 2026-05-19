import {vi} from 'vitest';
import Alphabet from './Alphabet';
import State, {haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {MachineState} from './TuringMachine';
import {movements, symbolCommands} from './TapeCommand';
import Reference from './Reference';

const alphabet = new Alphabet(' ABC'.split(''));

describe('run tests', () => {
  let tape: Tape;
  let machine: TuringMachine;
  let initialState: State;
  let expectedSteps: MachineState[];

  beforeEach(() => {
    const symbolList = alphabet.symbols.slice(1, alphabet.symbols.length);

    tape = new Tape({
      alphabet,
      symbols: symbolList,
    });

    const tapeBlock = TapeBlock.fromTapes([tape]);

    machine = new TuringMachine({
      tapeBlock,
    });

    const {symbol} = tapeBlock;

    initialState = new State({
      [symbol(symbolList)]: {
        command: [
          {
            symbol: symbolCommands.erase,
            movement: movements.right,
          },
        ],
      },
      [ifOtherSymbol]: {
        nextState: haltState,
      },
    });

    expectedSteps = [
      {
        step: 1,
        state: initialState,
        currentSymbols: [alphabet.symbols[1]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
      },
      {
        step: 2,
        state: initialState,
        currentSymbols: [alphabet.symbols[2]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
      },
      {
        step: 3,
        state: initialState,
        currentSymbols: [alphabet.symbols[3]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
      },
      {
        step: 4,
        state: initialState,
        currentSymbols: [alphabet.blankSymbol],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.stay],
        nextState: haltState,
      },
    ];
  });

  test('run', async () => {
    const steps: MachineState[] = [];

    await machine.run({initialState, stepsLimit: 1e5, onStep: (step) => { steps.push(step); }});

    expect(steps)
      .toEqual(expectedSteps);
    expect(tape.symbols.join('').trim().length)
      .toBe(0);
  });

  test('stepsLimit', async () => {
    const onStepsLimit0Mock = vi.fn();

    await expect(machine.run({
      initialState,
      stepsLimit: 0,
      onStep: () => onStepsLimit0Mock()
    })).rejects.toThrow('Long execution');
    expect(onStepsLimit0Mock.mock.calls.length).toEqual(0);

    const onStepsLimit1Mock = vi.fn();

    await expect(machine.run({
      initialState,
      stepsLimit: 1,
      onStep: () => onStepsLimit1Mock()
    })).rejects.toThrow('Long execution');
    expect(onStepsLimit1Mock.mock.calls.length).toEqual(1);

    const onStepsLimit2Mock = vi.fn();

    await expect(machine.run({
      initialState,
      stepsLimit: 2,
      onStep: () => onStepsLimit2Mock()
    })).rejects.toThrow('Long execution');
    expect(onStepsLimit2Mock.mock.calls.length).toEqual(2);
  });

  test('stepByStep', () => {
    const generator = machine.runStepByStep({initialState, stepsLimit: 1e5});


    for (const step of generator) {
      const expectedStep = expectedSteps.find((_) => _.step === step.step);

      expect(step)
        .toEqual(expectedStep);
    }

    expect(tape.symbols.join('').trim().length)
      .toBe(0);
  });

  test('stepByStep stop execution', () => {
    const generator = machine.runStepByStep({initialState, stepsLimit: 1e5});

    expect(() => {
      generator.next();
      generator.throw(haltState);
    }).not.toThrow();
    expect(generator.next().done).toBe(true);
  });

  test('stepByStep stop execution with exception', () => {
    const generator = machine.runStepByStep({initialState, stepsLimit: 1e5});

    expect(() => {
      generator.next();
      generator.throw(new Error('some exception'));
    }).toThrow('some exception');
    expect(generator.next().done).toBe(true);
  });

  test('onIter fires once per iter, awaited, after both pause dispatches (#163)', async () => {
    // Arm both before+after on the initial state so the dispatch order
    // before(K) → step(K) → after(K) → iter(K) is observable per iter.
    initialState.debug = {before: true, after: true};

    const order: string[] = [];
    const yieldToMicrotask = () => new Promise<void>((r) => queueMicrotask(r));

    await machine.run({
      initialState,
      stepsLimit: 1e5,
      onStep: (m) => { order.push(`step-${m.step}`); },
      onPause: (m) => {
        const when = m.debugBreak?.before ? 'before' : 'after';
        order.push(`pause-${when}-${m.step}`);
      },
      onIter: async (m) => {
        order.push(`iter-pre-${m.step}`);
        await yieldToMicrotask();
        order.push(`iter-post-${m.step}`);
      },
    });

    initialState.debug = null; // reset for other tests

    // For every iter K we must see:
    //   pause-before-K, step-K, pause-after-K, iter-pre-K, iter-post-K
    // …adjacent and in that order, never interleaved across iters
    // (which would mean onIter wasn't awaited).
    expect(order.length).toBeGreaterThan(0);
    expect(order.length % 5).toBe(0);
    for (let i = 0; i < order.length; i += 5) {
      const k = order[i].split('-').pop();
      expect(order[i]).toBe(`pause-before-${k}`);
      expect(order[i + 1]).toBe(`step-${k}`);
      expect(order[i + 2]).toBe(`pause-after-${k}`);
      expect(order[i + 3]).toBe(`iter-pre-${k}`);
      expect(order[i + 4]).toBe(`iter-post-${k}`);
    }
  });

  test('onIter fires unconditionally (not gated by debug flag) (#163)', async () => {
    // No state.debug armed AND `debug: false` master switch — onPause must
    // never fire, but onIter still fires every iter.
    const iters: number[] = [];

    await machine.run({
      initialState,
      stepsLimit: 1e5,
      debug: false,
      onIter: (m) => { iters.push(m.step); },
    });

    expect(iters.length).toBeGreaterThan(0);
    // Strictly increasing — one onIter per iter.
    for (let i = 1; i < iters.length; i++) {
      expect(iters[i]).toBeGreaterThan(iters[i - 1]);
    }
  });

});

describe('properties', () => {
  test('tapeBlock exists', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const machine = new TuringMachine({
      tapeBlock,
    });

    expect(machine.tapeBlock)
      .toBeDefined();

    expect(machine.tapeBlock)
      .toBe(tapeBlock);
  });
});

describe('parallel execution with same tape block', () => {
  let tapeBlock: TapeBlock;
  let machineA: TuringMachine;
  let machineB: TuringMachine;

  beforeEach(() => {
    tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    machineA = new TuringMachine({tapeBlock});
    machineB = new TuringMachine({tapeBlock});
  });

  test('throw error on parallel execution start', () => {
    const reference = new Reference();
    const infiniteState = new State({
      [ifOtherSymbol]: {
        nextState: reference,
      },
    });
    reference.bind(infiniteState);
    const executionGeneratorA = machineA.runStepByStep({
      initialState: infiniteState,
    });
    const executionGeneratorB = machineB.runStepByStep({
      initialState: infiniteState,
    });
    // NOTE: avoid `expect(a).not.toBe(b)` with generator args — vitest 4.x's
    // matcher inspects the comparison target enough to invoke iteration,
    // which prematurely runs the generator body (here: takes the lock).
    // Comparing the boolean result keeps the matcher off the generator.
    expect(executionGeneratorA !== executionGeneratorB).toBe(true);
    expect(() => executionGeneratorA.next()).not.toThrow();
    expect(() => executionGeneratorA.next()).not.toThrow();
    expect(() => executionGeneratorB.next()).toThrow('Lock check failed');
    // stop A execution
    expect(() => executionGeneratorA.throw(haltState)).not.toThrow();
    // execute B without errors
    expect(() => executionGeneratorB.next()).not.toThrow();
  });
  test('do not throw on sequenced execution', () => {
    const oneStepState = new State({
      [ifOtherSymbol]: {
        nextState: haltState,
      },
    });
    const executionGeneratorA = machineA.runStepByStep({
      initialState: oneStepState,
    });
    const executionGeneratorB = machineB.runStepByStep({
      initialState: oneStepState,
    });
    expect(() => {
      while (!executionGeneratorA.next().done) ;
    }).not.toThrow();
    expect(() => {
      while (!executionGeneratorB.next().done) ;
    }).not.toThrow();
  });
});

describe('TuringMachine constructor', () => {
  test('throws when tapeBlock is missing', () => {
    // The constructor's destructured tapeBlock has a default of {} — calling
    // without arguments hits the validator's "no tapeBlock" branch.
    expect(() => new TuringMachine()).toThrow(/invalid tapeBlock/);
    expect(() => new TuringMachine({} as never)).toThrow(/invalid tapeBlock/);
  });
});
