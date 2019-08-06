import binaryNumbers from '@turing-machine-js/library-binary-numbers';
import { State, TapeBlock } from '@turing-machine-js/machine';

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
  test('has a correct tapeBlock', () => {
    expect(binaryNumbers.tapeBlock instanceof TapeBlock)
      .toBe(true);

    const { alphabet } = binaryNumbers.tapeBlock.tapeList[0];

    expect(alphabet.symbolList.length)
      .toBe(alphabetSymbols.length);
    expect(alphabetSymbols.split('').every(symbol => alphabet.has(symbol)))
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
