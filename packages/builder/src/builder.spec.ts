import {DebugSession, haltState, Tape} from '@turing-machine-js/machine';
import buildMachine, {States} from './index';

describe('buildMachine', () => {
  test('copyString', () => {
    function parse(stateDeclarations: string) {
      const states: States = {};
      const stateDeclarationRegExp = /\((.*?),(.*?)\)->\((.*?),(.*?),(.*?)\);/g;
      let match;

      while (match = stateDeclarationRegExp.exec(stateDeclarations)) {
        const [, stateName, currentSymbol, nextStateName, nextSymbol, nextMovement] = match;

        if (!Object.prototype.hasOwnProperty.call(states, stateName)) {
          states[stateName] = {};
        }

        states[stateName][currentSymbol] = {
          symbol: nextSymbol,
          movement: (['L', 'R'].indexOf(nextMovement) >= 0 ? nextMovement as 'L' | 'R' : 'S'),
          state: nextStateName,
        };
      }

      return states;
    }

    const [machine, machineInitialState] = buildMachine({
      alphabetString: '_01XY#',
      initialState: 'Q8',
      finalStateList: ['Q5'],
      states: parse(`
        (Q8,#)->(Q6,#,R);
        (Q6,0)->(Q0,X,R);
        (Q0,0)->(Q0,0,R);
        (Q6,1)->(Q1,Y,R);
        (Q1,0)->(Q1,0,R);
        (Q0,1)->(Q0,1,R);
        (Q0,#)->(Q0,#,R);
        (Q0,_)->(Q7,0,L);
        (Q1,1)->(Q1,1,R);
        (Q1,#)->(Q1,#,R);
        (Q1,_)->(Q7,1,L);
        (Q7,0)->(Q7,0,L);
        (Q7,1)->(Q7,1,L);
        (Q7,#)->(Q7,#,L);
        (Q7,X)->(Q6,X,R);
        (Q7,Y)->(Q6,Y,R);
        (Q6,#)->(Q2,#,R);
        (Q2,0)->(Q2,0,R);
        (Q2,1)->(Q2,1,R);
        (Q2,_)->(Q3,#,L);
        (Q3,0)->(Q3,0,L);
        (Q3,1)->(Q3,1,L);
        (Q3,#)->(Q4,#,L);
        (Q4,X)->(Q4,0,L);
        (Q4,Y)->(Q4,1,L);
        (Q4,#)->(Q5,#,R);
      `),
    });

    machine.tapeBlock.replaceTape(new Tape({
      alphabet: machine.tapeBlock.alphabets[0],
      symbols: '#011#'.split(''),
    }));

    expect(machine.tapeBlock.tapes[0].symbols)
      .toEqual('#011#'.split(''));

    machine.run({
      initialState: machineInitialState,
      stepsLimit: 100,
    });

    expect(machine.tapeBlock.tapes[0].symbols)
      .toEqual('#011#011#'.split(''));
  });
});

describe('buildMachine — debug config (#101)', () => {
  afterEach(() => { haltState.debug = null; });

  // Compact two-symbol machine used by the debug-config tests:
  //   Q0: on 'A' write A move R stay-in-Q0; on 'B' write B move R go halt.
  // Configurable tape lets each test exercise a different trajectory.
  const buildLoopMachine = (debug?: Parameters<typeof buildMachine>[0]['debug']) => {
    const result = buildMachine({
      alphabetString: '_AB',
      initialState: 'Q0',
      finalStateList: ['Qf'],
      states: {
        Q0: {
          A: {symbol: 'A', movement: 'R', state: 'Q0'},
          B: {symbol: 'B', movement: 'R', state: 'Qf'},
        },
      },
      debug,
    });

    return result;
  };

  test('debug.before = true (wildcard) sets state.debug.before on the named state', () => {
    const [, , states] = buildLoopMachine({Q0: {before: true}});
    expect(states.Q0.debug?.before).toBe(true);
  });

  test('debug.before symbol-list fires onPause only for matching symbols', async () => {
    const [machine, init] = buildLoopMachine({Q0: {before: ['A']}});
    machine.tapeBlock.replaceTape(new Tape({
      alphabet: machine.tapeBlock.alphabets[0],
      symbols: ['A', 'A', 'B'],
    }));

    const pausedSymbols: string[] = [];
    const session = new DebugSession(machine, {initialState: init});
    session.on('pause', (m) => {
      pausedSymbols.push(m.currentSymbols[0]);
      session.continue();
    });
    await session.start();

    // Trajectory: A (pause) → A (pause) → B (no pause; B not in filter) → halt.
    expect(pausedSymbols).toEqual(['A', 'A']);
  });

  test('debug.after symbol-list fires on the halting iter\'s own yield', async () => {
    // 'B' triggers the halting transition; the after-fire for B reaches
    // onPause on B's own yield.
    const [machine, init] = buildLoopMachine({Q0: {after: ['B']}});
    machine.tapeBlock.replaceTape(new Tape({
      alphabet: machine.tapeBlock.alphabets[0],
      symbols: ['B'],
    }));

    let afterCount = 0;
    const session = new DebugSession(machine, {initialState: init});
    session.on('pause', (m) => {
      if (m.pause.side === 'after') afterCount += 1;
      session.continue();
    });
    await session.start();

    expect(afterCount).toBe(1);
  });

  test('debug accepts both before and after on the same state', async () => {
    const [machine, init] = buildLoopMachine({Q0: {before: true, after: true}});
    // Tape needs to terminate via a 'B' transition (which goes to halt) —
    // Q0 has no blank-handling transition, so a tape that runs into blanks
    // throws "No command for symbol".
    machine.tapeBlock.replaceTape(new Tape({
      alphabet: machine.tapeBlock.alphabets[0],
      symbols: ['A', 'B'],
    }));

    let beforeCount = 0;
    let afterCount = 0;
    const session = new DebugSession(machine, {initialState: init});
    session.on('pause', (m) => {
      if (m.pause.side === 'before') beforeCount += 1;
      if (m.pause.side === 'after') afterCount += 1;
      session.continue();
    });
    await session.start();

    expect(beforeCount).toBeGreaterThan(0);
    expect(afterCount).toBeGreaterThan(0);
  });

  test('throws when debug references an unknown state name', () => {
    expect(() => buildLoopMachine({Qx: {before: true}})).toThrow(/unknown state/);
  });

  test('throws when debug references a final-state name (out of scope per #101)', () => {
    expect(() => buildLoopMachine({Qf: {before: true}})).toThrow(/final state/);
  });

  test('throws when a debug filter symbol is not in the alphabet', () => {
    expect(() => buildLoopMachine({Q0: {before: ['Z']}})).toThrow(/not in the alphabet/);
  });
});

// Pin the example shown in packages/builder/README.md so the docs stay in
// lockstep with real engine behavior. If a future refactor changes the
// example's output, the test fails and someone must update both.
describe('README example: bit-flipper', () => {
  test('flips every bit of "0101" to "1010" and halts on the trailing blank', async () => {
    const [machine, initialState] = buildMachine({
      alphabetString: ' 01',
      initialState: 'flip',
      finalStateList: ['DONE'],
      states: {
        flip: {
          '0': {state: 'flip', symbol: '1', movement: 'R'},
          '1': {state: 'flip', symbol: '0', movement: 'R'},
          ' ': {state: 'DONE', symbol: ' ', movement: 'S'},
        },
      },
    });

    machine.tapeBlock.replaceTape(new Tape({
      alphabet: machine.tapeBlock.alphabets[0],
      symbols: '0101'.split(''),
    }));

    await machine.run({initialState, stepsLimit: 100});

    expect(machine.tapeBlock.tapes[0].symbols.join('').trim()).toBe('1010');
  });
});
