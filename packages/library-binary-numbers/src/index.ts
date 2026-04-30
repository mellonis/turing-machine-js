import {
  Alphabet,
  haltState,
  ifOtherSymbol,
  movements,
  State,
  symbolCommands,
  TapeBlock,
} from '@turing-machine-js/machine';

// 5-symbol alphabet: blank (' '), '^' (number start), '$' (number end), '0', '1'.
// A tape can hold many numbers, each delimited by '^...$', with blanks between.
//
// Compared with @turing-machine-js/library-binary-numbers-bare (3-symbol alphabet,
// single-number-per-tape), the explicit '^'/'$' markers cost extra states per
// algorithm but enable safe multi-number navigation (goToNumber / goToNextNumber /
// goToPreviousNumber). Both libraries exist side-by-side so the trade-off between
// alphabet size and state-graph size is visible — see ../states.md for diagrams.

const alphabet = new Alphabet(' ^$01'.split(''));
const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
const {symbol} = tapeBlock;

// goToNumber — 2 nodes
//
// Walks the head right until '$'. Used as a "go to current number's end" primitive.
const goToNumber = new State({
  [symbol('$')]: {
    nextState: haltState,
  },
  [ifOtherSymbol]: {
    command: {
      movement: movements.right,
    },
  },
}, 'goToNumber');

// goToNextNumber — 3 nodes (composes goToNumber)
//
// Steps right one cell (out of the current '$' / blank gap), then hands off to
// goToNumber to land on the next number's '$'.
const goToNextNumber = new State({
  [ifOtherSymbol]: {
    command: {
      movement: movements.right,
    },
    nextState: goToNumber,
  },
}, 'goToNextNumber');

// goToPreviousNumber — 3 nodes (uses an internal mirror of goToNumber)
//
// Steps left one cell, then walks left until '$' of the previous number.
const goToPreviousNumberInternal = new State({
  [symbol('$')]: {
    nextState: haltState,
  },
  [ifOtherSymbol]: {
    command: {
      movement: movements.left,
    },
  },
}, 'goToPreviousNumberInternal');

const goToPreviousNumber = new State({
  [ifOtherSymbol]: {
    command: {
      movement: movements.left,
    },
    nextState: goToPreviousNumberInternal,
  },
}, 'goToPreviousNumber');

// goToNumbersStart — 2 nodes
//
// Walks the head left until '^'. Mirror of goToNumber for the start marker.
const goToNumbersStart = new State({
  [symbol('^')]: {
    nextState: haltState,
  },
  [ifOtherSymbol]: {
    command: {
      movement: movements.left,
    },
  },
}, 'goToNumberStart');

// deleteNumber — 5 nodes
//
// Composition: go to the number's '^', then sweep right erasing every cell
// (digits, '^', '$') until the number is gone. Implemented as
// goToNumbersStart.withOverrodeHaltState(deleteNumberInternal): when
// goToNumbersStart would halt at '^', it falls through to the eraser instead.
const deleteNumberInternal = new State({
  [symbol('$')]: {
    command: {
      symbol: symbolCommands.erase,
    },
    nextState: haltState,
  },
  [ifOtherSymbol]: {
    command: {
      symbol: symbolCommands.erase,
      movement: movements.right,
    },
  },
}, 'deleteNumberInternal');

const deleteNumber = new State({
  [symbol('^10$')]: {
    nextState: goToNumbersStart.withOverrodeHaltState(deleteNumberInternal),
  },
  [ifOtherSymbol]: {
    nextState: haltState,
  },
}, 'deleteNumber');

// invertNumber — 5 nodes
//
// Composition: go to '^', then sweep right flipping each bit until '$'.
// Same shape as deleteNumber (goToNumbersStart.withOverrodeHaltState(...)) but
// the inner state writes the complement instead of erasing.
const invertNumberGoToNumberWithInversion = new State({
  [symbol('^')]: {
    command: {
      movement: movements.right,
    },
  },
  [symbol('1')]: {
    command: {
      symbol: '0',
      movement: movements.right,
    },
  },
  [symbol('0')]: {
    command: {
      symbol: '1',
      movement: movements.right,
    },
  },
  [symbol('$')]: {
    nextState: haltState,
  },
}, 'invertNumberGoToNumberWithInversion');

const invertNumber = new State({
  [symbol('^10$')]: {
    nextState: goToNumbersStart.withOverrodeHaltState(invertNumberGoToNumberWithInversion),
  },
  [ifOtherSymbol]: {
    nextState: haltState,
  },
}, 'invertNumber');

// normalizeNumber — 7 nodes
//
// Strips leading zeros by erasing them and re-planting '^' just before the first
// '1' (or before '$' if the entire number was zero — preserving "0" as "^$").
// Composition: go to '^', then move-start sweeps right erasing '^' and leading
// '0's; on first '1' or '$' it backs up one cell and writes a fresh '^' there.
const normalizeNumberPutNewStartSymbol = new State({
  [symbol(alphabet.blankSymbol)]: {
    command: {
      symbol: '^',
    },
    nextState: goToNumber,
  },
}, 'normalizeNumberPutNewStartSymbol');

const normalizeNumberMoveNumberStart = new State({
  [symbol('^0')]: {
    command: {
      symbol: symbolCommands.erase,
      movement: movements.right,
    },
  },
  [symbol('1$')]: {
    command: {
      movement: movements.left,
    },
    nextState: normalizeNumberPutNewStartSymbol,
  },
}, 'normalizeNumberMoveNumberStart');

const normalizeNumber = new State({
  [symbol('^10$')]: {
    nextState: goToNumbersStart.withOverrodeHaltState(normalizeNumberMoveNumberStart),
  },
  [ifOtherSymbol]: {
    nextState: haltState,
  },
}, 'normalizeNumber');

// plusOne — 5 nodes
//
// Walk to '$', step left into the LSB, then carry from the LSB:
//   1 → 0 (carry continues left)
//   0 → 1, then fill any 1s to the right with 0s (already done by the chain) and halt at '$'
//   ^ → 1 (carry overflows the MSB) — write 1, step into the new blank cell on the
//     left, plant a fresh '^' there, then sweep right turning the old leading 1s
//     into 0s. This is what plusOneAddNumberStart and plusOneFillZeros handle.
//
// The bare-alphabet variant in @turing-machine-js/library-binary-numbers-bare
// drops to 3 nodes for the same operation by skipping the '^' relocation.
const plusOneFillZeros = new State({
  [symbol('1')]: {
    command: {
      symbol: '0',
      movement: movements.right,
    },
  },
  [symbol('$')]: {
    nextState: haltState,
  },
}, 'plusOneFillZeros');

const plusOneAddNumberStart = new State({
  [symbol(alphabet.blankSymbol)]: {
    command: {
      symbol: '^',
      movement: movements.right,
    },
  },
  [symbol('1')]: {
    command: {
      movement: movements.right,
    },
    nextState: plusOneFillZeros,
  },
}, 'plusOneAddNumberStart');

const plusOneCaryOne = new State({
  [symbol('0')]: {
    command: {
      symbol: '1',
      movement: movements.right,
    },
    nextState: plusOneFillZeros,
  },
  [symbol('1')]: {
    command: {
      movement: movements.left,
    },
  },
  [symbol('^')]: {
    command: {
      symbol: '1',
      movement: movements.left,
    },
    nextState: plusOneAddNumberStart,
  },
}, 'plusOneCaryOne');

const plusOne = new State({
  [symbol('^10')]: {
    command: {
      movement: movements.right,
    },
  },
  [symbol('$')]: {
    command: {
      movement: movements.left,
    },
    nextState: plusOneCaryOne,
  },
  [ifOtherSymbol]: {
    nextState: haltState,
  },
}, 'plusOne');

// minusOne — 17 nodes (the largest in this library)
//
// Computes x − 1 via the two's-complement identity:  x − 1 == ~(~x + 1)
// (every step is a state we already have), composed with three nested
// withOverrodeHaltState calls to chain invert → plusOne → invert → normalize.
//
// This is *deliberately* the heavy version. It exists side-by-side with
// minusOneFast (10 nodes, direct borrow) to make the cost of "compose existing
// pieces" vs "write a dedicated algorithm" visible. See ../states.md for the
// dotted onHalt edges that show the four-deep subroutine chain.
const minusOne = new State({
  [symbol('^10')]: {
    command: {
      movement: movements.right,
    },
  },
  [symbol('$')]: {
    nextState: invertNumber
      .withOverrodeHaltState(
        plusOne
          .withOverrodeHaltState(
            invertNumber
              .withOverrodeHaltState(normalizeNumber),
          ),
      ),
  },
  [ifOtherSymbol]: {
    nextState: haltState,
  },
}, 'minusOne');

// minusOneFast — 10 nodes (direct borrow propagation)
//
// Walks left from the LSB: 0→1 keeps borrowing; 1→0 stops; ^ is underflow.
// Falls through to normalizeNumber to strip the leading zero introduced when the
// borrow chain reaches the MSB (e.g. ^1000$ - 1 = ^0111$ → ^111$).
//
// Same algorithm as minusOne in @turing-machine-js/library-binary-numbers-bare
// (which is 3 nodes there). The extra 7 nodes here are the cost of: scanning
// past '^' on entry, the goToNumberStart path and its withOverrodeHaltState
// wrapper for normalize, and normalizeNumber's own marker-relocation chain.
const minusOneFastBorrow = new State({
  [symbol('1')]: {
    command: {
      symbol: '0',
    },
    nextState: haltState,
  },
  [symbol('0')]: {
    command: {
      symbol: '1',
      movement: movements.left,
    },
  },
  [symbol('^')]: {
    nextState: haltState,
  },
}, 'minusOneFastBorrow');

const minusOneFast = new State({
  [symbol('^10')]: {
    command: {
      movement: movements.right,
    },
  },
  [symbol('$')]: {
    command: {
      movement: movements.left,
    },
    nextState: minusOneFastBorrow.withOverrodeHaltState(normalizeNumber),
  },
  [ifOtherSymbol]: {
    nextState: haltState,
  },
}, 'minusOneFast');

function getTapeBlock() {
  return tapeBlock.clone();
}

export default {
  getTapeBlock,
  states: {
    goToNumber,
    goToNextNumber,
    goToPreviousNumber,
    deleteNumber,
    goToNumbersStart,
    invertNumber,
    normalizeNumber,
    plusOne,
    minusOne,
    minusOneFast,
  },
};
