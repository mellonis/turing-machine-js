import {
  Alphabet,
  State,
  TapeBlock,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet({
  symbolList: ' ^$01'.split(''),
});
const tapeBlock = new TapeBlock({
  alphabetList: [alphabet],
});
const { symbol } = tapeBlock;

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

const goToNextNumber = new State({
  [ifOtherSymbol]: {
    command: {
      movement: movements.right,
    },
    nextState: goToNumber,
  },
}, 'goToNextNumber');

const goToPreviousNumberTrue = new State({
  [symbol('$')]: {
    nextState: haltState,
  },
  [ifOtherSymbol]: {
    command: {
      movement: movements.left,
    },
  },
}, 'goToPreviousNumberTrue');

const goToPreviousNumber = new State({
  [ifOtherSymbol]: {
    command: {
      movement: movements.left,
    },
    nextState: goToPreviousNumberTrue,
  },
}, 'goToPreviousNumber');

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

const deleteNumberTrue = new State({
  [symbol('$')]: {
    command: {
      symbol: symbolCommands.erase,
    },
    nextState: haltState,
  },
  [ifOtherSymbol]: {
    command: {
      symbol: symbolCommands.erase,
    },
    movement: movements.right,
  },
}, 'deleteNumberTrue');

const deleteNumber = new State({
  [symbol('^10$')]: {
    nextState: goToNumbersStart.withOverrodeHaltState(deleteNumberTrue),
  },
  [ifOtherSymbol]: {
    nextState: haltState,
  },
}, 'deleteNumber');

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

export default {
  tapeBlock,
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
  },
};
