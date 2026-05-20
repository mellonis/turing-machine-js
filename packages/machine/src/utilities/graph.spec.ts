import {
  decodeMovement,
  decodePatternDescription,
  decodeWriteSymbol,
  parseMovementLabel,
  parsePatternString,
  splitUnescaped,
} from './graph';
import {fromMermaid, toMermaid} from './graphFormats';
import Alphabet from '../classes/Alphabet';
import State, {haltState} from '../classes/State';
import TapeBlock from '../classes/TapeBlock';
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
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null},
        1: {
          id: 1, name: 'entry', isHalt: false, overriddenHaltStateId: null,
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

  test('renders dotted onHalt edge when overriddenHaltStateId is set', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null},
        1: {id: 1, name: 'wrapper', isHalt: false, transitions: [], overriddenHaltStateId: 0},
      },
    });

    expect(out).toContain('s1 -. onHalt .-> s0');
  });

  test('non-initial, non-halt node uses square bracket shape', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null},
        1: {id: 1, name: 'entry', isHalt: false, transitions: [], overriddenHaltStateId: null},
        2: {id: 2, name: 'helper', isHalt: false, transitions: [], overriddenHaltStateId: null},
      },
    });

    expect(out).toContain('s2["helper"]');
  });

  test('multi-tape command uses "," to separate per-tape ops', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0'], [' ', 'a']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null},
        1: {
          id: 1, name: 'entry', isHalt: false, overriddenHaltStateId: null,
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

describe('splitUnescaped', () => {
  test('escapes a separator with backslash', () => {
    expect(splitUnescaped('a\\,b,c', ',')).toEqual(['a,b', 'c']);
  });

  test('escapes a literal backslash', () => {
    expect(splitUnescaped('a\\\\b,c', ',')).toEqual(['a\\b', 'c']);
  });

  test('returns single segment when no separator', () => {
    expect(splitUnescaped('abc', ',')).toEqual(['abc']);
  });
});

describe('parsePatternString', () => {
  test('returns null for the global ifOtherSymbol marker', () => {
    expect(parsePatternString('*', [[' ', '0']])).toBeNull();
  });

  test('per-cell `*` becomes null', () => {
    // Multi-tape pattern where one cell is per-cell ifOtherSymbol.
    expect(parsePatternString('0,*', [[' ', '0'], [' ', 'a']])).toEqual([['0', null]]);
  });

  test('per-cell `-` becomes the tape blank symbol', () => {
    expect(parsePatternString('-,a', [[' ', '0'], [' ', 'a']])).toEqual([[' ', 'a']]);
  });
});

describe('parseMovementLabel', () => {
  test('maps L/R/S to upstream movement symbols', () => {
    expect(parseMovementLabel('L')).toBe(movements.left);
    expect(parseMovementLabel('R')).toBe(movements.right);
    expect(parseMovementLabel('S')).toBe(movements.stay);
  });

  test('throws on unknown label', () => {
    expect(() => parseMovementLabel('X')).toThrow('unknown movement label: X');
  });
});

describe('fromMermaid error paths', () => {
  test('throws when no initial state (double-paren node) is present', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0","1"]]',
      '  s0(((halt)))',
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow('fromMermaid: no initial state');
  });

  test('throws on a malformed edge label (missing arrow)', () => {
    const mermaid = [
      'flowchart TD',
      '  s1(("entry"))',
      '  s0(((halt)))',
      '  s1 -- "no-arrow-label" --> s0',
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow('malformed edge label');
  });

  test('throws on a malformed command part (missing slash)', () => {
    const mermaid = [
      'flowchart TD',
      '  s1(("entry"))',
      '  s0(((halt)))',
      '  s1 -- "* → noslash" --> s0',
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow('malformed command part');
  });
});

describe('fromMermaid ensureNode update branches', () => {
  // The defensive update branches inside ensureNode (when a node id is
  // declared more than once) only fire if the same id appears in multiple
  // node-declaration lines. Synthetic but valid input.
  test('a later regular-node declaration updates the name of an already-created initial node', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s1(("entry"))',  // initial — creates s1 with name="entry"
      '  s1["renamed"]',   // regular — fires the name-update branch
      '  s0(((halt)))',
    ].join('\n');

    const graph = fromMermaid(mermaid);

    expect(graph.nodes[1].name).toBe('renamed');
  });

  test('a later halt-node declaration updates isHalt of an already-created node', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s1(("entry"))',     // initial — creates s1 with isHalt=false
      '  s1(((halt)))',       // halt — fires the isHalt-update branch
      '  s0(((halt)))',
    ].join('\n');

    const graph = fromMermaid(mermaid);

    expect(graph.nodes[1].isHalt).toBe(true);
  });
});

// Pin the exact toMermaid output shown in packages/machine/README.md so the
// docs example can't drift away from real engine behavior. If this test
// fails after a refactor, update both the engine and the README in lockstep.
describe('README example: toMermaid output is stable', () => {
  test('the State shown in the README emits the documented Mermaid string', () => {
    const alphabet = new Alphabet([' ', '0', '1', '$']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['1'])]: {command: {symbol: '0', movement: movements.right}},
      [tapeBlock.symbol(['$'])]: {command: {movement: movements.left}, nextState: haltState},
    }, 'name');

    const expected = [
      'flowchart TD',
      '%% alphabets: [[" ","0","1","$"]]',
      '  s0(((halt)))',
      '  s1(("name"))',
      '  s1 -- "1 → 0/R" --> s1',
      '  s1 -- "$ → ·/L" --> s0',
    ].join('\n');

    expect(toMermaid(State.toGraph(s, tapeBlock))).toBe(expected);
  });
});

// Tests for the engine-generated Mermaid blocks shown (in <details>) in the
// READMEs. Each test asserts the expected lines are present; we don't pin
// state IDs as exact values because they auto-increment globally and depend
// on test ordering. The test catches engine emit-format changes (e.g. if
// "b → */R" notation drifts) without being fragile to ID assignment.
import Reference from '../classes/Reference';
import {ifOtherSymbol} from '../classes/State';

describe('README diagrams: engine-generated outputs', () => {
  function expectAllLines(output: string, lines: string[]) {
    for (const line of lines) {
      expect(output).toContain(line);
    }
  }

  test('Quick Start ("replaceB" machine, root + machine README)', () => {
    const alphabet = new Alphabet([' ', 'a', 'b', 'c', '*']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const initialState = new State({
      [tapeBlock.symbol(['b'])]: {command: [{symbol: '*', movement: movements.right}]},
      [tapeBlock.symbol([alphabet.blankSymbol])]: {command: [{movement: movements.left}], nextState: haltState},
      [ifOtherSymbol]: {command: [{movement: movements.right}]},
    }, 'replaceB');

    const output = toMermaid(State.toGraph(initialState, tapeBlock));

    expectAllLines(output, [
      'flowchart TD',
      '%% alphabets: [[" ","a","b","c","*"]]',
      '(((halt)))',
      '(("replaceB"))',
      '"b → */R"',
      '"- → ·/L"',
      '"* → ·/R"',
    ]);
  });

  test('Reference cycle (a ↔ b, machine README)', () => {
    const alphabet = new Alphabet([' ', 'x', 'y']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const ref = new Reference();
    const a = new State({[symbol(['x'])]: {nextState: ref}}, 'a');
    const b = new State({[symbol(['y'])]: {nextState: a}}, 'b');
    ref.bind(b);

    const output = toMermaid(State.toGraph(a, tapeBlock));

    expectAllLines(output, [
      'flowchart TD',
      '%% alphabets: [[" ","x","y"]]',
      '(("a"))', // a is the initial state passed to toGraph → round
      '["b"]', // b is reachable from a → square
      '"x → ·/S"',
      '"y → ·/S"',
    ]);
  });

  test('withOverriddenHaltState BEFORE (scanToX standalone, machine README)', () => {
    const alphabet = new Alphabet([' ', 'a', 'b', 'X']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const scanToX = new State({
      [symbol(['X'])]: {nextState: haltState},
      [ifOtherSymbol]: {command: {movement: movements.right}},
    }, 'scanToX');

    const output = toMermaid(State.toGraph(scanToX, tapeBlock));

    expectAllLines(output, [
      'flowchart TD',
      '%% alphabets: [[" ","a","b","X"]]',
      '(((halt)))',
      '(("scanToX"))',
      '"X → ·/S"',
      '"* → ·/R"',
    ]);
  });

  test('withOverriddenHaltState AFTER (scanThenErase, machine README) — emits the onHalt dotted edge', () => {
    const alphabet = new Alphabet([' ', 'a', 'b', 'X']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const scanToX = new State({
      [symbol(['X'])]: {nextState: haltState},
      [ifOtherSymbol]: {command: {movement: movements.right}},
    }, 'scanToX');
    const eraseHere = new State({
      [ifOtherSymbol]: {command: {symbol: symbolCommands.erase}, nextState: haltState},
    }, 'eraseHere');
    const scanThenErase = scanToX.withOverriddenHaltState(eraseHere);

    const output = toMermaid(State.toGraph(scanThenErase, tapeBlock));

    expectAllLines(output, [
      'flowchart TD',
      '%% alphabets: [[" ","a","b","X"]]',
      '(((halt)))',
      '["scanToX"]', // original scanToX is reachable from the wrapper → square
      '["eraseHere"]', // eraseHere is reachable via onHalt → square
      '(("scanToX>eraseHere"))', // wrapper is the initial state → round
      '"* → ⌫/S"', // eraseHere's erase command
      '-. onHalt .->', // the dotted override-halt edge — engine's static fingerprint of the override
    ]);
  });
});
