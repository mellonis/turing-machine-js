import {
  decodeMovement,
  decodePatternDescription,
  decodeWriteSymbol,
} from './graph';
import {toMermaid} from './graphFormats';
import {movements, symbolCommands} from '../classes/TapeCommand';

describe('decodePatternDescription', () => {
  const alphabets = [[' ', '0', '1']];

  test('undefined description → "?"', () => {
    expect(decodePatternDescription(undefined, alphabets)).toBe('?');
  });

  test('"other symbol" → "*" (whole-state ifOtherSymbol)', () => {
    expect(decodePatternDescription('other symbol', alphabets)).toBe('*');
  });

  test('literal cell', () => {
    expect(decodePatternDescription('[["0"]]', alphabets)).toBe('0');
  });

  test('per-cell null → "*"', () => {
    expect(decodePatternDescription('[[null]]', alphabets)).toBe('*');
  });

  test('cell equal to tape blank → "-"', () => {
    expect(decodePatternDescription('[[" "]]', alphabets)).toBe('-');
  });

  test('multi-tape pattern joins cells with ","', () => {
    expect(decodePatternDescription(
      '[["0","a"]]',
      [[' ', '0', '1'], [' ', 'a', 'b']],
    )).toBe('0,a');
  });

  test('alternative patterns join with "|"', () => {
    expect(decodePatternDescription('[["0"],["1"]]', alphabets)).toBe('0|1');
  });

  test('reserved char "*" is escaped as "\\*"', () => {
    expect(decodePatternDescription('[["*"]]', [[' ', '*', 'x']])).toBe('\\*');
  });

  test('reserved char "," is escaped as "\\,"', () => {
    expect(decodePatternDescription('[[","]]', [[' ', ',', 'x']])).toBe('\\,');
  });

  test('reserved char "|" is escaped as "\\|"', () => {
    expect(decodePatternDescription('[["|"]]', [[' ', '|', 'x']])).toBe('\\|');
  });

  test('backslash is escaped as "\\\\"', () => {
    expect(decodePatternDescription('[["\\\\"]]', [[' ', '\\', 'x']])).toBe('\\\\');
  });

  test('malformed JSON → returned as-is', () => {
    expect(decodePatternDescription('not-json{[(', alphabets)).toBe('not-json{[(');
  });
});

describe('decodeMovement', () => {
  test('undefined → "?"', () => {
    expect(decodeMovement(undefined)).toBe('?');
  });

  test.each([
    [(movements.left as symbol).description, 'L'],
    [(movements.right as symbol).description, 'R'],
    [(movements.stay as symbol).description, 'S'],
  ])('%s → %s', (description, expected) => {
    expect(decodeMovement(description)).toBe(expected);
  });

  test('unknown movement description → returned as-is', () => {
    expect(decodeMovement('some unknown movement')).toBe('some unknown movement');
  });
});

describe('decodeWriteSymbol', () => {
  test('symbolCommands.keep → "·"', () => {
    expect(decodeWriteSymbol(symbolCommands.keep)).toBe('·');
  });

  test('symbolCommands.erase → "⌫"', () => {
    expect(decodeWriteSymbol(symbolCommands.erase)).toBe('⌫');
  });

  test('literal string is returned as-is', () => {
    expect(decodeWriteSymbol('0')).toBe('0');
  });

  test('symbol with no description → "?"', () => {
    expect(decodeWriteSymbol(Symbol())).toBe('?');
  });

  test('unknown symbol description → returned as-is', () => {
    expect(decodeWriteSymbol(Symbol('foo'))).toBe('foo');
  });
});

describe('toMermaid', () => {
  test('renders flowchart header, alphabets comment, and node shapes', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0', '1']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {
          id: 1, name: 'entry', isHalt: false, overrodeHaltStateId: null,
          transitions: [
            {pattern: '0', command: [{symbol: '·', movement: 'R'}], nextStateId: 1},
            {pattern: '1', command: [{symbol: '·', movement: 'S'}], nextStateId: 0},
          ],
        },
      },
    });

    expect(out.startsWith('flowchart TD')).toBe(true);
    expect(out).toContain('%% alphabets: [[" ","0","1"]]');
    expect(out).toContain('s0(((halt)))');
    expect(out).toContain('s1(("entry"))');
    expect(out).toContain('s1 -- "0 → ·/R" --> s1');
    expect(out).toContain('s1 -- "1 → ·/S" --> s0');
  });

  test('renders dotted onHalt edge when overrodeHaltStateId is set', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {id: 1, name: 'wrapper', isHalt: false, transitions: [], overrodeHaltStateId: 0},
      },
    });

    expect(out).toContain('s1 -. onHalt .-> s0');
  });

  test('non-initial, non-halt node uses square bracket shape', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {id: 1, name: 'entry', isHalt: false, transitions: [], overrodeHaltStateId: null},
        2: {id: 2, name: 'helper', isHalt: false, transitions: [], overrodeHaltStateId: null},
      },
    });

    expect(out).toContain('s2["helper"]');
  });

  test('multi-tape command uses "," to separate per-tape ops', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0'], [' ', 'a']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overrodeHaltStateId: null},
        1: {
          id: 1, name: 'entry', isHalt: false, overrodeHaltStateId: null,
          transitions: [{
            pattern: '0,a',
            command: [{symbol: '0', movement: 'R'}, {symbol: 'a', movement: 'L'}],
            nextStateId: 0,
          }],
        },
      },
    });

    expect(out).toContain('"0,a → 0/R,a/L"');
  });
});
