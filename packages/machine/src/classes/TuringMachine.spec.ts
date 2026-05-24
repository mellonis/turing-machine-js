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

    // #205 matchedTransition. Transition declaration order on
    // `initialState`:
    //   ix 0 → `[symbol(symbolList)]` (specific symbol-list pattern)
    //   ix 1 → `[ifOtherSymbol]` (catch-all)
    // Iters 1-3 read concrete alphabet symbols matched by ix 0 (literal).
    // Iter 4 reads blank, falls through to ix 1 (wildcard).
    const transitionListMatch = {
      id: `${initialState.id}.0`,
      matchKinds: ['literal' as const],
    };
    const transitionWildcardMatch = {
      id: `${initialState.id}.1`,
      matchKinds: ['wildcard' as const],
    };

    expectedSteps = [
      {
        step: 1,
        state: initialState,
        currentSymbols: [alphabet.symbols[1]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
        matchedTransition: transitionListMatch,
      },
      {
        step: 2,
        state: initialState,
        currentSymbols: [alphabet.symbols[2]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
        matchedTransition: transitionListMatch,
      },
      {
        step: 3,
        state: initialState,
        currentSymbols: [alphabet.symbols[3]],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.right],
        nextState: initialState,
        matchedTransition: transitionListMatch,
      },
      {
        step: 4,
        state: initialState,
        currentSymbols: [alphabet.blankSymbol],
        nextSymbols: [alphabet.blankSymbol],
        movements: [movements.stay],
        nextState: haltState,
        matchedTransition: transitionWildcardMatch,
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

// Regression tests for #196 — the halt-stack used to be an instance field on
// TuringMachine that wasn't reset between `runStepByStep` calls, so a caller
// that peeked at iter 1 via the generator (then disposed it with
// `generator.return()`) would leave the wrapper's override on the stack;
// the next `run()` would push it a second time and produce one extra
// iteration on its way out of the call. Builds a wrapper whose bare halts
// on blank and whose override also halts immediately — the minimal shape
// that surfaces the bug.
describe('halt-stack reset between calls (regression for #196)', () => {
  // Helper: build a fresh scenario per call so each subtest has independent
  // State/Tape/TapeBlock instances (the engine's symbol patterns are
  // tapeBlock-scoped — sharing across scenarios would throw "invalid symbol").
  function buildWrapperOverWalkToBlank() {
    const wAlphabet = new Alphabet([' ', 'a', 'b', '*']);
    const tape = new Tape({alphabet: wAlphabet, symbols: ['a', 'b', 'a']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const walkToBlank = new State({
      [symbol([wAlphabet.blankSymbol])]: {
        command: [{movement: movements.stay}],
        nextState: haltState,
      },
      [ifOtherSymbol]: {
        command: [{movement: movements.right}],
      },
    }, 'walkToBlank');
    const writeMarker = new State({
      [ifOtherSymbol]: {
        command: [{symbol: '*', movement: movements.stay}],
        nextState: haltState,
      },
    }, 'writeMarker');
    const initialState = walkToBlank.withOverriddenHaltState(writeMarker);
    return {machine, initialState, tape};
  }

  test('runStepByStep peek + return + run produces no extra iterations', async () => {
    const {machine, initialState, tape} = buildWrapperOverWalkToBlank();

    // Caller peeks at iter 1 then disposes the generator without draining —
    // pre-#196 this left the override on `#stack`.
    const gen = machine.runStepByStep({initialState});
    gen.next();
    gen.return(undefined);

    const iters: Array<{step: number; name: string}> = [];
    await machine.run({
      initialState,
      onIter: (m) => {
        iters.push({step: m.step, name: m.state.name ?? ''});
      },
    });

    expect(iters).toEqual([
      {step: 1, name: 'walkToBlank(writeMarker)'},
      {step: 2, name: 'walkToBlank'},
      {step: 3, name: 'walkToBlank'},
      {step: 4, name: 'walkToBlank'},
      {step: 5, name: 'writeMarker'},
    ]);
    expect(tape.symbols).toEqual(['a', 'b', 'a', '*']);
  });

  test('runStepByStep and run produce identical iter sequences', async () => {
    const a = buildWrapperOverWalkToBlank();
    const fromGen: Array<{step: number; name: string}> = [];
    for (const m of a.machine.runStepByStep({initialState: a.initialState})) {
      fromGen.push({step: m.step, name: m.state.name ?? ''});
    }

    const b = buildWrapperOverWalkToBlank();
    const fromRun: Array<{step: number; name: string}> = [];
    await b.machine.run({
      initialState: b.initialState,
      onIter: (m) => {
        fromRun.push({step: m.step, name: m.state.name ?? ''});
      },
    });

    expect(fromRun).toEqual(fromGen);
  });

  test('two consecutive runs on the same machine produce identical iter sequences', async () => {
    // A self-loop-free machine — both runs traverse the same iter shape
    // because the input alphabet is wide enough that the head moves off the
    // initial cells and the post-run tape doesn't influence the next run.
    // The point of this test is the #stack accumulation, not tape state.
    const wAlphabet = new Alphabet([' ', 'a', 'b']);
    const tape = new Tape({alphabet: wAlphabet, symbols: ['a']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    // A wrapper around a single-iter halt-on-anything bare. Each run pushes
    // the override; if the pre-#196 leak existed, the second run would see
    // a stale override and one extra iter.
    const bare = new State({
      [ifOtherSymbol]: {
        command: [{movement: movements.stay}],
        nextState: haltState,
      },
    }, 'bare');
    const continuation = new State({
      [ifOtherSymbol]: {
        command: [{movement: movements.stay}],
        nextState: haltState,
      },
    }, 'continuation');
    const initialState = bare.withOverriddenHaltState(continuation);

    const first: Array<{step: number; name: string}> = [];
    await machine.run({
      initialState,
      onIter: (m) => {
        first.push({step: m.step, name: m.state.name ?? ''});
      },
    });

    const second: Array<{step: number; name: string}> = [];
    await machine.run({
      initialState,
      onIter: (m) => {
        second.push({step: m.step, name: m.state.name ?? ''});
      },
    });

    expect(first.length).toBe(2); // wrapper-iter + continuation-iter
    expect(second).toEqual(first);
  });
});
