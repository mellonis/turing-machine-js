# @turing-machine-js/machine

[![Build Status](https://travis-ci.com/mellonis/turing-machine-js.svg?branch=next)](https://travis-ci.com/mellonis/turing-machine-js)
![npm (scoped)](https://img.shields.io/npm/v/@turing-machine-js/machine)

Some basic objects to build your own turing machine  

## Install

Using npm:

```sh
npm install --save-dev @turing-machine-js/machine
```

or using yarn:

```sh
yarn add @turing-machine-js/machine --dev
```

## Classes

### Alphabet

### Command

### Reference

### State

### Tape

### TapeBlock

### TapeCommand

### TuringMachine

## Special objects

### haltState

A special state which tells to the processor to stop

### ifOtherSymbol

A special symbol for representing the other symbols in `State` class definition

### movements

* left - move the head to the left
* right - move the head to the right
* stay - do not move the head

### symbolCommands

* erase - write the blank symbol
* keep - leave the current symbol

## Libraries

- [@turing-machine-js/library-binary-numbers](https://github.com/mellonis/turing-machine-js/tree/next/packages/library-binary-numbers)

## Links

- [Turing Machine](https://en.wikipedia.org/wiki/Turing_machine) on the Wikipedia
