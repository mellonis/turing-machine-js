import Alphabet from './Alphabet';
import State, {abortState, CallFrame, haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {MachineState, type RunResult} from './TuringMachine';
import DebugSession from './DebugSession';
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

    // matchedTransition. Transition declaration order on
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

  test('run (sync, no observation) drains to halt', () => {
    machine.run({initialState, stepsLimit: 1e5});
    expect(tape.symbols.join('').trim().length).toBe(0);
  });

  test('run with DebugSession observes every step in order', async () => {
    const steps: MachineState[] = [];
    const session = new DebugSession(machine, {initialState, stepsLimit: 1e5});
    session.on('step', (m) => { steps.push(m); });
    await session.start();
    // DebugSession's step listener fires once per iter — matches the v6
    // onStep contract.
    expect(steps.length).toBe(expectedSteps.length);
    for (let i = 0; i < steps.length; i++) {
      // step listener gets the live MachineState. expectedSteps were captured
      // from the pre-v7 run({onStep}) shape; the visible MachineState fields
      // are the same. matchObject ignores the internal MACHINE_STATE_INTERNAL.
      expect(steps[i]).toMatchObject(expectedSteps[i] as object);
    }
  });

  test('stepsLimit throws "Long execution" after N iters', () => {
    // run() is sync — `throws`, not `rejects`.
    expect(() => machine.run({initialState, stepsLimit: 0})).toThrow('Long execution');
    expect(() => machine.run({initialState, stepsLimit: 1})).toThrow('Long execution');
    expect(() => machine.run({initialState, stepsLimit: 2})).toThrow('Long execution');
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

  test('per-iter lifecycle: pause-before → step → pause-after → iter', async () => {
    // Arm both before+after on the initial state so the dispatch order
    // before(K) → step(K) → after(K) → iter(K) is observable per iter via
    // DebugSession's events.
    initialState.debug = {before: true, after: true};

    const order: string[] = [];

    const session = new DebugSession(machine, {initialState, stepsLimit: 1e5});
    session.on('step', (m) => { order.push(`step-${m.step}`); });
    session.on('pause', (m) => {
      order.push(`pause-${m.pause.side}-${m.step}`);
      session.continue();
    });
    session.on('iter', (m) => { order.push(`iter-${m.step}`); });
    await session.start();

    initialState.debug = null; // reset for other tests

    // For every iter K we must see (in order):
    //   pause-before-K, step-K, pause-after-K, iter-K
    expect(order.length).toBeGreaterThan(0);
    expect(order.length % 4).toBe(0);
    for (let i = 0; i < order.length; i += 4) {
      const k = order[i].split('-').pop();
      expect(order[i]).toBe(`pause-before-${k}`);
      expect(order[i + 1]).toBe(`step-${k}`);
      expect(order[i + 2]).toBe(`pause-after-${k}`);
      expect(order[i + 3]).toBe(`iter-${k}`);
    }
  });
  // NOTE: The v6 `debug: false` master-switch test is dropped — v7 removes
  // the master switch (along with the rest of the run() callback surface).
  // DebugSession's iter event already covers "fires regardless of breakpoint
  // configuration" via the buildWalker tests in DebugSession.spec.ts.
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

// Regression: halt-stack must be run-scoped, not machine-scoped, so
// a peeked-then-disposed generator doesn't leak a stack entry into the next
// run. Builds a wrapper whose bare halts on blank and whose override also
// halts immediately — the minimal shape that surfaces the bug.
describe('halt-stack reset between calls (regression)', () => {
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

    // Caller peeks at iter 1 then disposes the generator without draining.
    // `.return()` now needs a `RunResult` argument (the abort feature made
    // the generator's return type non-void) — the disposal doesn't care about the value, so cast through
    // `unknown` rather than fabricate a meaningless RunResult.
    const gen = machine.runStepByStep({initialState});
    gen.next();
    gen.return(undefined as unknown as RunResult);

    const iters: Array<{step: number; name: string}> = [];
    for (const m of machine.runStepByStep({initialState})) {
      iters.push({step: m.step, name: m.state.name ?? ''});
    }

    expect(iters).toEqual([
      {step: 1, name: 'walkToBlank(writeMarker)'},
      {step: 2, name: 'walkToBlank'},
      {step: 3, name: 'walkToBlank'},
      {step: 4, name: 'walkToBlank'},
      {step: 5, name: 'writeMarker'},
    ]);
    expect(tape.symbols).toEqual(['a', 'b', 'a', '*']);
  });

  test('runStepByStep and DebugSession iter event produce identical sequences', async () => {
    const a = buildWrapperOverWalkToBlank();
    const fromGen: Array<{step: number; name: string}> = [];
    for (const m of a.machine.runStepByStep({initialState: a.initialState})) {
      fromGen.push({step: m.step, name: m.state.name ?? ''});
    }

    const b = buildWrapperOverWalkToBlank();
    const fromSession: Array<{step: number; name: string}> = [];
    const session = new DebugSession(b.machine, {initialState: b.initialState});
    session.on('iter', (m) => {
      fromSession.push({step: m.step, name: m.state.name ?? ''});
    });
    await session.start();

    expect(fromSession).toEqual(fromGen);
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
    // its own override; a leaking machine-scoped stack would see a stale
    // override on the second run and produce one extra iter.
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
    for (const m of machine.runStepByStep({initialState})) {
      first.push({step: m.step, name: m.state.name ?? ''});
    }

    const second: Array<{step: number; name: string}> = [];
    for (const m of machine.runStepByStep({initialState})) {
      second.push({step: m.step, name: m.state.name ?? ''});
    }

    expect(first.length).toBe(2); // wrapper-iter + continuation-iter
    expect(second).toEqual(first);
  });
});

// abortState punch-through semantics on run()/runStepByStep()'s
// RunResult. Helper builds a fresh fixture per call (tapeBlock symbol
// patterns are tapeBlock-scoped, matching the halt-stack helper above): a single
// bare `inner` whose 'a'-transition targets `abortState` directly (a legal
// transition TARGET — only wohs composition with abort is banned) and whose
// fallback halts; `outer` wraps it with a legal continuation `cont` via
// `withOverriddenHaltState`, so running `outer` pushes `cont` onto the
// halt-stack before `inner`'s own transition fires.
describe('abortState run semantics', () => {
  function buildAbortFixture(tapeSymbol: string) {
    const abortAlphabet = new Alphabet([' ', 'a', 'b']);
    const tape = new Tape({alphabet: abortAlphabet, symbols: [tapeSymbol]});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;

    const cont = new State({
      [ifOtherSymbol]: {nextState: haltState},
    }, 'cont');

    const inner = new State({
      [symbol(['a'])]: {nextState: abortState},
      [ifOtherSymbol]: {nextState: haltState},
    }, 'inner');

    const outer = inner.withOverriddenHaltState(cont);

    return {machine, inner, cont, outer};
  }

  it('abort punches through the subroutine stack', () => {
    // tape 'a', start at outer → inner reads 'a' → abortState.
    const {machine, inner, cont, outer} = buildAbortFixture('a');
    const result = machine.run({initialState: outer});

    expect(result.outcome).toBe('aborted');
    expect(result.state).toBe(inner); // the triggering state (the bare)
    expect(result.stack).toEqual([cont]);
    expect(Object.isFrozen(result.stack)).toBe(true);
    expect(result.step).toBe(1);
  });

  it('halt returns outcome halted with empty stack', () => {
    // tape 'b' → inner falls to ifOtherSymbol → halt pops to cont → cont halts.
    const {machine, cont, outer} = buildAbortFixture('b');
    const result = machine.run({initialState: outer});

    expect(result.outcome).toBe('halted');
    expect(result.state).toBe(cont);
    expect(result.stack).toEqual([]);
  });

  it('the generator return value carries the outcome', () => {
    const {machine, outer} = buildAbortFixture('a');
    const gen = machine.runStepByStep({initialState: outer});
    let r = gen.next();

    while (!r.done) {
      r = gen.next();
    }

    expect(r.value.outcome).toBe('aborted');
  });

  it('the final yield shows nextState === abortState (canonical step-level signal)', () => {
    const {machine, outer} = buildAbortFixture('a');
    let last: MachineState | undefined;

    for (const m of machine.runStepByStep({initialState: outer})) {
      last = m;
    }

    expect(last!.nextState).toBe(abortState);
  });

  it('initialState === abortState ends immediately as aborted at step 0', () => {
    const {machine} = buildAbortFixture('a');
    const result = machine.run({initialState: abortState});

    expect(result).toMatchObject({outcome: 'aborted', state: abortState, step: 0});
  });

  it('halted result unwraps CallFrame to bare', () => {
    // inner wrapped directly with haltState halts on any char.
    // Result.state must be the bare (inner), not the CallFrame wrapper.
    const {machine, inner} = buildAbortFixture('b');
    const wrapped = inner.withOverriddenHaltState(haltState);
    const result = machine.run({initialState: wrapped});

    expect(result.outcome).toBe('halted');
    expect(result.state).toBe(inner);
    expect(result.state).not.toBeInstanceOf(CallFrame);
  });
});
