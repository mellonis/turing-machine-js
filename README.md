# turing-machine-js

[![Build Status](https://travis-ci.com/mellonis/turing-machine-js.svg?branch=master)](https://travis-ci.com/mellonis/turing-machine-js)
![GitHub issues](https://img.shields.io/github/issues/mellonis/turing-machine-js)

A convenient Turing machine

This repository contains following packages:
* [@turing-machine-js/machine](https://github.com/mellonis/turing-machine-js/tree/master/packages/machine)
* [@turing-machine-js/library-binary-numbers](https://github.com/mellonis/turing-machine-js/tree/master/packages/library-binary-numbers)

# Example

```javascript
import TuringMachine, {
  Alphabet, haltState,
  ifOtherSymbol,
  movements,
  State,
  symbolCommands,
  Tape
} from '@turing-machine-js/machine';

const alphabet = new Alphabet({
  symbolList: ['$', 'a', 'b', 'c'],
});
const tape = new Tape({
  alphabet,
  symbolList: ['a', 'b', 'c'],
});
const machine = new TuringMachine(tape);
const eraseState = new State({
  ['abc']: {
    symbol: symbolCommands.erase,
    movement: movements.right,
  },
  [ifOtherSymbol]: {
    nextState: haltState,
  },
});

console.log(tape.symbolList.join('')); // abc

machine.run(eraseState);

console.log(tape.symbolList.join('')) // $$$$

```

