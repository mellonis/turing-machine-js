# turing-machine-js

[![Build Status](https://travis-ci.com/mellonis/turing-machine-js.svg?branch=next)](https://travis-ci.com/mellonis/turing-machine-js)
![GitHub issues](https://img.shields.io/github/issues/mellonis/turing-machine-js)

A convenient Turing machine

This repository contains following packages:
* [@turing-machine-js/builder](https://github.com/mellonis/turing-machine-js/tree/next/packages/builder)
* [@turing-machine-js/machine](https://github.com/mellonis/turing-machine-js/tree/next/packages/machine)
* [@turing-machine-js/library-binary-numbers](https://github.com/mellonis/turing-machine-js/tree/next/packages/library-binary-numbers)

# Example

```javascript
import TuringMachine, {
  Alphabet,
  Tape,
  TapeBlock,
  State,
  movements,
  haltState,
  ifOtherSymbol,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet({
  symbolList: ['_', 'a', 'b', 'c', '*'],
});
const tape = new Tape({
  alphabet,
  symbolList: ['a', 'b', 'c'],
});
const tapeBlock = new TapeBlock({
  tapeList: [tape],
});
const machine = new TuringMachine({
  tapeBlock,
});
const replaceAllBSymbolsByAsterisk = new State({
  [tapeBlock.symbol(['b'])]: {
    command: {
      symbol: '*',
      movement: movements.right,
    },
  },
  [tapeBlock.symbol([tapeBlock.tapeList[0].alphabet.blankSymbol])]: {
    command: {
      movement: movements.left,
    },
    nextState: haltState,
  },
  [ifOtherSymbol]: {
    command: {
      movement: movements.right,
    },
  },
});

console.log(tape.symbolList.join('')); // abc

machine.run(replaceAllBSymbolsByAsterisk);

console.log(tape.symbolList.join('')); // a*c_

```

Step 1: write 'a' symbol and then move the carriage to the right

    [______abc____]    [______abc____]
           ^        >>         ^     
    
Step 2: write '*' symbol and then move the carriage to the right

    [_____abc_____]    [_____a*c_____]
           ^        >>         ^     
    
Step 3: write 'c' symbol and then move the carriage to the right

    [____a*c______]    [____a*c______]
           ^        >>         ^     
    
Step 4: write '_' symbol and then move the carriage to the left then stop

    [___a*c_______]    [___a*c_______]
           ^        >>       ^       
