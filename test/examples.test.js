import TuringMachine, {
  Alphabet,
  Tape,
  State,
  movements,
  haltState,
  ifOtherSymbol,
} from '@turing-machine-js/machine';

describe('README.md', () => {
  test('An example', () => {
    const alphabet = new Alphabet({
      symbolList: [' ', 'a', 'b', 'c', '*'],
    });
    const tape = new Tape({
      alphabet,
      symbolList: ['a', 'b', 'c', 'b', 'a'],
      viewportWidth: 15,
    });
    const machine = new TuringMachine(tape);

    // console.log(tape.symbolList.join('').trim()); // abcba

    expect(tape.symbolList.join('').trim())
      .toBe('abcba');

    machine.run({
      initialState: new State({
        // eslint-disable-next-line no-useless-computed-key
        ['b']: {
          symbol: '*',
          movement: movements.right,
        },
        [tape.alphabet.blankSymbol]: {
          movement: movements.left,
          nextState: haltState,
        },
        [ifOtherSymbol]: {
          movement: movements.right,
        },
      }),
    });

    // console.log(tape.symbolList.join('').trim()); // a*c*a

    expect(tape.symbolList.join('').trim())
      .toBe('a*c*a');
  });
});
