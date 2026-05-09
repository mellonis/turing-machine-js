import {State, Tape, TapeBlock, TuringMachine} from '@turing-machine-js/machine';
import binaryNumbersBare from './index';

const stateNames: (keyof typeof binaryNumbersBare['states'])[] = [
  'plusOne',
  'minusOne',
  'invertNumber',
  'normalizeNumber',
];

describe('general tests', () => {
  test('has getTapeBlock', () => {
    expect(binaryNumbersBare.getTapeBlock).toBeTruthy();
    expect(binaryNumbersBare.getTapeBlock() instanceof TapeBlock).toBe(true);

    const {alphabet} = binaryNumbersBare.getTapeBlock().tapes[0];

    expect(alphabet.symbols.length).toBe(3);
    [' ', '0', '1'].forEach((s) => {
      expect(alphabet.has(s)).toBe(true);
    });
  });

  test('has all declared states', () => {
    expect(stateNames.every((name) => binaryNumbersBare.states[name] instanceof State)).toBe(true);
  });
});

function runOnInput(stateName: keyof typeof binaryNumbersBare['states'], input: string): string {
  const tapeBlock = binaryNumbersBare.getTapeBlock();
  const tape = new Tape({
    alphabet: tapeBlock.tapes[0].alphabet,
    symbols: input.split(''),
  });

  tapeBlock.replaceTape(tape);

  const machine = new TuringMachine({tapeBlock});

  machine.run({initialState: binaryNumbersBare.states[stateName]});

  return tape.symbols.join('').trim();
}

describe('plusOne', () => {
  test.each([
    ['', '1'],     // empty/zero → 1
    ['0', '1'],
    ['1', '10'],
    ['10', '11'],
    ['11', '100'],
    ['101', '110'],
    ['110', '111'],
    ['111', '1000'],
  ])('plusOne(%s) = %s', (input, expected) => {
    expect(runOnInput('plusOne', input)).toBe(expected);
  });
});

describe('minusOne', () => {
  test.each([
    ['1', '0'],
    ['10', '01'],     // leading zero kept (no auto-normalize); value = 1
    ['11', '10'],
    ['101', '100'],
    ['110', '101'],
    ['111', '110'],
    ['1000', '0111'], // leading zero kept; value = 7
  ])('minusOne(%s) = %s', (input, expected) => {
    expect(runOnInput('minusOne', input)).toBe(expected);
  });
});

describe('invertNumber', () => {
  test.each([
    ['0', '1'],
    ['1', '0'],
    ['00', '11'],
    ['11', '00'],
    ['01', '10'],
    ['10', '01'],
    ['101', '010'],
    ['1010', '0101'],
  ])('invertNumber(%s) = %s', (input, expected) => {
    expect(runOnInput('invertNumber', input)).toBe(expected);
  });
});

describe('normalizeNumber', () => {
  test.each([
    ['0', '0'],
    ['1', '1'],
    ['00', '0'],
    ['000', '0'],
    ['01', '1'],
    ['001', '1'],
    ['10', '10'],
    ['101', '101'],
    ['0101', '101'],
    ['00101', '101'],
  ])('normalizeNumber(%s) = %s', (input, expected) => {
    expect(runOnInput('normalizeNumber', input)).toBe(expected);
  });
});

describe('minusOne ∘ plusOne identity (within range)', () => {
  // For values that don't trip the normalize-needed leading-zero case:
  test.each(['1', '11', '101', '111', '1011'])('minusOne(plusOne(%s)) === %s', (input) => {
    const tapeBlock = binaryNumbersBare.getTapeBlock();
    const tape = new Tape({
      alphabet: tapeBlock.tapes[0].alphabet,
      symbols: input.split(''),
    });

    tapeBlock.replaceTape(tape);

    const machine = new TuringMachine({tapeBlock});

    machine.run({initialState: binaryNumbersBare.states.plusOne});
    machine.run({initialState: binaryNumbersBare.states.minusOne});

    expect(tape.symbols.join('').trim().replace(/^0+(?=.)/, '')).toBe(input);
  });
});

// Pin the example shown in packages/library-binary-numbers-bare/README.md.
// Mirrors the README's code byte-for-byte.
describe('README example: plusOne on 101', () => {
  test('produces 110 (binary 5 → 6)', async () => {
    const tapeBlock = binaryNumbersBare.getTapeBlock();
    const tape = new Tape({
      alphabet: tapeBlock.alphabets[0],
      symbols: '101'.split(''),
    });

    tapeBlock.replaceTape(tape);

    const machine = new TuringMachine({tapeBlock});

    await machine.run({initialState: binaryNumbersBare.states.plusOne});

    expect(tape.symbols.join('').trim()).toBe('110');
  });
});
