# turing-machine-js

[![Build Status](https://travis-ci.com/mellonis/turing-machine-js.svg?branch=next)](https://travis-ci.com/mellonis/turing-machine-js)
[![Coverage Status](https://coveralls.io/repos/github/mellonis/turing-machine-js/badge.svg?branch=next)](https://coveralls.io/github/mellonis/turing-machine-js?branch=next)
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
    command: [
      {
        symbol: '*',
        movement: movements.right,
      },
    ],
  },
  [tapeBlock.symbol([tapeBlock.tapeList[0].alphabet.blankSymbol])]: {
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
});

console.log(tape.symbolList.join('')); // abc

machine.run(replaceAllBSymbolsByAsterisk);

console.log(tape.symbolList.join('')); // a*c_

```

## Step 1:
- State: replaceAllBSymbolsByAsterisk
- Current symbols: \['a']
- Actions:
    - write symbols: \['a']
    - do the following carriers movements: \[right]
- Next state: replaceAllBSymbolsByAsterisk
```
    [______abc____]    [______abc____]
           ^        >>         ^     
```

## Step 2:
- State: replaceAllBSymbolsByAsterisk
- Current symbols: \['b']
- Actions:
    - write symbols: \['*']
    - do the following carriers movements: \[right]
- Next state: replaceAllBSymbolsByAsterisk
```
    [_____abc_____]    [_____a*c_____]
           ^        >>         ^     
```

## Step 3:
- State: replaceAllBSymbolsByAsterisk
- Current symbols: \['c']
- Actions:
    - write symbols: \['c']
    - do the following carriers movements: \[right]
- Next state: replaceAllBSymbolsByAsterisk
```
    [____a*c______]    [____a*c______]
           ^        >>         ^     
```

## Step 4:
- State: replaceAllBSymbolsByAsterisk
- Current symbols: \['_']
- Actions:
    - write symbols: \['_']
    - do the following carriers movements: \[left]
- Next state: haltState
```
    [___a*c_______]    [___a*c_______]
           ^        >>       ^       
```
