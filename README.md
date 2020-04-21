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
  Alphabet,
  Tape,
  State,
  movements,
  haltState,
  ifOtherSymbol,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet({
  symbolList: '_abc*'.split(''),
});
const tape = new Tape({
  alphabet,
  symbolList: 'abc'.split(''),
});
const machine = new TuringMachine(tape);
const replaceAllBSymbolsByAsterisk = new State({
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
});

console.log(tape.symbolList.join('')); // abc

machine.run(replaceAllBSymbolsByAsterisk);

console.log(tape.symbolList.join('')); // a*c_
```

Step 1: move the carriage to the right

    [______abc____]    [______abc____]
           ^        >>         ^     
    
Step 2: write '*' symbol and then move the carriage to the right

    [_____abc_____]    [_____a*c_____]
           ^        >>         ^     
    
Step 3: move the carriage to the right

    [____a*c______]    [____a*c______]
           ^        >>         ^     
    
Step 4: move the carriage to the left then stop

    [___a*c_______]    [___a*c_______]
           ^        >>       ^   

