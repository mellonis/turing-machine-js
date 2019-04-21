import binaryNumbers from '@turing-machine-js/library-binary-numbers';
import { Alphabet, State } from '@turing-machine-js/machine';

const alphabetSymbols = ' ^$01';
const stateNameList = [
  'goToNumber',
  'goToNextNumber',
  'goToPreviousNumber',
  'deleteNumber',
  'goToNumbersStart',
  'invertNumber',
  'normalizeNumber',
  'plusOne',
  'minusOne',
];

describe('general tests', () => {
  test('has a correct alphabet', () => {
    expect(binaryNumbers.alphabet instanceof Alphabet)
      .toBe(true);
    expect(binaryNumbers.alphabet.symbolList.length)
      .toBe(alphabetSymbols.length);
    expect(alphabetSymbols.split('').every(symbol => binaryNumbers.alphabet.has(symbol)))
      .toBe(true);
  });

  test('has all declared states', () => {
    expect(stateNameList.every(stateName => binaryNumbers.states[stateName] instanceof State))
      .toBe(true);
  });
});

describe('states tests', () => {
  stateNameList.forEach(stateName => test.todo(`test ${stateName} algo`));
});
