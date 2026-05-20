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

  test('"other symbol" → "∗" (whole-state ifOtherSymbol)', () => {
    expect(decodePatternDescription('other symbol', alphabets)).toBe('∗');
  });

  test('literal cell wraps in single quotes', () => {
    expect(decodePatternDescription('[["0"]]', alphabets)).toBe("'0'");
  });

  test('per-cell null → "∗"', () => {
    expect(decodePatternDescription('[[null]]', alphabets)).toBe('∗');
  });

  test('cell equal to tape blank → "-"', () => {
    expect(decodePatternDescription('[[" "]]', alphabets)).toBe('-');
  });

  test('multi-tape pattern joins quoted cells with ","', () => {
    expect(decodePatternDescription(
      '[["0","a"]]',
      [[' ', '0', '1'], [' ', 'a', 'b']],
    )).toBe("'0','a'");
  });

  test('alternative patterns join with "|"', () => {
    expect(decodePatternDescription('[["0"],["1"]]', alphabets)).toBe("'0'|'1'");
  });

  test('literal "*" is quoted (distinguishes from per-cell ifOtherSymbol marker)', () => {
    expect(decodePatternDescription('[["*"]]', [[' ', '*', 'x']])).toBe("'*'");
  });

  test('literal "," is quoted (distinguishes from cell separator)', () => {
    expect(decodePatternDescription('[[","]]', [[' ', ',', 'x']])).toBe("','");
  });

  test('literal "|" is quoted (distinguishes from alternative separator)', () => {
    expect(decodePatternDescription('[["|"]]', [[' ', '|', 'x']])).toBe("'|'");
  });

  test('backslash inside quotes is escaped as "\\\\"', () => {
    expect(decodePatternDescription('[["\\\\"]]', [[' ', '\\', 'x']])).toBe("'\\\\'");
  });

  test('literal apostrophe is escaped inside quotes as \\\'', () => {
    expect(decodePatternDescription('[["\'"]]', [[' ', "'", 'x']])).toBe("'\\\''");
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
    [(movements.left as symbol).description, '←'],
    [(movements.right as symbol).description, '→'],
    [(movements.stay as symbol).description, '⇹'],
  ])('%s → %s', (description, expected) => {
    expect(decodeMovement(description)).toBe(expected);
  });

  test('unknown movement description → returned as-is', () => {
    expect(decodeMovement('some unknown movement')).toBe('some unknown movement');
  });
});

describe('decodeWriteSymbol', () => {
  test('symbolCommands.keep → "K"', () => {
    expect(decodeWriteSymbol(symbolCommands.keep)).toBe('K');
  });

  test('symbolCommands.erase → "E"', () => {
    expect(decodeWriteSymbol(symbolCommands.erase)).toBe('E');
  });

  test('literal string is wrapped in single quotes', () => {
    expect(decodeWriteSymbol('0')).toBe("'0'");
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
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false},
        1: {
          id: 1, name: 'entry', isHalt: false, overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false,
          transitions: [
            {pattern: '0', command: [{symbol: 'K', movement: '→'}], nextStateId: 1, id: "test-edge"},
            {pattern: '1', command: [{symbol: 'K', movement: '⇹'}], nextStateId: 0, id: "test-edge"},
          ],
        },
      },
    });

    expect(out.startsWith('flowchart TD')).toBe(true);
    expect(out).toContain('%% alphabets: [[" ","0","1"]]');
    expect(out).toContain('s0(((halt)))');
    expect(out).toContain('s1["entry"]');
    expect(out).toContain('idle([idle])');
    expect(out).toContain('idle -. enter .-> s1');
    expect(out).toContain('s1 -- "0 → K/→" --> s1');
    expect(out).toContain('s1 -- "1 → K/⇹" --> s0');
  });

  test('renders dotted onHalt edge when overriddenHaltStateId is set', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false},
        1: {id: 1, name: 'wrapper', isHalt: false, transitions: [], overriddenHaltStateId: 0, isWrapped: false, isClonedHalt: false},
      },
    });

    expect(out).toContain('s1 -. onHalt .-> s0');
  });

  test('non-initial, non-halt node uses square bracket shape', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false},
        1: {id: 1, name: 'entry', isHalt: false, transitions: [], overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false},
        2: {id: 2, name: 'helper', isHalt: false, transitions: [], overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false},
      },
    });

    expect(out).toContain('s2["helper"]');
  });

  test('multi-tape command uses "," to separate per-tape ops', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0'], [' ', 'a']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false},
        1: {
          id: 1, name: 'entry', isHalt: false, overriddenHaltStateId: null, isWrapped: false, isClonedHalt: false,
          transitions: [{
            pattern: '0,a',
            command: [{symbol: '0', movement: '→'}, {symbol: 'a', movement: '←'}],
            nextStateId: 0,
            id: 'test-edge',
          }],
        },
      },
    });

    expect(out).toContain('"0,a → 0/→,a/←"');
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
    expect(parsePatternString('∗', [[' ', '0']])).toBeNull();
  });

  test('per-cell `∗` becomes null', () => {
    // Multi-tape pattern where one cell is per-cell ifOtherSymbol.
    expect(parsePatternString("'0',∗", [[' ', '0'], [' ', 'a']])).toEqual([['0', null]]);
  });

  test('per-cell `-` becomes the tape blank symbol', () => {
    expect(parsePatternString("-,'a'", [[' ', '0'], [' ', 'a']])).toEqual([[' ', 'a']]);
  });
});

describe('parseMovementLabel', () => {
  test('maps ←/→/⇹ to upstream movement symbols', () => {
    expect(parseMovementLabel('←')).toBe(movements.left);
    expect(parseMovementLabel('→')).toBe(movements.right);
    expect(parseMovementLabel('⇹')).toBe(movements.stay);
  });

  test('throws on unknown label', () => {
    expect(() => parseMovementLabel('X')).toThrow('unknown movement label: X');
  });
});

describe('fromMermaid error paths', () => {
  test('throws when no `idle -. enter .-> sN` arrow is present', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0","1"]]',
      '  s0(((halt)))',
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow('fromMermaid: no `idle -. enter .-> sN` arrow');
  });

  test('throws on a malformed edge label (missing arrow)', () => {
    const mermaid = [
      'flowchart TD',
      '  s1["entry"]',
      '  s0(((halt)))',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      '  s1 -- "no-arrow-label" --> s0',
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow('malformed edge label');
  });

  test('throws on a malformed command part (missing slash)', () => {
    const mermaid = [
      'flowchart TD',
      '  s1["entry"]',
      '  s0(((halt)))',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      '  s1 -- "* → noslash" --> s0',
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow('malformed command part');
  });
});

describe('fromMermaid ensureNode update branches', () => {
  // The defensive update branches inside ensureNode (when a node id is
  // declared more than once) only fire if the same id appears in multiple
  // node-declaration lines. Synthetic but valid input.
  test('a later regular-node declaration updates the name of an already-created node', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s1["entry"]',     // creates s1 with name="entry"
      '  s1["renamed"]',   // fires the name-update branch
      '  s0(((halt)))',
      '  idle([idle])',
      '  idle -. enter .-> s1',
    ].join('\n');

    const graph = fromMermaid(mermaid);

    expect(graph.nodes[1].name).toBe('renamed');
  });

  test('a later halt-node declaration updates isHalt of an already-created node', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s1["entry"]',     // creates s1 with isHalt=false
      '  s1(((halt)))',    // halt — fires the isHalt-update branch
      '  s0(((halt)))',
      '  idle([idle])',
      '  idle -. enter .-> s1',
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
      '  s1["name"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      "  s1 -- \"'1' → '0'/→\" --> s1",
      "  s1 -- \"'$' → K/←\" --> s0",
    ].join('\n');

    expect(toMermaid(State.toGraph(s, tapeBlock))).toBe(expected);
  });
});

// Tests for the engine-generated Mermaid blocks shown (in <details>) in the
// READMEs. Each test asserts the expected lines are present; we don't pin
// state IDs as exact values because they auto-increment globally and depend
// on test ordering. The test catches engine emit-format changes (e.g. if
// "b → */→" notation drifts) without being fragile to ID assignment.
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
      '["replaceB"]', // initial — square (no longer round in v7; idle arrow signals entry)
      'idle([idle])',
      'idle -. enter .->',
      "\"'b' → '*'/→\"",
      '"- → K/←"',
      '"∗ → K/→"',
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
      '["a"]', // a is the initial state — square (idle arrow signals entry)
      '["b"]', // b is reachable from a → square
      'idle([idle])',
      'idle -. enter .->',
      "\"'x' → K/⇹\"",
      "\"'y' → K/⇹\"",
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
      '["scanToX"]', // initial — square (idle arrow signals entry)
      'idle([idle])',
      'idle -. enter .->',
      "\"'X' → K/⇹\"",
      '"∗ → K/→"',
    ]);
  });

  test('withOverriddenHaltState AFTER (scanThenErase, machine README) — emits the v7 halt-frame subgraph', () => {
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
      '(((halt)))', // real halt outside any subgraph
      '["eraseHere"]', // override is a regular [name] node
      '[["scanToX"]]', // wrapper-collapsed bare uses subroutine shape inside the subgraph
      'subgraph w_', // halt-frame subgraph wraps the bare + its cloned halt
      '"halt frame"', // subgraph label
      'idle([idle])', // pre-execution sentinel — always emitted
      'idle -. enter .->', // labeled dotted enter arrow points at the initial state
      '"∗ → E/⇹"', // eraseHere's erase command
      '-. onHalt .->', // the dotted override-halt edge — wrapper's catch-and-redirect, crosses the subgraph border
    ]);
  });
});
