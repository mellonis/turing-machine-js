import {
  Alphabet,
  haltState,
  movements,
  State,
  symbolCommands,
  TapeBlock,
} from '@turing-machine-js/machine';

// 3-symbol alphabet: blank (' '), '0', '1'.
// A number is a contiguous run of '0'/'1' cells; blanks surround it on both sides.
// All algorithms below assume the head starts at the leftmost digit of the number.
//
// Compared with @turing-machine-js/library-binary-numbers (which uses ' ^$01' and
// supports multi-number tapes), this library has only single-number arithmetic but
// each algorithm is much smaller in state count — see ../states.md for the diagrams.

const alphabet = new Alphabet([' ', '0', '1']);
const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
const {symbol} = tapeBlock;

// plusOne — 3 nodes (vs 5 in the marker-based library)
//
// Walk to the trailing blank, step back to the LSB, then carry from the LSB:
//   1 → 0 (carry continues left)
//   0 → 1, halt (carry consumed)
//   blank → 1, halt (overflow extends the number leftward)
const plusOneCarry = new State({
  [symbol('1')]: {
    command: {
      symbol: '0',
      movement: movements.left,
    },
  },
  [symbol('0')]: {
    command: {
      symbol: '1',
    },
    nextState: haltState,
  },
  [symbol(alphabet.blankSymbol)]: {
    command: {
      symbol: '1',
    },
    nextState: haltState,
  },
}, 'plusOneCarry');

const plusOne = new State({
  [symbol('01')]: {
    command: {
      movement: movements.right,
    },
  },
  [symbol(alphabet.blankSymbol)]: {
    command: {
      movement: movements.left,
    },
    nextState: plusOneCarry,
  },
}, 'plusOne');

// minusOne — 3 nodes (vs 17 / 10 in the marker-based library)
//
// Walk to the trailing blank, step back to the LSB, then borrow from the LSB:
//   0 → 1 (borrow continues left)
//   1 → 0, halt (borrow consumed)
//   blank → halt (underflow — input was zero or empty)
const minusOneBorrow = new State({
  [symbol('0')]: {
    command: {
      symbol: '1',
      movement: movements.left,
    },
  },
  [symbol('1')]: {
    command: {
      symbol: '0',
    },
    nextState: haltState,
  },
  [symbol(alphabet.blankSymbol)]: {
    nextState: haltState,
  },
}, 'minusOneBorrow');

const minusOne = new State({
  [symbol('01')]: {
    command: {
      movement: movements.right,
    },
  },
  [symbol(alphabet.blankSymbol)]: {
    command: {
      movement: movements.left,
    },
    nextState: minusOneBorrow,
  },
}, 'minusOne');

// invertNumber — 2 nodes (vs 5)
//
// Sweep right, flipping each bit; halt at the trailing blank.
const invertNumber = new State({
  [symbol('0')]: {
    command: {
      symbol: '1',
      movement: movements.right,
    },
  },
  [symbol('1')]: {
    command: {
      symbol: '0',
      movement: movements.right,
    },
  },
  [symbol(alphabet.blankSymbol)]: {
    nextState: haltState,
  },
}, 'invertNumber');

// normalizeNumber — 2 nodes (vs 7)
//
// Erase leading zeros until we hit a '1'. If the entire number was zeros, restore
// a single '0' so 0 keeps its representation.
const normalizeNumber = new State({
  [symbol('0')]: {
    command: {
      symbol: symbolCommands.erase,
      movement: movements.right,
    },
  },
  [symbol('1')]: {
    nextState: haltState,
  },
  [symbol(alphabet.blankSymbol)]: {
    command: {
      symbol: '0',
    },
    nextState: haltState,
  },
}, 'normalizeNumber');

function getTapeBlock() {
  return tapeBlock.clone();
}

export default {
  getTapeBlock,
  states: {
    plusOne,
    minusOne,
    invertNumber,
    normalizeNumber,
  },
};
