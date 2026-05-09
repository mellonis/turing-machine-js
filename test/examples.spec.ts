import {
  Alphabet,
  haltState,
  ifOtherSymbol,
  movements,
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

  test('Pause before applying any of myState commands (wildcard)', async () => {
    const {machine, myState} = buildExampleMachine();
    myState.debug = {before: true};
    let breakCount = 0;
    await machine.run({initialState: myState, onPause: () => { breakCount += 1; }});
    expect(breakCount).toBeGreaterThan(0);
  });

  test('Pause only when head shows symA', async () => {
    const {machine, myState, symA} = buildExampleMachine();
    myState.debug = {before: [symA]};
    let symASeen = 0;
    await machine.run({
      initialState: myState,
      onPause: (m) => { if (m.currentSymbols[0] === 'A') symASeen += 1; },
    });
    expect(symASeen).toBeGreaterThan(0);
  });

  test('Before AND after for same symbol → two pauses per visit', async () => {
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
    expect(order).toContain('before');
    expect(order).toContain('after');
  });

  test('haltState.debug.before pauses on halt entry', async () => {
    const {machine, myState} = buildExampleMachine();
    haltState.debug = {before: true};
    let haltPause = false;
    await machine.run({
      initialState: myState,
      onPause: (m) => {
        if (m.nextState === haltState && m.debugBreak?.before) haltPause = true;
      },
    });
    expect(haltPause).toBe(true);
  });

  test('Disable later by assigning null', () => {
    const {myState} = buildExampleMachine();
    myState.debug = {before: true};
    expect(myState.debug).not.toBeNull();
    myState.debug = null;
    expect(myState.debug).toBeNull();
  });

  test('Incremental update via per-property setter', () => {
    const {myState, symA} = buildExampleMachine();
    myState.debug = {before: [symA]};
    myState.debug!.before = [...(myState.debug!.before as readonly symbol[]), ifOtherSymbol];
    expect(myState.debug!.before).toEqual([symA, ifOtherSymbol]);
  });

  test('onStep + onPause fire independently', async () => {
    const {machine, myState} = buildExampleMachine();
    myState.debug = {before: true};
    let stepCount = 0;
    let breakCount = 0;
    await machine.run({
      initialState: myState,
      onStep: () => { stepCount += 1; },
      onPause: () => { breakCount += 1; },
    });
    expect(stepCount).toBeGreaterThan(0);
    expect(breakCount).toBeGreaterThan(0);
  });
});
