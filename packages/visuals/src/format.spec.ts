import { describe, it, expect } from 'vitest';
import {
  Alphabet,
  Tape,
  TapeBlock,
  TapeCommand,
  TuringMachine,
  State,
  haltState,
  movements,
  symbolCommands,
} from '@turing-machine-js/machine';
import { formatCommand, formatStep } from './format';

describe('formatCommand', () => {
  it('formats a literal symbol write + right move', () => {
    const tc = new TapeCommand({ symbol: 'X', movement: movements.right });
    expect(formatCommand(tc)).toBe("'X'/R");
  });

  it('formats keep + stay as K/S', () => {
    const tc = new TapeCommand({ movement: movements.stay });
    // default symbol is symbolCommands.keep
    expect(formatCommand(tc)).toBe('K/S');
  });

  it('formats erase + left as E/L', () => {
    const tc = new TapeCommand({ symbol: symbolCommands.erase, movement: movements.left });
    expect(formatCommand(tc)).toBe('E/L');
  });

  it('formats keep + right as K/R', () => {
    const tc = new TapeCommand({ symbol: symbolCommands.keep, movement: movements.right });
    expect(formatCommand(tc)).toBe('K/R');
  });

  it('formats a literal symbol write + left move', () => {
    const tc = new TapeCommand({ symbol: 'a', movement: movements.left });
    expect(formatCommand(tc)).toBe("'a'/L");
  });
});

describe('formatStep', () => {
  it("formats a single-tape iter: 'a' → 'b'/R", () => {
    const alphabet = new Alphabet([' ', 'a', 'b']);
    const tape = new Tape({ alphabet, symbols: ['a'] });
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({ tapeBlock });
    const initialState = new State({
      [tapeBlock.symbol(['a'])]: {
        command: [{ symbol: 'b', movement: movements.right }],
        nextState: haltState,
      },
    });
    const gen = machine.runStepByStep({ initialState });
    const m = gen.next().value!;

    expect(formatStep(m)).toBe("['a'] → ['b']/[R]");
  });

  it('encodes keep as K when nextSymbol equals currentSymbol', () => {
    const alphabet = new Alphabet([' ', 'a', 'b']);
    const tape = new Tape({ alphabet, symbols: ['a'] });
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({ tapeBlock });
    const initialState = new State({
      [tapeBlock.symbol(['a'])]: {
        command: [{ symbol: symbolCommands.keep, movement: movements.stay }],
        nextState: haltState,
      },
    });
    const gen = machine.runStepByStep({ initialState });
    const m = gen.next().value!;

    // keep → nextSymbols[0] === currentSymbols[0], so write cell is K
    expect(formatStep(m)).toBe("['a'] → [K]/[S]");
  });

  it('formats a 2-tape iter with comma-separated entries', () => {
    const alphabetA = new Alphabet([' ', 'a', 'b']);
    const alphabetB = new Alphabet([' ', 'x', 'y']);
    const tape1 = new Tape({ alphabet: alphabetA, symbols: ['a'] });
    const tape2 = new Tape({ alphabet: alphabetB, symbols: ['x'] });
    const tapeBlock = TapeBlock.fromTapes([tape1, tape2]);
    const machine = new TuringMachine({ tapeBlock });
    const initialState = new State({
      [tapeBlock.symbol(['a', 'x'])]: {
        command: [
          { symbol: 'b', movement: movements.right },
          { symbol: symbolCommands.keep, movement: movements.left },
        ],
        nextState: haltState,
      },
    });
    const gen = machine.runStepByStep({ initialState });
    const m = gen.next().value!;

    expect(formatStep(m)).toBe("['a','x'] → ['b',K]/[R,L]");
  });
});
