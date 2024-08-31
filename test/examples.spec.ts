import {
  Alphabet,
  haltState,
  ifOtherSymbol,
  movements,
  State,
  Tape,
  TapeBlock,
  TuringMachine,
} from '@turing-machine-js/machine/src';


describe('README.md', () => {
  test('An example', () => {
    const alphabet = new Alphabet([' ', 'a', 'b', 'c', '*']);
    const tape = new Tape({
      alphabet,
      symbols: ['a', 'b', 'c', 'b', 'a'],
    });
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({
      tapeBlock,
    });

    // console.log(tape.symbols.join('').trim()); // abcba

    expect(tape.symbols.join('').trim())
      .toBe('abcba');

    machine.run({
      initialState: new State({
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

    // console.log(tape.symbols.join('').trim()); // a*c*a

    expect(tape.symbols.join('').trim())
      .toBe('a*c*a');
  });
});
