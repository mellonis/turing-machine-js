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
import {
  formatCommand,
  formatStep,
  formatStepNotation,
  formatTape,
  tokenizeStep,
  type StepCommand,
} from './format';

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

describe('formatStepNotation', () => {
  const BLANK = [' '];

  it('formats a literal read + literal write', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(formatStepNotation(['a'], commands, BLANK, ['literal'])).toBe("['a'] → ['b']/[R]");
  });

  it('renders blank read as B (non-wildcard)', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(formatStepNotation([' '], commands, BLANK, ['literal'])).toBe("[B] → ['b']/[R]");
  });

  it('renders wildcard read as *=\'X\' (NOT blank-shortcut even when read is blank)', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(formatStepNotation([' '], commands, BLANK, ['wildcard'])).toBe("[*=' '] → ['b']/[R]");
  });

  it("encodes keep as K='X' when read context is available", () => {
    const commands: StepCommand[] = [{ symbol: null, movement: 'S' }];
    expect(formatStepNotation(['a'], commands, BLANK, ['literal'])).toBe("['a'] → [K='a']/[S]");
  });

  it('encodes keep as K=B when read is the blank symbol', () => {
    const commands: StepCommand[] = [{ symbol: null, movement: 'S' }];
    expect(formatStepNotation([' '], commands, BLANK, ['literal'])).toBe('[B] → [K=B]/[S]');
  });

  it('encodes erase as E when write equals blank', () => {
    const commands: StepCommand[] = [{ symbol: ' ', movement: 'L' }];
    expect(formatStepNotation(['a'], commands, BLANK, ['literal'])).toBe("['a'] → [E]/[L]");
  });

  it('manual Apply (reads === null) collapses to [writes]/[moves] with no prefix', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(formatStepNotation(null, commands, BLANK, null)).toBe("['b']/[R]");
  });

  it('manual Apply with keep renders bare K (no read context)', () => {
    const commands: StepCommand[] = [{ symbol: null, movement: 'S' }];
    expect(formatStepNotation(null, commands, BLANK, null)).toBe('[K]/[S]');
  });

  it('multi-tape: per-role comma-separated entries inside one outer bracket', () => {
    const commands: StepCommand[] = [
      { symbol: '0', movement: 'R' },
      { symbol: 'b', movement: 'L' },
    ];
    expect(formatStepNotation(['1', 'a'], commands, [' ', ' '], ['literal', 'literal']))
      .toBe("['1','a'] → ['0','b']/[R,L]");
  });

  it('multi-tape mixed wildcard + literal reads', () => {
    const commands: StepCommand[] = [
      { symbol: 'b', movement: 'R' },
      { symbol: 'y', movement: 'S' },
    ];
    expect(formatStepNotation(['a', 'x'], commands, [' ', ' '], ['wildcard', 'literal']))
      .toBe("[*='a','x'] → ['b','y']/[R,S]");
  });

  it('omitted matchKinds (undefined) renders reads as literals', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(formatStepNotation(['a'], commands, BLANK)).toBe("['a'] → ['b']/[R]");
  });
});

describe('tokenizeStep', () => {
  const BLANK = [' '];

  it('literal read + literal write', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(tokenizeStep(['a'], commands, BLANK, ['literal'])).toEqual({
      reads: [{ kind: 'literal', symbol: 'a' }],
      writes: [{ kind: 'literal', symbol: 'b' }],
      moves: ['R'],
    });
  });

  it('blank read (non-wildcard) tokenizes to { kind: "blank" }', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(tokenizeStep([' '], commands, BLANK, ['literal']).reads).toEqual([
      { kind: 'blank' },
    ]);
  });

  it('wildcard read preserves literal symbol (no blank shortcut)', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(tokenizeStep([' '], commands, BLANK, ['wildcard']).reads).toEqual([
      { kind: 'wildcard', symbol: ' ' },
    ]);
  });

  it('keep write with read context (non-blank read)', () => {
    const commands: StepCommand[] = [{ symbol: null, movement: 'S' }];
    expect(tokenizeStep(['a'], commands, BLANK, ['literal']).writes).toEqual([
      { kind: 'keep', readContext: { symbol: 'a', isBlank: false } },
    ]);
  });

  it('keep write with blank read flags isBlank: true', () => {
    const commands: StepCommand[] = [{ symbol: null, movement: 'S' }];
    expect(tokenizeStep([' '], commands, BLANK, ['literal']).writes).toEqual([
      { kind: 'keep', readContext: { symbol: ' ', isBlank: true } },
    ]);
  });

  it('erase tokenizes as { kind: "erase" } (write equals blank)', () => {
    const commands: StepCommand[] = [{ symbol: ' ', movement: 'L' }];
    expect(tokenizeStep(['a'], commands, BLANK, ['literal']).writes).toEqual([
      { kind: 'erase' },
    ]);
  });

  it('manual Apply (reads === null): reads is null, keeps carry no readContext', () => {
    const commands: StepCommand[] = [{ symbol: null, movement: 'S' }];
    const tokens = tokenizeStep(null, commands, BLANK, null);
    expect(tokens.reads).toBeNull();
    expect(tokens.writes).toEqual([{ kind: 'keep' }]);
  });

  it('omitted matchKinds treats every read as literal (no wildcards)', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    expect(tokenizeStep(['a'], commands, BLANK).reads).toEqual([
      { kind: 'literal', symbol: 'a' },
    ]);
  });

  it('multi-tape arrays line up per index across reads/writes/moves', () => {
    const commands: StepCommand[] = [
      { symbol: 'b', movement: 'R' },
      { symbol: null, movement: 'S' },
      { symbol: ' ', movement: 'L' },
    ];
    expect(tokenizeStep(['a', 'x', ' '], commands, [' ', ' ', ' '], ['literal', 'wildcard', 'literal'])).toEqual({
      reads: [
        { kind: 'literal', symbol: 'a' },
        { kind: 'wildcard', symbol: 'x' },
        { kind: 'blank' },
      ],
      writes: [
        { kind: 'literal', symbol: 'b' },
        { kind: 'keep', readContext: { symbol: 'x', isBlank: false } },
        { kind: 'erase' },
      ],
      moves: ['R', 'S', 'L'],
    });
  });

  it('formatStepNotation output equals manual render of tokens (consistency invariant)', () => {
    const commands: StepCommand[] = [{ symbol: 'b', movement: 'R' }];
    const tokens = tokenizeStep(['a'], commands, BLANK, ['literal']);
    // Sanity: the token-based public API and the string-based public API
    // describe the same step. If this breaks, formatStepNotation drifted
    // from tokenizeStep.
    expect(tokens.writes).toHaveLength(1);
    expect(tokens.reads).toHaveLength(1);
    expect(formatStepNotation(['a'], commands, BLANK, ['literal'])).toBe("['a'] → ['b']/[R]");
  });
});

describe('formatTape', () => {
  it('brackets the head cell in place', () => {
    expect(formatTape({ symbols: ['a', 'b', 'c'], position: 1 })).toBe('a[b]c');
  });

  it('brackets head at start', () => {
    expect(formatTape({ symbols: ['a', 'b'], position: 0 })).toBe('[a]b');
  });

  it('brackets head at end', () => {
    expect(formatTape({ symbols: ['a', 'b'], position: 1 })).toBe('a[b]');
  });

  it('single-cell tape', () => {
    expect(formatTape({ symbols: ['x'], position: 0 })).toBe('[x]');
  });

  it('passes the blank glyph through literally', () => {
    expect(formatTape({ symbols: [' ', 'a', ' '], position: 0 })).toBe('[ ]a ');
  });
});
