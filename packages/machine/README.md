# @turing-machine-js/machine

[![build](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml/badge.svg)](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml)
![npm (tag)](https://img.shields.io/npm/v/@turing-machine-js/machine)

Some basic objects to build your own turing machine  

## Install

Using npm:

```sh
npm install @turing-machine-js/machine
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

A special state for stopping the machine

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

- [@turing-machine-js/library-binary-numbers](https://github.com/mellonis/turing-machine-js/tree/master/packages/library-binary-numbers)

## Links

- [Turing Machine](https://en.wikipedia.org/wiki/Turing_machine) on the Wikipedia
