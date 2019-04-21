"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

function _machine() {
  const data = require("@turing-machine-js/machine");

  _machine = function () {
    return data;
  };

  return data;
}

const alphabet = new (_machine().Alphabet)({
  symbolList: ' ^$01'.split('')
});
const goToNumber = new (_machine().State)({
  $: {
    nextState: _machine().haltState
  },
  [_machine().ifOtherSymbol]: {
    movement: _machine().movements.right
  }
}, 'goToNumber');
const goToNextNumber = new (_machine().State)({
  [_machine().ifOtherSymbol]: {
    movement: _machine().movements.right,
    nextState: goToNumber
  }
}, 'goToNextNumber');
const goToPreviousNumberTrue = new (_machine().State)({
  $: {
    nextState: _machine().haltState
  },
  [_machine().ifOtherSymbol]: {
    movement: _machine().movements.left
  }
}, 'goToPreviousNumberTrue');
const goToPreviousNumber = new (_machine().State)({
  [_machine().ifOtherSymbol]: {
    movement: _machine().movements.left,
    nextState: goToPreviousNumberTrue
  }
}, 'goToPreviousNumber');
const goToNumbersStart = new (_machine().State)({
  '^': {
    nextState: _machine().haltState
  },
  [_machine().ifOtherSymbol]: {
    movement: _machine().movements.left
  }
}, 'goToNumberStart');
const deleteNumberTrue = new (_machine().State)({
  $: {
    symbol: _machine().symbolCommands.erase,
    nextState: _machine().haltState
  },
  [_machine().ifOtherSymbol]: {
    symbol: _machine().symbolCommands.erase,
    movement: _machine().movements.right
  }
}, 'deleteNumberTrue');
const deleteNumber = new (_machine().State)({
  '^10$': {
    nextState: goToNumbersStart.withOverrodeHaltState(deleteNumberTrue)
  },
  [_machine().ifOtherSymbol]: {
    nextState: _machine().haltState
  }
}, 'deleteNumber');
const invertNumberGoToNumberWithInversion = new (_machine().State)({
  '^': {
    movement: _machine().movements.right
  },
  1: {
    symbol: '0',
    movement: _machine().movements.right
  },
  0: {
    symbol: '1',
    movement: _machine().movements.right
  },
  $: {
    nextState: _machine().haltState
  }
}, 'invertNumberGoToNumberWithInversion');
const invertNumber = new (_machine().State)({
  '^10$': {
    nextState: goToNumbersStart.withOverrodeHaltState(invertNumberGoToNumberWithInversion)
  },
  [_machine().ifOtherSymbol]: {
    nextState: _machine().haltState
  }
}, 'invertNumber');
const normalizeNumberPutNewStartSymbol = new (_machine().State)({
  [alphabet.blankSymbol]: {
    symbol: '^',
    nextState: goToNumber
  }
}, 'normalizeNumberPutNewStartSymbol');
const normalizeNumberMoveNumberStart = new (_machine().State)({
  '^0': {
    symbol: _machine().symbolCommands.erase,
    movement: _machine().movements.right
  },
  '1$': {
    movement: _machine().movements.left,
    nextState: normalizeNumberPutNewStartSymbol
  }
}, 'normalizeNumberMoveNumberStart');
const normalizeNumber = new (_machine().State)({
  '^10$': {
    nextState: goToNumbersStart.withOverrodeHaltState(normalizeNumberMoveNumberStart)
  },
  [_machine().ifOtherSymbol]: {
    nextState: _machine().haltState
  }
}, 'normalizeNumber');
const plusOneFillZeros = new (_machine().State)({
  1: {
    symbol: '0',
    movement: _machine().movements.right
  },
  $: {
    nextState: _machine().haltState
  }
}, 'plusOneFillZeros');
const plusOneAddNumberStart = new (_machine().State)({
  [alphabet.blankSymbol]: {
    symbol: '^',
    movement: _machine().movements.right
  },
  1: {
    movement: _machine().movements.right,
    nextState: plusOneFillZeros
  }
}, 'plusOneAddNumberStart');
const plusOneCaryOne = new (_machine().State)({
  0: {
    symbol: '1',
    movement: _machine().movements.right,
    nextState: plusOneFillZeros
  },
  1: {
    movement: _machine().movements.left
  },
  '^': {
    symbol: '1',
    movement: _machine().movements.left,
    nextState: plusOneAddNumberStart
  }
}, 'plusOneCaryOne');
const plusOne = new (_machine().State)({
  '^10': {
    movement: _machine().movements.right
  },
  $: {
    movement: _machine().movements.left,
    nextState: plusOneCaryOne
  },
  [_machine().ifOtherSymbol]: {
    nextState: _machine().haltState
  }
}, 'plusOne');
const minusOne = new (_machine().State)({
  '^10': {
    movement: _machine().movements.right
  },
  $: {
    nextState: invertNumber.withOverrodeHaltState(plusOne.withOverrodeHaltState(invertNumber.withOverrodeHaltState(normalizeNumber)))
  },
  [_machine().ifOtherSymbol]: {
    nextState: _machine().haltState
  }
}, 'minusOne');
var _default = {
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
exports.default = _default;