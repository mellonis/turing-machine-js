import {Alphabet, haltState, ifOtherSymbol, movements, State, symbolCommands} from '../TuringMachine';

const alphabet = new Alphabet(' ^$01'.split(''));

const goToNumber = new State({
    '$': {
        nextState: haltState,
    },
    [ifOtherSymbol]: {
        movement: movements.right,
    },
}, 'goToNumber');

const goToNextNumber = new State({
    [ifOtherSymbol]: {
        movement: movements.right,
        nextState: goToNumber,
    },
}, 'goToNextNumber');

const goToPreviousNumber_True = new State({
    '$': {
        nextState: haltState,
    },
    [ifOtherSymbol]: {
        movement: movements.left,
    },
}, 'goToPreviousNumber_True');

const goToPreviousNumber = new State({
    [ifOtherSymbol]: {
        movement: movements.left,
        nextState: goToPreviousNumber_True,
    },
}, 'goToPreviousNumber');

const goToNumbersStart = new State({
    '^': {
        nextState: haltState,
    },
    [ifOtherSymbol]: {
        movement: movements.left,
    },
}, 'goToNumberStart');

const deleteNumber_True = new State({
    '$': {
        symbol: symbolCommands.erase,
        nextState: haltState,
    },
    [ifOtherSymbol]: {
        symbol: symbolCommands.erase,
        movement: movements.right,
    },
}, 'deleteNumber_True');

const deleteNumber = new State({
    '^10$': {
        nextState: goToNumbersStart.withOverrodeHaltState(deleteNumber_True),
    },
    [ifOtherSymbol]: {
        nextState: haltState,
    },
}, 'deleteNumber');

const invertNumber_goToNumberWithInversion = new State({
    '^': {
        movement: movements.right,
    },
    '1': {
        symbol: '0',
        movement: movements.right,
    },
    '0': {
        symbol: '1',
        movement: movements.right,
    },
    '$': {
        nextState: haltState,
    }
}, 'invertNumber_goToNumberWithInversion');

const invertNumber = new State({
    '^10$': {
        nextState: goToNumbersStart.withOverrodeHaltState(invertNumber_goToNumberWithInversion),
    },
    [ifOtherSymbol]: {
        nextState: haltState,
    },
}, 'invertNumber');

const normalizeNumber_deleteOldNumberStart = new State({
    '^': {
        symbol: symbolCommands.erase,
        movement: movements.right,
        nextState: goToNumber,
    },
}, 'normalizeNumber_deleteOldNumberStart');

const normalizeNumber_moveNumberStart = new State({
    '^': {
        movement: movements.right,
    },
    '0': {
        symbol: '^',
        movement: movements.left,
        nextState: normalizeNumber_deleteOldNumberStart,
    },
    '1$': {
        nextState: goToNumber,
    },
    [ifOtherSymbol]: {
        movement: movements.left,
    },
}, 'normalizeNumber_moveNumberStart');

const normalizeNumber = new State({
    '^10$': {
        nextState: goToNumbersStart.withOverrodeHaltState(normalizeNumber_moveNumberStart),
    },
    [ifOtherSymbol]: {
        nextState: haltState,
    },
},'normalizeNumber');

const plusOne_fillZeros = new State({
    '1': {
        symbol: '0',
        movement: movements.right,
    },
    '$' : {
        nextState: haltState,
    },
}, 'plusOne_fillZeros');

const plusOne_addNumberStart = new State({
    [alphabet.blankSymbol]: {
        symbol: '^',
        movement: movements.right,
    },
    '1': {
        movement: movements.right,
        nextState: plusOne_fillZeros,
    }
}, 'plusOne_addNumberStart');

const plusOne_caryOne = new State({
    '0': {
        symbol: '1',
        movement: movements.right,
        nextState: plusOne_fillZeros,
    },
    '1': {
        movement: movements.left,
    },
    '^': {
        symbol: '1',
        movement: movements.left,
        nextState: plusOne_addNumberStart,
    },
}, 'plusOne_caryOne');

const plusOne = new State({
    '^10': {
        movement: movements.right,
    },
    '$': {
        movement: movements.left,
        nextState: plusOne_caryOne,
    },
    [ifOtherSymbol]: {
        nextState: haltState,
    },
}, 'plusOne');

const minusOne = new State({
    '^10': {
        movement: movements.right,
    },
    '$': {
        nextState: invertNumber
            .withOverrodeHaltState(
                plusOne
                    .withOverrodeHaltState(
                        invertNumber
                            .withOverrodeHaltState(normalizeNumber)
                    )
            ),
    },
    [ifOtherSymbol]: {
        nextState: haltState,
    },
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
        minusOne,
    }
};