// jest.setTimeout(10000);

import TuringMachine, {
  Alphabet,
  Tape,
  State,
  movements,
  ifOtherSymbol,
  haltState,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet({
  symbolList: ' abAB'.split(''),
});
const tape = new Tape({
  alphabet,
  symbolList: 'abba'.split(''),
});
const invertState = new State({
  a: {
    symbol: 'A',
    movement: movements.right,
  },
  b: {
    symbol: 'B',
    movement: movements.right,
  },
  [ifOtherSymbol]: {
    movement: movements.left,
    nextState: haltState,
  },
});
const turingMachine = new TuringMachine(tape);
console.log(tape.symbolList.join().trim());
turingMachine.run(invertState);
console.log(tape.symbolList.join().trim());
