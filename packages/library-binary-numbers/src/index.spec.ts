import {State, Tape, TapeBlock, TuringMachine} from '@turing-machine-js/machine';
import binaryNumbers from './index';

const ALPHABET = ' ^$01';
const STATE_NAMES: (keyof typeof binaryNumbers['states'])[] = [
  'goToNumber',
  'goToNextNumber',
  'goToPreviousNumber',
  'deleteNumber',
  'goToNumbersStart',
  'invertNumber',
  'normalizeNumber',
  'plusOne',
  'minusOne',
  'minusOneFast',
];

// Fresh machine + tape per test. The previous shape constructed `tapeBlock`
// and `machine` once at `describe` body level and reused them via
// `tapeBlock.replaceTape(tape)`; tape head position and the engine's tape lock
// would leak across tests in subtle ways. Every test now starts from a clean
// fixture.
function setup(symbols: string, position?: number) {
  const tapeBlock = binaryNumbers.getTapeBlock();
  const machine = new TuringMachine({tapeBlock});
  const tape = new Tape({
    alphabet: tapeBlock.tapes[0].alphabet,
    symbols: symbols.split(''),
    ...(position !== undefined ? {position} : {}),
  });
  tapeBlock.replaceTape(tape);

  return {machine, tape};
}

// Strip leading/trailing blanks so the algorithm's logical output (number
// markers and digits) can be compared without caring about tape padding.
const trimmed = (tape: Tape) => tape.symbols.join('').trim();

describe('public surface', () => {
  test('getTapeBlock returns a fresh TapeBlock with the documented alphabet', () => {
    const block = binaryNumbers.getTapeBlock();

    expect(block).toBeInstanceOf(TapeBlock);
    expect(block.tapes[0].alphabet.symbols).toEqual(ALPHABET.split(''));
  });

  test('getTapeBlock returns a new instance on each call (no shared state)', () => {
    expect(binaryNumbers.getTapeBlock()).not.toBe(binaryNumbers.getTapeBlock());
  });

  test('every advertised state is a State instance', () => {
    for (const name of STATE_NAMES) {
      expect(binaryNumbers.states[name]).toBeInstanceOf(State);
    }
  });
});

describe('goToNumber — walk right to the first $', () => {
  // [initial tape, start position, expected halt position]
  const cases: Array<[string, number, number]> = [
    ['$', 0, 0], // already at $
    ['1$', 0, 1], // step over one digit
    ['111$', 0, 3], // step over three digits
    ['^11$', 0, 3], // step over the start marker too
    ['1$10$', 0, 1], // multi-number: stop at FIRST $, not the second
  ];

  test.each(cases)('start [%s] @ %d → halt @ %d on $', (symbols, start, expectedPos) => {
    const {machine, tape} = setup(symbols, start);

    machine.run({initialState: binaryNumbers.states.goToNumber});

    expect(tape.symbol).toBe('$');
    expect(tape.position).toBe(expectedPos);
    // Read-only walk — tape symbols unchanged.
    expect(trimmed(tape)).toBe(symbols);
  });
});

describe('goToNumbersStart — walk left to the first ^', () => {
  // Start position is the rightmost cell (after the trailing $).
  const cases: Array<[string, number]> = [
    ['^$', 0],
    ['^1$', 0],
    ['^11$', 0],
    ['^1$ ^0$', 4], // multi-number: stop at THIS number's ^, not the previous one
  ];

  test.each(cases)('start [%s] from end → halt @ %d on ^', (symbols, expectedPos) => {
    const {machine, tape} = setup(symbols, symbols.length - 1);

    machine.run({initialState: binaryNumbers.states.goToNumbersStart});

    expect(tape.symbol).toBe('^');
    expect(tape.position).toBe(expectedPos);
    expect(trimmed(tape)).toBe(symbols);
  });
});

describe('goToNextNumber — step right then walk to the following $', () => {
  // Tape with two numbers; head starts at the first number's $.
  test('multi-number tape: lands on the second number\'s $', () => {
    const {machine, tape} = setup('^1$ ^10$', 2);

    machine.run({initialState: binaryNumbers.states.goToNextNumber});

    expect(tape.symbol).toBe('$');
    expect(tape.position).toBe(7);
  });
});

describe('goToPreviousNumber — step left then walk back to the previous $', () => {
  test('multi-number tape: lands on the first number\'s $', () => {
    const {machine, tape} = setup('^1$ ^10$', 7);

    machine.run({initialState: binaryNumbers.states.goToPreviousNumber});

    expect(tape.symbol).toBe('$');
    expect(tape.position).toBe(2);
  });
});

describe('deleteNumber — erase ^...$ in place', () => {
  // [initial tape] — head starts at position 0 on the ^ so the
  // goToNumbersStart-wrapped path picks up the deletion subroutine.
  const cases: string[] = ['^$', '^1$', '^0$', '^11$', '^00$'];

  test.each(cases)('start [%s] → fully erased', (symbols) => {
    const {machine, tape} = setup(symbols);

    machine.run({initialState: binaryNumbers.states.deleteNumber});

    // Every cell that was previously a marker or digit is now blank.
    expect(trimmed(tape)).toBe('');
    // Head halts on the cell where the trailing $ used to be.
    expect(tape.symbol).toBe(tape.alphabet.blankSymbol);
    expect(tape.position).toBe(symbols.length - 1);
  });

  test('no-op halt: head not on a number marker leaves the tape untouched', () => {
    // Source has [ifOtherSymbol]: {nextState: haltState} for symbols outside ^10$.
    // Blank in cell 0 hits that branch — the deletion subroutine is never entered.
    const {machine, tape} = setup(' ^1$', 0);

    machine.run({initialState: binaryNumbers.states.deleteNumber});

    expect(trimmed(tape)).toBe('^1$');
    expect(tape.position).toBe(0);
  });
});

describe('normalizeNumber — strip leading zeros, preserve "0" as ^$', () => {
  // [initial, expected]
  const cases: Array<[string, string]> = [
    ['^$', '^$'],
    ['^1$', '^1$'],
    ['^01$', '^1$'],
    ['^101$', '^101$'],
    ['^0101$', '^101$'],
    ['^00$', '^$'], // all zeros normalize to ^$ (representing 0)
  ];

  test.each(cases)('start [%s] → [%s]', (start, expected) => {
    const {machine, tape} = setup(start);

    machine.run({initialState: binaryNumbers.states.normalizeNumber});

    expect(trimmed(tape)).toBe(expected);
  });

  test('no-op halt: head off-marker leaves the tape untouched', () => {
    const {machine, tape} = setup(' ^01$', 0);

    machine.run({initialState: binaryNumbers.states.normalizeNumber});

    expect(trimmed(tape)).toBe('^01$');
  });
});

describe('invertNumber — flip every bit between ^ and $', () => {
  // [initial, expected]
  const cases: Array<[string, string]> = [
    ['^$', '^$'], // empty number is its own inverse
    ['^1$', '^0$'],
    ['^0$', '^1$'],
    ['^11$', '^00$'],
    ['^00$', '^11$'],
    ['^101$', '^010$'],
    ['^010$', '^101$'],
  ];

  test.each(cases)('start [%s] → [%s]', (start, expected) => {
    const {machine, tape} = setup(start);

    machine.run({initialState: binaryNumbers.states.invertNumber});

    expect(trimmed(tape)).toBe(expected);
  });

  test('no-op halt: head off-marker leaves the tape untouched', () => {
    const {machine, tape} = setup(' ^1$', 0);

    machine.run({initialState: binaryNumbers.states.invertNumber});

    expect(trimmed(tape)).toBe('^1$');
  });
});

describe('plusOne — add 1, growing the number when carry overflows', () => {
  // [initial, expected]
  const cases: Array<[string, string]> = [
    ['^$', '^1$'], // empty + 1 = 1
    ['^1$', '^10$'],
    ['^10$', '^11$'],
    ['^101$', '^110$'],
    ['^110$', '^111$'],
    ['^111$', '^1000$'], // overflow: ^ relocates one cell left
  ];

  test.each(cases)('start [%s] → [%s]', (start, expected) => {
    const {machine, tape} = setup(start);

    machine.run({initialState: binaryNumbers.states.plusOne});

    expect(trimmed(tape)).toBe(expected);
  });

  test('no-op halt: head off-marker leaves the tape untouched', () => {
    const {machine, tape} = setup(' ^1$', 0);

    machine.run({initialState: binaryNumbers.states.plusOne});

    expect(trimmed(tape)).toBe('^1$');
  });
});

// Both subtractors are tested against the same input/output pairs (they should
// be observationally equivalent on positive inputs). The pairs are written
// "result, input" so the output sits where you'd read it after subtracting.
const subtractorCases: Array<[string, string]> = [
  ['^$', '^1$'], // 1 - 1 = 0 → ^$
  ['^1$', '^10$'],
  ['^10$', '^11$'],
  ['^101$', '^110$'],
  ['^110$', '^111$'],
  ['^111$', '^1000$'],
];

describe('minusOne — subtract 1 via the ~(~x + 1) composition', () => {
  test.each(subtractorCases)('input [%s] becomes [%s]', (expected, start) => {
    const {machine, tape} = setup(start);

    machine.run({initialState: binaryNumbers.states.minusOne});

    expect(trimmed(tape)).toBe(expected);
  });

  test('no-op halt: head off-marker leaves the tape untouched', () => {
    const {machine, tape} = setup(' ^1$', 0);

    machine.run({initialState: binaryNumbers.states.minusOne});

    expect(trimmed(tape)).toBe('^1$');
  });
});

describe('minusOneFast — subtract 1 via direct borrow', () => {
  test.each(subtractorCases)('input [%s] becomes [%s]', (expected, start) => {
    const {machine, tape} = setup(start);

    machine.run({initialState: binaryNumbers.states.minusOneFast});

    expect(trimmed(tape)).toBe(expected);
  });

  test('input ^$ stays ^$ (zero stays zero)', () => {
    const {machine, tape} = setup('^$');

    machine.run({initialState: binaryNumbers.states.minusOneFast});

    expect(trimmed(tape)).toBe('^$');
  });

  test('no-op halt: head off-marker leaves the tape untouched', () => {
    const {machine, tape} = setup(' ^1$', 0);

    machine.run({initialState: binaryNumbers.states.minusOneFast});

    expect(trimmed(tape)).toBe('^1$');
  });
});

// Pin the example shown in packages/library-binary-numbers/README.md.
// Mirrors the README's code byte-for-byte to ensure the docs example
// stays accurate.
describe('README example: plusOne on ^101$', () => {
  test('produces ^110$ (binary 5 → 6)', async () => {
    const tapeBlock = binaryNumbers.getTapeBlock();
    const tape = new Tape({
      alphabet: tapeBlock.alphabets[0],
      symbols: '^101$'.split(''),
    });

    tapeBlock.replaceTape(tape);

    const machine = new TuringMachine({tapeBlock});

    await machine.run({initialState: binaryNumbers.states.plusOne});

    expect(tape.symbols.join('').trim()).toBe('^110$');
  });
});
