# @turing-machine-js/library-binary-numbers
A library for the turing-machine-js.

## Install

Using npm:

```sh
npm install --save-dev @turing-machine-js/library-binary-numbers
```

or using yarn:

```sh
yarn add @turing-machine-js/library-binary-numbers --dev
```

## A concept

Binary numbers are represented as a sequence of symbols `0` and `1`.

The representation of the number starts with symbol `^` and ends with symbol `$`.

For example:
- `^$` stands for 0
- `^1$` stands for 1
- `^10$` stands for 2
- `^11$` stands for 3
- etc.

There is no ability to work with negative numbers a this time.

This library provides following objects to work with binary numbers:
- `alphabet` - an `Alphabet` class instance which contains following symbols: `space` as a blank symbol, `^`, `$`, `0` and `1`.
- `states` - following `States` class instances which represent some algorithms:
    - `goToNumber` - move the head to the number's end
    - `goToNextNumber` - move the head to the next number (to the right)
    - `goToPreviousNumber` - move the head to the previous number (to the left)
    - `deleteNumber` - delete the current number 
    - `goToNumbersStart` - move the head to the number's start 
    - `invertNumber` - change every symbol in the number to it's opposite one (`0` to `1` and `1` to `0`)
    - `normalizeNumber` - delete leading zeros
    - `plusOne` - add 1 to the number
    - `minusOne` - subtract 1 from the number 

## Links

- The information about `Alphabet` and `State` classes is [here](https://github.com/mellonis/turing-machine-js/tree/master/packages/machine) 
- [Turing Machine](https://en.wikipedia.org/wiki/Turing_machine) on the Wikipedia

