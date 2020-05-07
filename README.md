# turing-machine-js

[![Build Status](https://travis-ci.com/mellonis/turing-machine-js.svg?branch=master)](https://travis-ci.com/mellonis/turing-machine-js)
[![Coverage Status](https://coveralls.io/repos/github/mellonis/turing-machine-js/badge.svg?branch=master)](https://coveralls.io/github/mellonis/turing-machine-js?branch=master)
![GitHub issues](https://img.shields.io/github/issues/mellonis/turing-machine-js)

A convenient Turing machine. [Next branch](https://github.com/mellonis/turing-machine-js/tree/next) supports multitape turing machines.

This repository contains following packages:
* [@turing-machine-js/machine](https://github.com/mellonis/turing-machine-js/tree/master/packages/machine)
* [@turing-machine-js/library-binary-numbers](https://github.com/mellonis/turing-machine-js/tree/master/packages/library-binary-numbers)

# An example

A tape contains `a`, `b` and `c` symbols. The issue is to replace all `b` symbols by `*` symbol.

This example demonstrates an issue solving.

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
  symbolList: [' ', 'a', 'b', 'c', '*'],
});
const tape = new Tape({
  alphabet,
  symbolList: ['a', 'b', 'c', 'b', 'a'],
  viewportWidth: 15,
});
const machine = new TuringMachine(tape);

console.log(tape.symbolList.join('').trim()); // abcba

machine.run({
  initialState: new State({
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

console.log(tape.symbolList.join('').trim()); // a*c*a
```

## Execution steps explanation
- `S` stands for the initial state
- `H` stands for the `haltState` 


### Step 1
- Current state: S
- Current symbol: 'a'
- Transition: 'a'/S,R
```
[       abcba   ]    [       abcba   ]
        ^         >>          ^
```

### Step 2
- Current state: S
- Current symbol: 'b'
- Transition: '*'/S,R
```
[      abcba    ]    [      a*cba    ]
        ^         >>          ^
```

### Step 3
- Current state: S
- Current symbol: 'c'
- Transition: 'c'/S,R
```
[     a*cba     ]    [     a*cba     ]
        ^         >>          ^
```

### Step 4
- Current state: S
- Current symbol: 'b'
- Transition: '*'/S,R
```
[    a*cba      ]    [    a*c*a      ]
        ^         >>          ^
```

### Step 5
- Current state: S
- Current symbol: 'a'
- Transition: 'a'/S,R
```
[   a*c*a       ]    [   a*c*a       ]
        ^         >>          ^
```

### Step 6
- Current state: S
- Current symbol: ' '
- Transition: ' '/H,L
```
[  a*c*a        ]    [  a*c*a        ]
        ^         >>        ^
```
