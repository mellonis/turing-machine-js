import {
  Alphabet,
  haltState,
  ifOtherSymbol,
  movements,
  Reference,
  State,
  symbolCommands,
  Tape,
  TapeBlock,
  TuringMachine,
} from '@turing-machine-js/machine';


describe('README.md', () => {
  test('An example', async () => {
    const alphabet = new Alphabet([' ', 'a', 'b', 'c', '*']);
    const tape = new Tape({
      alphabet,
      symbols: ['a', 'b', 'c', 'b', 'a'],
    });
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({
      tapeBlock,
    });

    // console.log(tape.symbols.join('').trim()); // abcba

    expect(tape.symbols.join('').trim())
      .toBe('abcba');

    await machine.run({
      initialState: new State({
        [tapeBlock.symbol(['b'])]: {
          command: [
            {
              symbol: '*',
              movement: movements.right,
            },
          ],
        },
        [tapeBlock.symbol([tape.alphabet.blankSymbol])]: {
          command: [
            {
              movement: movements.left,
            },
          ],
          nextState: haltState,
        },
        [ifOtherSymbol]: {
          command: [
            {
              movement: movements.right,
            },
          ],
        },
      }),
    });

    // console.log(tape.symbols.join('').trim()); // a*c*a

    expect(tape.symbols.join('').trim())
      .toBe('a*c*a');
  });
});

describe('README.md — Debugging breakpoints', () => {
  const alphabet = new Alphabet(' AB'.split(''));

  // Deterministic 2-visit fixture: tape ['A','B'], single state.
  //   visit 1: head 'A' → matches symA → erase + right. State self-loops.
  //   visit 2: head 'B' → ifOtherSymbol → nextState=haltState. (No command → keep+stay.)
  const VISIT_COUNT = 2;
  const A_VISIT_COUNT = 1; // visit 1
  const HALT_TRANSITION_COUNT = 1; // visit 2 transitions to haltState

  const buildExampleMachine = () => {
    const tape = new Tape({alphabet, symbols: ['A', 'B']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const symA = symbol(['A']);
    const myState = new State({
      [symA]: {command: [{symbol: symbolCommands.erase, movement: movements.right}]},
      [ifOtherSymbol]: {nextState: haltState},
    });

    return {machine, myState, symA};
  };

  afterEach(() => { haltState.debug = null; });

  test('Pause before applying any of myState commands (wildcard) — fires on every visit', async () => {
    const {machine, myState} = buildExampleMachine();
    myState.debug = {before: true};
    let breakCount = 0;

    await machine.run({initialState: myState, onPause: () => { breakCount += 1; }});

    expect(breakCount).toBe(VISIT_COUNT);
  });

  test('Pause only when head shows symA — fires once for the single A visit', async () => {
    const {machine, myState, symA} = buildExampleMachine();
    myState.debug = {before: [symA]};
    let symASeen = 0;
    let nonASeen = 0;

    await machine.run({
      initialState: myState,
      onPause: (m) => {
        if (m.currentSymbols[0] === 'A') symASeen += 1;
        else nonASeen += 1;
      },
    });

    expect(symASeen).toBe(A_VISIT_COUNT);
    expect(nonASeen).toBe(0);
  });

  test('Before AND after for same symbol → two pauses per visit, fires on the A visit only', async () => {
    const {machine, myState, symA} = buildExampleMachine();
    myState.debug = {before: [symA], after: [symA]};
    const order: Array<'before' | 'after'> = [];

    await machine.run({
      initialState: myState,
      onPause: (m) => {
        if (m.debugBreak?.before) order.push('before');
        if (m.debugBreak?.after) order.push('after');
      },
    });

    // Only visit 1 (head=A) matches; per-iter lifecycle is before → after.
    // Visit 2 (head=B) doesn't match, no fires.
    expect(order).toEqual(['before', 'after']);
  });

  test('haltState.debug = true pauses on halt entry — fires once at the final visit (#207)', async () => {
    const {machine, myState} = buildExampleMachine();
    haltState.debug = true;
    const haltPauses: Array<{atVisit: number}> = [];
    let visitIx = 0;

    await machine.run({
      initialState: myState,
      onStep: () => { visitIx += 1; }, // increments before onPause for this visit
      onPause: (m) => {
        // #207: halt-imminent fires on AFTER side (post-iter, before halt
        // processing). The triggering iter's `nextState` is haltState, and
        // `debugBreak.after === true`.
        if (m.nextState === haltState && m.debugBreak?.after) {
          haltPauses.push({atVisit: visitIx});
        }
      },
    });

    expect(haltPauses).toHaveLength(HALT_TRANSITION_COUNT);
    // Per-iter dispatch order is `before → step → after` — onStep increments
    // visitIx during step, then onPause for `after` reads it. The recorded
    // visit index matches the human-readable visit count.
    expect(haltPauses[0].atVisit).toBe(VISIT_COUNT);
  });

  test('Reset filters by assigning null', () => {
    const {myState} = buildExampleMachine();
    myState.debug = {before: true};

    expect(myState.debug.before).toBe(true);

    myState.debug = null;

    // Reading after null assignment lazy-recreates a fresh empty DebugConfig.
    expect(myState.debug.before).toBeUndefined();
    expect(myState.debug.after).toBeUndefined();
  });

  test('Chained field write works on a fresh state', () => {
    const {myState, symA} = buildExampleMachine();
    myState.debug.before = true;
    myState.debug.after = [symA];

    expect(myState.debug.before).toBe(true);
    expect(myState.debug.after).toEqual([symA]);
  });

  test('Incremental update via per-property setter', () => {
    const {myState, symA} = buildExampleMachine();
    myState.debug = {before: [symA]};

    myState.debug.before = [...(myState.debug.before as readonly symbol[]), ifOtherSymbol];

    expect(myState.debug.before).toEqual([symA, ifOtherSymbol]);
  });

  test('onStep + onPause fire independently — same count on this fixture', async () => {
    const {machine, myState} = buildExampleMachine();
    myState.debug = {before: true};
    let stepCount = 0;
    let breakCount = 0;

    await machine.run({
      initialState: myState,
      onStep: () => { stepCount += 1; },
      onPause: () => { breakCount += 1; },
    });

    expect(stepCount).toBe(VISIT_COUNT);
    expect(breakCount).toBe(VISIT_COUNT);
  });
});

describe('README.md — Matched transition', () => {
  test('onStep logs transition id and per-tape wildcard positions (#205)', async () => {
    const alphabet = new Alphabet([' ', 'a', 'b', 'c', '*']);
    const tape = new Tape({alphabet, symbols: ['a', 'b', 'c', 'b', 'a']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});

    // Same fixture as "An example" — patterns declared in this order:
    //   ix 0: literal 'b'  → write '*', right
    //   ix 1: literal ' '  → left, halt
    //   ix 2: ifOtherSymbol → right
    // Tape walk: a, b, c, b, a, blank → 6 iters total.
    const initialState = new State({
      [tapeBlock.symbol(['b'])]: {
        command: [{symbol: '*', movement: movements.right}],
      },
      [tapeBlock.symbol([tape.alphabet.blankSymbol])]: {
        command: [{movement: movements.left}],
        nextState: haltState,
      },
      [ifOtherSymbol]: {
        command: [{movement: movements.right}],
      },
    });

    const logged: string[] = [];

    // Verbatim from README's "Matched transition" section, with console.log
    // replaced by capture for assertion.
    await machine.run({
      initialState,
      onStep: (m) => {
        const wildcardPositions = m.matchedTransition.matchKinds
          .map((k, i) => k === 'wildcard' ? i : -1)
          .filter((i) => i >= 0);
        logged.push(`step ${m.step}: fired transition ${m.matchedTransition.id} (wildcards at tapes: ${wildcardPositions.join(',') || 'none'})`);
      },
    });

    const sid = initialState.id;
    expect(logged).toEqual([
      `step 1: fired transition ${sid}.2 (wildcards at tapes: 0)`,  // 'a' → ifOther
      `step 2: fired transition ${sid}.0 (wildcards at tapes: none)`, // 'b' → literal
      `step 3: fired transition ${sid}.2 (wildcards at tapes: 0)`,  // 'c' → ifOther
      `step 4: fired transition ${sid}.0 (wildcards at tapes: none)`, // 'b' → literal
      `step 5: fired transition ${sid}.2 (wildcards at tapes: 0)`,  // 'a' → ifOther
      `step 6: fired transition ${sid}.1 (wildcards at tapes: none)`, // blank → halt
    ]);
  });
});

// Pin the inline `buildFromTable` helper shown in
// packages/machine/README.md ("Building from a state table"). The helper is
// reproduced here verbatim — if it stops compiling or producing the
// documented output, this test fails and the README must update.
describe('README.md — Building from a state table', () => {
  // Verbatim from the README:
  function buildFromTable({alphabetString, initialState, finalStates, table}: {
    alphabetString: string;
    initialState: string;
    finalStates: string[];
    table: Record<string, Record<string, {write?: string; move?: 'L' | 'R' | 'S'; goto: string}>>;
  }) {
    const alphabet = new Alphabet(alphabetString.split(''));
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const movementOf: Record<'L' | 'R' | 'S', symbol> = {
      L: movements.left,
      R: movements.right,
      S: movements.stay,
    };

    const refs = Object.fromEntries(Object.keys(table).map((name) => [name, new Reference()]));
    const states: Record<string, State> = {};

    for (const [name, row] of Object.entries(table)) {
      const def: ConstructorParameters<typeof State>[0] = {};
      for (const [read, action] of Object.entries(row)) {
        const key = read === '*' ? ifOtherSymbol : tapeBlock.symbol([read]);
        def![key] = {
          command: {
            symbol: action.write ?? symbolCommands.keep,
            movement: movementOf[action.move ?? 'S'],
          },
          nextState: finalStates.includes(action.goto) ? haltState : refs[action.goto],
        };
      }
      states[name] = new State(def, name);
      refs[name].bind(states[name]);
    }

    return {
      tapeBlock,
      machine: new TuringMachine({tapeBlock}),
      initialState: states[initialState],
    };
  }

  test('the same "replace b with *" machine, declared as a table, produces a*c*a', async () => {
    const {tapeBlock, machine, initialState} = buildFromTable({
      alphabetString: ' abc*',
      initialState: 'scan',
      finalStates: ['HALT'],
      table: {
        scan: {
          'b': {write: '*', move: 'R', goto: 'scan'},
          ' ': {              move: 'L', goto: 'HALT'},
          '*': {              move: 'R', goto: 'scan'}, // '*' = ifOtherSymbol per the helper
        },
      },
    });

    const tape = new Tape({alphabet: tapeBlock.alphabets[0], symbols: ['a', 'b', 'c', 'b', 'a']});
    tapeBlock.replaceTape(tape);

    await machine.run({initialState});

    expect(tape.symbols.join('').trim()).toBe('a*c*a');
  });
});

// Pin the withOverriddenHaltState subroutine-composition example from the README.
describe('README.md — Subroutine composition with withOverriddenHaltState', () => {
  test('scanToX.withOverriddenHaltState(eraseHere) erases the first X and lands on it', async () => {
    const alphabet = new Alphabet([' ', 'a', 'b', 'X']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const scanToX = new State({
      [symbol(['X'])]: {nextState: haltState},
      [ifOtherSymbol]: {command: {movement: movements.right}},
    }, 'scanToX');

    const eraseHere = new State({
      [ifOtherSymbol]: {command: {symbol: symbolCommands.erase}, nextState: haltState},
    }, 'eraseHere');

    const scanThenErase = scanToX.withOverriddenHaltState(eraseHere);

    const tape = new Tape({alphabet, symbols: ['a', 'b', 'X', 'b', 'a']});
    tapeBlock.replaceTape(tape);

    await new TuringMachine({tapeBlock}).run({initialState: scanThenErase});

    expect(tape.symbols.join('')).toBe('ab ba');
    expect(tape.position).toBe(2); // head landed where the X used to be
  });

  test('the original scanToX is left unmodified by withOverriddenHaltState', async () => {
    const alphabet = new Alphabet([' ', 'X']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const scanToX = new State({
      [symbol(['X'])]: {nextState: haltState},
      [ifOtherSymbol]: {command: {movement: movements.right}},
    }, 'scanToX');

    const eraseHere = new State({
      [ifOtherSymbol]: {command: {symbol: symbolCommands.erase}, nextState: haltState},
    }, 'eraseHere');

    // Wrapping doesn't mutate the original.
    scanToX.withOverriddenHaltState(eraseHere);

    expect(scanToX.overriddenHaltState).toBeNull();

    // Running scanToX standalone (no wrapper) just halts at the X — the
    // X is NOT erased.
    const tape = new Tape({alphabet, symbols: ['X']});
    tapeBlock.replaceTape(tape);

    await new TuringMachine({tapeBlock}).run({initialState: scanToX});

    expect(tape.symbols.join('')).toBe('X');
  });
});

// Pin the Reference cyclic-graph example from the same README.
describe('README.md — Reference cyclic graph', () => {
  test('ref.bind() lets a transition forward-declare its target', () => {
    const alphabet = new Alphabet([' ', 'x', 'y']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const ref = new Reference();
    const a = new State({[symbol(['x'])]: {nextState: ref}}, 'a');
    const b = new State({[symbol(['y'])]: {nextState: a}}, 'b');
    ref.bind(b); // a's transition now resolves to b

    expect((a.getNextState(symbol(['x'])) as Reference).ref).toBe(b);
    expect(b.getNextState(symbol(['y']))).toBe(a);
  });
});
