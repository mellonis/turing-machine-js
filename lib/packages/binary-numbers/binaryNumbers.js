import Alphabet from '../../classes/Alphabet';
import State, { haltState, ifOtherSymbol } from '../../classes/State';
import { movements, symbolCommands } from '../../classes/Command';
const alphabet = new Alphabet(' ^$01'.split(''));
const goToNumber = new State({
  $: {
    nextState: haltState
  },
  [ifOtherSymbol]: {
    movement: movements.right
  }
}, 'goToNumber');
const goToNextNumber = new State({
  [ifOtherSymbol]: {
    movement: movements.right,
    nextState: goToNumber
  }
}, 'goToNextNumber');
const goToPreviousNumberTrue = new State({
  $: {
    nextState: haltState
  },
  [ifOtherSymbol]: {
    movement: movements.left
  }
}, 'goToPreviousNumberTrue');
const goToPreviousNumber = new State({
  [ifOtherSymbol]: {
    movement: movements.left,
    nextState: goToPreviousNumberTrue
  }
}, 'goToPreviousNumber');
const goToNumbersStart = new State({
  '^': {
    nextState: haltState
  },
  [ifOtherSymbol]: {
    movement: movements.left
  }
}, 'goToNumberStart');
const deleteNumberTrue = new State({
  $: {
    symbol: symbolCommands.erase,
    nextState: haltState
  },
  [ifOtherSymbol]: {
    symbol: symbolCommands.erase,
    movement: movements.right
  }
}, 'deleteNumberTrue');
const deleteNumber = new State({
  '^10$': {
    nextState: goToNumbersStart.withOverrodeHaltState(deleteNumberTrue)
  },
  [ifOtherSymbol]: {
    nextState: haltState
  }
}, 'deleteNumber');
const invertNumberGoToNumberWithInversion = new State({
  '^': {
    movement: movements.right
  },
  1: {
    symbol: '0',
    movement: movements.right
  },
  0: {
    symbol: '1',
    movement: movements.right
  },
  $: {
    nextState: haltState
  }
}, 'invertNumberGoToNumberWithInversion');
const invertNumber = new State({
  '^10$': {
    nextState: goToNumbersStart.withOverrodeHaltState(invertNumberGoToNumberWithInversion)
  },
  [ifOtherSymbol]: {
    nextState: haltState
  }
}, 'invertNumber');
const normalizeNumberPutNewStartSymbol = new State({
  [alphabet.blankSymbol]: {
    symbol: '^',
    nextState: goToNumber
  }
}, 'normalizeNumberPutNewStartSymbol');
const normalizeNumberMoveNumberStart = new State({
  '^0': {
    symbol: symbolCommands.erase,
    movement: movements.right
  },
  '1$': {
    movement: movements.left,
    nextState: normalizeNumberPutNewStartSymbol
  }
}, 'normalizeNumberMoveNumberStart');
const normalizeNumber = new State({
  '^10$': {
    nextState: goToNumbersStart.withOverrodeHaltState(normalizeNumberMoveNumberStart)
  },
  [ifOtherSymbol]: {
    nextState: haltState
  }
}, 'normalizeNumber');
const plusOneFillZeros = new State({
  1: {
    symbol: '0',
    movement: movements.right
  },
  $: {
    nextState: haltState
  }
}, 'plusOneFillZeros');
const plusOneAddNumberStart = new State({
  [alphabet.blankSymbol]: {
    symbol: '^',
    movement: movements.right
  },
  1: {
    movement: movements.right,
    nextState: plusOneFillZeros
  }
}, 'plusOneAddNumberStart');
const plusOneCaryOne = new State({
  0: {
    symbol: '1',
    movement: movements.right,
    nextState: plusOneFillZeros
  },
  1: {
    movement: movements.left
  },
  '^': {
    symbol: '1',
    movement: movements.left,
    nextState: plusOneAddNumberStart
  }
}, 'plusOneCaryOne');
const plusOne = new State({
  '^10': {
    movement: movements.right
  },
  $: {
    movement: movements.left,
    nextState: plusOneCaryOne
  },
  [ifOtherSymbol]: {
    nextState: haltState
  }
}, 'plusOne');
const minusOne = new State({
  '^10': {
    movement: movements.right
  },
  $: {
    nextState: invertNumber.withOverrodeHaltState(plusOne.withOverrodeHaltState(invertNumber.withOverrodeHaltState(normalizeNumber)))
  },
  [ifOtherSymbol]: {
    nextState: haltState
  }
}, 'minusOne');
export default {
  alphabet,
  states: {
    goToNumber,
    goToNextNumber,
    goToPreviousNumber,
    deleteNumber,
    goToNumbersStart,
    invertNumber,
    normalizeNumber,
    plusOne,
    minusOne
  }
};