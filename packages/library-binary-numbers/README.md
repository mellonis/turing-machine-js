# @turing-machine-js/library-binary-numbers

[![build](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml/badge.svg)](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml)
![npm (tag)](https://img.shields.io/npm/v/@turing-machine-js/library-binary-numbers)

A library for the turing-machine-js.

## Install

Using npm:

```sh
npm install @turing-machine-js/library-binary-numbers
```

or using yarn:

```sh
yarn add @turing-machine-js/library-binary-numbers
```

## A concept

Binary numbers are represented as a sequence of symbols `0` and `1`.

A representation of a number starts with symbol `^` and ends with symbol `$`.

For example:
- `^$` stands for 0
- `^1$` stands for 1
- `^10$` stands for 2
- `^11$` stands for 3
- etc.

There is no ability to work with negative numbers at this time.

This library provides following objects to work with binary numbers:
- `getTapeBlock` - this function returns a `TapeBlock` class instance. It has only one tape. An alphabet of the tape contains the following symbols: `space` as a blank symbol, `^`, `$`, `0` and `1`.
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

If you want to use states which were described earlier, you must use a tape block received from the `getTapeBlock` function.

## Links

- The information about `TapeBlock` and `State` classes is [here](https://github.com/mellonis/turing-machine-js/tree/master/packages/machine) 
- [Turing Machine](https://en.wikipedia.org/wiki/Turing_machine) on the Wikipedia

