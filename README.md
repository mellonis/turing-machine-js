# turing-machine-js

[![build](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml/badge.svg)](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml)
[![Coverage Status](https://coveralls.io/repos/github/mellonis/turing-machine-js/badge.svg?branch=master)](https://coveralls.io/github/mellonis/turing-machine-js?branch=master)
![GitHub issues](https://img.shields.io/github/issues/mellonis/turing-machine-js)

A convenient Turing machine

This repository contains following packages:

* [@turing-machine-js/builder](https://github.com/mellonis/turing-machine-js/tree/master/packages/builder)
* [@turing-machine-js/machine](https://github.com/mellonis/turing-machine-js/tree/master/packages/machine)
* [@turing-machine-js/library-binary-numbers](https://github.com/mellonis/turing-machine-js/tree/master/packages/library-binary-numbers)

# An example

A tape contains `a`, `b` and `c` symbols. The issue is to replace all `b` symbols by `*` symbol.

This example demonstrates an issue solving.

```javascript
import TuringMachine, {
  Alphabet,
  State,
  Tape,
  TapeBlock,
  haltState,
  ifOtherSymbol,
  movements,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet([' ', 'a', 'b', 'c', '*']);
const tape = new Tape({
  alphabet,
  symbols: ['a', 'b', 'c', 'b', 'a'],
});
const tapeBlock = TapeBlock.fromTapes([tape]);
const machine = new TuringMachine({
  tapeBlock,
});

console.log(tape.symbols.join('').trim()); // abcba

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

console.log(tape.symbols.join('').trim()); // a*c*a
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
