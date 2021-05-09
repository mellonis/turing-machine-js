import TuringMachine, {
  Alphabet,
  Tape,
  State,
  movements,
  haltState,
  ifOtherSymbol, TapeBlock,
} from '@turing-machine-js/machine';

describe('README.md', () => {
  test('An example', () => {
    const alphabet = new Alphabet({
      symbolList: [' ', 'a', 'b', 'c', '*'],
    });
    const tape = new Tape({
      alphabet,
      symbolList: ['a', 'b', 'c', 'b', 'a'],
    });
    const tapeBlock = new TapeBlock({
      tapeList: [tape],
    });
    const machine = new TuringMachine({
      tapeBlock,
    });

    // console.log(tape.symbolList.join('').trim()); // abcba

    expect(tape.symbolList.join('').trim())
      .toBe('abcba');

    machine.run({
      initialState: new State({
        // eslint-disable-next-line no-useless-computed-key
        [tapeBlock.symbol(['b'])]: {
          command: [
            {
              symbol: '*',
              movement: movements.right,
            },
          ],
        },
        [tapeBlock.symbol([tape.alphabet.blankSymbol])]: {
          command: [
            {
              movement: movements.left,
            },
          ],
          nextState: haltState,
        },
        [ifOtherSymbol]: {
          command: [
            {
              movement: movements.right,
            },
          ],
        },
      }),
    });

    // console.log(tape.symbolList.join('').trim()); // a*c*a

    expect(tape.symbolList.join('').trim())
      .toBe('a*c*a');
  });
});
