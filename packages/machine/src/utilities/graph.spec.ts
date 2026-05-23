import {
  decodeMovement,
  decodePatternDescription,
  decodeWriteSymbol,
  parseMovementLabel,
  parsePatternString,
  parseWriteSymbolLabel,
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

  test('literal cell wraps in single quotes', () => {
    expect(decodePatternDescription('[["0"]]', alphabets)).toBe("'0'");
  });

  test('per-cell null → "*"', () => {
    expect(decodePatternDescription('[[null]]', alphabets)).toBe('*');
  });

  test('cell equal to tape blank → "B"', () => {
    expect(decodePatternDescription('[[" "]]', alphabets)).toBe('B');
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
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: []},
        1: {
          id: 1, name: 'entry', isHalt: false, overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: [],
          transitions: [
            {pattern: "'0'", command: [{symbol: 'K', movement: 'R'}], nextStateId: 1, id: "test-edge"},
            {pattern: "'1'", command: [{symbol: 'K', movement: 'S'}], nextStateId: 0, id: "test-edge"},
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
    expect(out).toContain("s1 -- \"['0'] → [K]/[R]\" --> s1");
    expect(out).toContain("s1 -- \"['1'] → [K]/[S]\" --> s0");
  });

  test('renders wrapper-to-override solid arrow when overriddenHaltStateId is set', () => {
    // Under the v7 callable-subtree model, wrapper → override is a regular
    // solid `-->` (the new convention reserves bold/dotted for `call`/`return`/
    // `halt`). The retired `-. onHalt .->` keyword no longer appears.
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: []},
        1: {id: 1, name: 'wrapper', isHalt: false, transitions: [], overriddenHaltStateId: 0, isHaltMarker: false, isWrapper: true, bareStateId: null, frameId: null, tags: []},
      },
    });

    expect(out).toContain('s1 --> s0');
    expect(out).not.toContain('onHalt');
  });

  test('non-initial, non-halt node uses square bracket shape', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: []},
        1: {id: 1, name: 'entry', isHalt: false, transitions: [], overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: []},
        2: {id: 2, name: 'helper', isHalt: false, transitions: [], overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: []},
      },
    });

    expect(out).toContain('s2["helper"]');
  });

  test('multi-tape command uses "," to separate per-tape ops', () => {
    const out = toMermaid({
      initialId: 1,
      alphabets: [[' ', '0'], [' ', 'a']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: []},
        1: {
          id: 1, name: 'entry', isHalt: false, overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: [],
          transitions: [{
            pattern: "'0','a'",
            command: [{symbol: "'0'", movement: 'R'}, {symbol: "'a'", movement: 'L'}],
            nextStateId: 0,
            id: 'test-edge',
          }],
        },
      },
    });

    expect(out).toContain("\"['0','a'] → ['0','a']/[R,L]\"");
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
    expect(parsePatternString("'0',*", [[' ', '0'], [' ', 'a']])).toEqual([['0', null]]);
  });

  test('per-cell `B` becomes the tape blank symbol', () => {
    expect(parsePatternString("B,'a'", [[' ', '0'], [' ', 'a']])).toEqual([[' ', 'a']]);
  });

  test('fallback: cell that is not marker/blank/quoted is returned as-is', () => {
    // Defensive — the parser doesn't throw on unexpected cells; it returns
    // them as-is, so consumer code can decide whether to reject.
    expect(parsePatternString('Q', [[' ', '0']])).toEqual([['Q']]);
  });

  test('blank-marker fallback when alphabet for the tape is missing', () => {
    // Defensive: if alphabets[tapeIx] is undefined, returns the marker
    // string itself rather than throwing.
    expect(parsePatternString('B', [])).toEqual([['B']]);
  });
});

describe('parseWriteSymbolLabel', () => {
  test('maps K/E to upstream symbolCommands', () => {
    expect(parseWriteSymbolLabel('K')).toBe(symbolCommands.keep);
    expect(parseWriteSymbolLabel('E')).toBe(symbolCommands.erase);
  });

  test('strips single quotes from a literal alphabet symbol', () => {
    expect(parseWriteSymbolLabel("'X'")).toBe('X');
  });

  test('fallback: label that is not K/E/quoted is returned as-is', () => {
    // Defensive — same shape as parsePatternString's fallback.
    expect(parseWriteSymbolLabel('Z')).toBe('Z');
  });
});

describe('parseMovementLabel', () => {
  test('maps ←/R/S to upstream movement symbols', () => {
    expect(parseMovementLabel('L')).toBe(movements.left);
    expect(parseMovementLabel('R')).toBe(movements.right);
    expect(parseMovementLabel('S')).toBe(movements.stay);
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
      '  s1 -- "[*] → noslash" --> s0',
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow('malformed command label');
  });

  test('rejects compact in-bracket alternation (must use per-pattern brackets)', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0","1"]]',
      '  s0(((halt)))',
      '  s1["entry"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      "  s1 -- \"['0'|'1'] → [K]/[R]\" --> s0", // compact alternation — should fail
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow(/compact in-bracket alternation/);
  });

  test('rejects `|` inside a write/move bracket too (commands have no alternation)', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0","1"]]',
      '  s0(((halt)))',
      '  s1["entry"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      "  s1 -- \"['0'] → [K|E]/[R]\" --> s0", // `|` in writes — should fail
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow(/compact in-bracket alternation/);
  });

  test('throws when the read label has no bracketed list', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0","1"]]',
      '  s0(((halt)))',
      '  s1["entry"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      '  s1 -- "X → [K]/[S]" --> s0', // no `[…]` in the read part at all
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow(/no bracketed read-list/);
  });

  test('throws on write/move cell-count mismatch', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0","1"]]',
      '  s0(((halt)))',
      '  s1["entry"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      "  s1 -- \"['0'] → [K,K]/[R]\" --> s0", // 2 writes, 1 move
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow(/write-cells.*move-cells.*mismatch/);
  });

  test('throws on a movement bracket that opens but never closes', () => {
    // Targets `stripBrackets`'s own throw: writes are well-formed (`[K]`) so
    // the `slashIx` guard accepts the label as `[…]/[…]`-shaped, but the
    // movement segment `[S` opens without a closing `]`. `stripBrackets`
    // catches this even though the earlier label-shape guard didn't.
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s0(((halt)))',
      '  s1["entry"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      "  s1 -- \"['0'] → [K]/[S\" --> s0", // moves part `[S` is missing the closing bracket
    ].join('\n');

    expect(() => fromMermaid(mermaid)).toThrow(/malformed bracketed list/);
  });

  test('parses backslash-escaped chars inside a bracket (e.g. literal `|` as `\\|`)', () => {
    // `stripBrackets` walks the inner content character-by-character; when it
    // hits `\`, it skips the next char (so `\|` is a literal pipe, not the
    // alternation separator). Exercises the escape branch in stripBrackets.
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","|"]]',
      '  s0(((halt)))',
      '  s1["x"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      "  s1 -- \"['\\|'] → [K]/[S]\" --> s0", // pattern reads `'\|'` (literal pipe)
    ].join('\n');

    expect(() => fromMermaid(mermaid)).not.toThrow();
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

  test('`class` line referencing an undeclared node creates it with a fallback name', () => {
    // Defensive path: `ensureNode(id, {tags: [...]})` called without
    // `opts.name` for a node that pass 1 didn't declare. Fires the
    // `opts.name ?? mermaidIdFor(id)` fallback. Real `toMermaid` output
    // never produces this (every node referenced by a `class` line is
    // declared first), but hand-edited Mermaid can.
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s0(((halt)))',
      '  s1["entry"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      "  s1 -- \"['0'] → [K]/[S]\" --> s0",
      '  class s99 tag_orphan', // s99 isn't declared anywhere else
    ].join('\n');

    const graph = fromMermaid(mermaid);

    expect(graph.nodes[99]).toBeDefined();
    expect(graph.nodes[99].name).toBe('s99'); // fallback to mermaidIdFor(99)
    expect(graph.nodes[99].tags).toEqual(['orphan']);
  });

  test('unlabeled `sN --> sM` from a non-wrapper source falls through to labeled-regex (no-op)', () => {
    // Defensive path: the wrapper-override regex matches `sN --> sM`
    // (unlabeled) only when the source is a wrapper. If hand-edited input
    // has `sN --> sM` with N being a regular state, the wrapper-override
    // branch doesn't fire (the `if (nodes[fromId].isWrapper)` guard) and
    // the labeled-regex below also doesn't match (no label). No edge is
    // added, no overriddenHaltStateId set. Documented as malformed-input
    // behavior.
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s0(((halt)))',
      '  s1["entry"]',     // s1 is a regular state, NOT a wrapper
      '  idle([idle])',
      '  idle -. enter .-> s1',
      '  s1 --> s0',       // unlabeled — wrapper-override regex matches but isWrapper is false
    ].join('\n');

    const graph = fromMermaid(mermaid);

    // No transition added, no overriddenHaltStateId set — the line is
    // silently ignored.
    expect(graph.nodes[1].transitions).toHaveLength(0);
    expect(graph.nodes[1].overriddenHaltStateId).toBeNull();
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
      "  s1 -- \"['1'] → ['0']/[R]\" --> s1",
      "  s1 -- \"['$'] → [K]/[L]\" --> s0",
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
      '["replaceB"]', // initial — square (no longer round in v7; idle arrow signals entry)
      'idle([idle])',
      'idle -. enter .->',
      "\"['b'] → ['*']/[R]\"",
      '"[B] → [K]/[L]"',
      '"[*] → [K]/[R]"',
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
      "\"['x'] → [K]/[S]\"",
      "\"['y'] → [K]/[S]\"",
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
      "\"['X'] → [K]/[S]\"",
      '"[*] → [K]/[R]"',
    ]);
  });

  test('withOverriddenHaltState AFTER (scanThenErase, machine README) — emits the v7 callable-subtree shape', () => {
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
      '[["scanToX(eraseHere)"]]', // wrapper uses [[…]] subroutine shape (composite name)
      '["scanToX"]', // bare uses regular [name] shape inside the subgraph
      'subgraph w_', // callable-subtree subgraph wraps the bare + its halt marker
      'callable subtree of scanToX', // subgraph label
      'idle([idle])', // pre-execution sentinel — always emitted
      'idle -. enter .->', // labeled dotted enter arrow points at the wrapper
      '"[*] → [E]/[S]"', // eraseHere's erase command
      '== "call" ==>', // wrapper-to-bare bold call arrow
      '-. "return" .->', // frame-to-wrapper dotted return arrow
    ]);

    // Retired keywords — must NOT appear under the new convention.
    expect(output).not.toContain('onHalt');
    expect(output).not.toContain('halt frame');
  });
});

// Spec Example 6 "Shared body state" + worked example 2 (direct entry into the
// union frame): two wrappers W1, W2 with bares A, B whose reach sets overlap
// on a shared body state X, plus a dispatcher with a direct entry to X (a
// non-wrapper transition into the frame).
//
// Exercises:
//   - union-find on overlapping reach sets (State.ts ufFind multi-step walk +
//     path compression + ufUnion)
//   - `callable scope: A ∪ B` subgraph label (graphFormats frameBareNames sort)
//   - `-. "halt" .->` demand-emit arrow (graphFormats hasNonWrapperEntry path)
describe('callable-subtree: shared body state forces a union frame', () => {
  test('two bares sharing a body state merge into one frame; non-wrapper entry triggers halt arrow', () => {
    const alphabet = new Alphabet([' ', '1', '2', '3', 'X']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    // Shared body state X — halts on any symbol.
    const X = new State({
      [ifOtherSymbol]: {command: {movement: movements.stay}, nextState: haltState},
    }, 'X');

    // Bare A — transitions to X.
    const A = new State({
      [ifOtherSymbol]: {command: {movement: movements.right}, nextState: X},
    }, 'A');

    // Bare B — also transitions to X (so reach(A) ∩ reach(B) ⊇ {X}, union triggers).
    const B = new State({
      [ifOtherSymbol]: {command: {movement: movements.right}, nextState: X},
    }, 'B');

    // Targets for the wrappers.
    const target1 = new State({
      [ifOtherSymbol]: {command: {movement: movements.stay}, nextState: haltState},
    }, 't1');
    const target2 = new State({
      [ifOtherSymbol]: {command: {movement: movements.stay}, nextState: haltState},
    }, 't2');

    const W1 = A.withOverriddenHaltState(target1);
    const W2 = B.withOverriddenHaltState(target2);

    // Dispatcher chooses path by symbol: '1' → W1, '2' → W2, '3' → X (direct
    // entry into the union frame, the non-wrapper entry path that triggers
    // the `-. "halt" .->` arrow).
    const dispatcher = new State({
      [symbol(['1'])]: {command: {movement: movements.stay}, nextState: W1},
      [symbol(['2'])]: {command: {movement: movements.stay}, nextState: W2},
      [symbol(['3'])]: {command: {movement: movements.stay}, nextState: X},
    }, 'dispatcher');

    const graph = State.toGraph(dispatcher, tapeBlock);

    // A and B should share a frameId (union-find merged them).
    const nodeA = graph.nodes[A.id];
    const nodeB = graph.nodes[B.id];
    const nodeX = graph.nodes[X.id];

    expect(nodeA.frameId).not.toBeNull();
    expect(nodeA.frameId).toBe(nodeB.frameId);
    expect(nodeX.frameId).toBe(nodeA.frameId);

    // Frame id = smallest bare-id in the component (deterministic canonical).
    expect(nodeA.frameId).toBe(Math.min(A.id, B.id));

    // Emit: one union frame with `callable scope: A ∪ B` label, halt arrow
    // present (cross-subgraph dispatcher → X entry).
    const out = toMermaid(graph);

    expect(out).toContain('callable scope: A ∪ B');
    expect(out).toMatch(/w_\d+ -\. "halt" \.-> s0/);
    // Both wrappers call their respective bares.
    expect(out).toMatch(/s\d+ == "call" ==> s\d+/g);
  });
});

// Spec-doc invariants + snapshots for the three worked union shapes in
// `docs/superpowers/specs/2026-05-21-halt-frame-transitive-closure.md`'s
// "Worked union shapes — engine-emitted Mermaid" section.
//
// The spec doc claims its Mermaid blocks are real engine emit (not
// hand-drawn). These tests enforce that claim two ways:
//   1. Invariant tests assert the structural rules the model promises
//      (frame merging, ribbon collapse, demand-emit arrows). Named tests
//      → failures point at the broken rule, not at a byte diff.
//   2. Snapshot tests (with id normalization, same shape as the
//      round-trip test) pin the cosmetic emit. Failures here catch drift
//      between the doc and the engine — either rerun the probe + update
//      the doc, or revert the unintended emit change.
//
// Normalize all `s\d+`, `c\d+`, `w_\d+` to `sX`/`cX`/`w_X` since global
// State.#id is shared across tests and isn't stable across test-ordering
// changes. Same normalization used by `test/round-trip.spec.ts`.
function stripIds(mermaid: string): string {
  return mermaid
    .replace(/\bs\d+\b/g, 'sX')
    .replace(/\bc\d+\b/g, 'cX')
    .replace(/\bw_\d+\b/g, 'w_X');
}

describe('spec doc: worked union shapes are real engine emit', () => {
  // Reusable target factory — each test needs N small halting States as
  // wrapper targets. Inlining the State construction directly would clutter
  // each test.
  const haltingTarget = (name: string) => new State({
    [ifOtherSymbol]: {command: {movement: movements.stay}, nextState: haltState},
  }, name);

  test('Case 1: A ∪ B (two bares, one shared body state X)', () => {
    const alphabet = new Alphabet([' ', '1', '2']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const X = haltingTarget('X');
    const A = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: X}}, 'A');
    const B = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: X}}, 'B');
    const W1 = A.withOverriddenHaltState(haltingTarget('t1'));
    const W2 = B.withOverriddenHaltState(haltingTarget('t2'));
    const dispatcher = new State({
      [symbol(['1'])]: {command: {movement: movements.stay}, nextState: W1},
      [symbol(['2'])]: {command: {movement: movements.stay}, nextState: W2},
    }, 'dispatcher');

    const graph = State.toGraph(dispatcher, tapeBlock);
    const out = toMermaid(graph);

    // Invariants — A, B distinct bares so call arrows are NOT ribbon-collapsed
    // (the `& ` ribbon on calls collapses only wrappers SHARING a bare).
    expect(graph.nodes[A.id].frameId).toBe(graph.nodes[B.id].frameId);
    expect(graph.nodes[X.id].frameId).toBe(graph.nodes[A.id].frameId);
    expect(out).toContain('"callable scope: A ∪ B"');
    expect(out.match(/== "call" ==>/g)).toHaveLength(2); // one per wrapper
    expect(out).toMatch(/w_\d+ -\. "return" \.-> s\d+ & s\d+/); // ribbon on return side
    expect(out).not.toMatch(/-\. "halt" \.->/); // no non-wrapper entry to frame

    // Snapshot (id-normalized). Doubles as the cosmetic-drift detector for
    // the matching block in the spec doc.
    const expected = [
      'flowchart TD',
      '%% alphabets: [[" ","1","2"]]',
      '  sX(((halt)))',
      '  sX["t1"]',
      '  sX["t2"]',
      '  sX["dispatcher"]',
      '  sX[["A(t1)"]]',
      '  sX[["B(t2)"]]',
      '  idle([idle])',
      '  subgraph w_X["callable scope: A ∪ B"]',
      '    sX["X"]',
      '    sX["A"]',
      '    sX["B"]',
      '    cX(((halt)))',
      '  end',
      '  idle -. enter .-> sX',
      '  sX == "call" ==> sX',
      '  sX == "call" ==> sX',
      '  w_X -. "return" .-> sX & sX',
      '  sX --> sX',
      '  sX --> sX',
      '  sX -- "[*] → [K]/[S]" --> cX',
      '  sX -- "[*] → [K]/[R]" --> sX',
      '  sX -- "[*] → [K]/[R]" --> sX',
      '  sX -- "[*] → [K]/[S]" --> sX',
      '  sX -- "[*] → [K]/[S]" --> sX',
      "  sX -- \"['1'] → [K]/[S]\" --> sX",
      "  sX -- \"['2'] → [K]/[S]\" --> sX",
    ].join('\n');

    expect(stripIds(out)).toBe(expected);
  });

  test('Case 2: A ∪ B ∪ C (three bares, all share X directly)', () => {
    const alphabet = new Alphabet([' ', '1', '2', '3']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const X = haltingTarget('X');
    const A = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: X}}, 'A');
    const B = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: X}}, 'B');
    const C = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: X}}, 'C');
    const W1 = A.withOverriddenHaltState(haltingTarget('t1'));
    const W2 = B.withOverriddenHaltState(haltingTarget('t2'));
    const W3 = C.withOverriddenHaltState(haltingTarget('t3'));
    const dispatcher = new State({
      [symbol(['1'])]: {command: {movement: movements.stay}, nextState: W1},
      [symbol(['2'])]: {command: {movement: movements.stay}, nextState: W2},
      [symbol(['3'])]: {command: {movement: movements.stay}, nextState: W3},
    }, 'dispatcher');

    const graph = State.toGraph(dispatcher, tapeBlock);
    const out = toMermaid(graph);

    // Invariants
    const frameA = graph.nodes[A.id].frameId;

    expect(frameA).not.toBeNull();
    expect(graph.nodes[B.id].frameId).toBe(frameA);
    expect(graph.nodes[C.id].frameId).toBe(frameA);
    expect(graph.nodes[X.id].frameId).toBe(frameA);
    expect(out).toContain('"callable scope: A ∪ B ∪ C"');
    expect(out.match(/== "call" ==>/g)).toHaveLength(3); // one per wrapper, no ribbon
    expect(out).toMatch(/w_\d+ -\. "return" \.-> s\d+ & s\d+ & s\d+/);
    expect(out).not.toMatch(/-\. "halt" \.->/);

    const expected = [
      'flowchart TD',
      '%% alphabets: [[" ","1","2","3"]]',
      '  sX(((halt)))',
      '  sX["t1"]',
      '  sX["t2"]',
      '  sX["t3"]',
      '  sX["dispatcher"]',
      '  sX[["A(t1)"]]',
      '  sX[["B(t2)"]]',
      '  sX[["C(t3)"]]',
      '  idle([idle])',
      '  subgraph w_X["callable scope: A ∪ B ∪ C"]',
      '    sX["X"]',
      '    sX["A"]',
      '    sX["B"]',
      '    sX["C"]',
      '    cX(((halt)))',
      '  end',
      '  idle -. enter .-> sX',
      '  sX == "call" ==> sX',
      '  sX == "call" ==> sX',
      '  sX == "call" ==> sX',
      '  w_X -. "return" .-> sX & sX & sX',
      '  sX --> sX',
      '  sX --> sX',
      '  sX --> sX',
      '  sX -- "[*] → [K]/[S]" --> cX',
      '  sX -- "[*] → [K]/[R]" --> sX',
      '  sX -- "[*] → [K]/[R]" --> sX',
      '  sX -- "[*] → [K]/[R]" --> sX',
      '  sX -- "[*] → [K]/[S]" --> sX',
      '  sX -- "[*] → [K]/[S]" --> sX',
      '  sX -- "[*] → [K]/[S]" --> sX',
      "  sX -- \"['1'] → [K]/[S]\" --> sX",
      "  sX -- \"['2'] → [K]/[S]\" --> sX",
      "  sX -- \"['3'] → [K]/[S]\" --> sX",
    ].join('\n');

    expect(stripIds(out)).toBe(expected);
  });

  test('Case 3: (A ∪ B) ∪ C — transitive (A bridges B and C via X and Y)', () => {
    const alphabet = new Alphabet([' ', '1', '2', '3']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    const X = haltingTarget('X');
    const Y = haltingTarget('Y');
    // A has TWO transitions — one to X (overlapping B's reach), one to Y
    // (overlapping C's reach). B and C share nothing directly.
    const A = new State({
      [symbol(['1'])]: {command: {movement: movements.right}, nextState: X},
      [symbol(['2'])]: {command: {movement: movements.right}, nextState: Y},
    }, 'A');
    const B = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: X}}, 'B');
    const C = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: Y}}, 'C');
    const W1 = A.withOverriddenHaltState(haltingTarget('t1'));
    const W2 = B.withOverriddenHaltState(haltingTarget('t2'));
    const W3 = C.withOverriddenHaltState(haltingTarget('t3'));
    const dispatcher = new State({
      [symbol(['1'])]: {command: {movement: movements.stay}, nextState: W1},
      [symbol(['2'])]: {command: {movement: movements.stay}, nextState: W2},
      [symbol(['3'])]: {command: {movement: movements.stay}, nextState: W3},
    }, 'dispatcher');

    const graph = State.toGraph(dispatcher, tapeBlock);
    const out = toMermaid(graph);

    // Invariants — transitive merge is the load-bearing rule.
    const frameA = graph.nodes[A.id].frameId;

    expect(frameA).not.toBeNull();
    expect(graph.nodes[B.id].frameId).toBe(frameA);
    expect(graph.nodes[C.id].frameId).toBe(frameA);
    expect(graph.nodes[X.id].frameId).toBe(frameA);
    expect(graph.nodes[Y.id].frameId).toBe(frameA); // critical: B-C don't share directly
    expect(out).toContain('"callable scope: A ∪ B ∪ C"');
    expect(out.match(/== "call" ==>/g)).toHaveLength(3);
    expect(out).toMatch(/w_\d+ -\. "return" \.-> s\d+ & s\d+ & s\d+/);
    expect(out).not.toMatch(/-\. "halt" \.->/);

    const expected = [
      'flowchart TD',
      '%% alphabets: [[" ","1","2","3"]]',
      '  sX(((halt)))',
      '  sX["t1"]',
      '  sX["t2"]',
      '  sX["t3"]',
      '  sX["dispatcher"]',
      '  sX[["A(t1)"]]',
      '  sX[["B(t2)"]]',
      '  sX[["C(t3)"]]',
      '  idle([idle])',
      '  subgraph w_X["callable scope: A ∪ B ∪ C"]',
      '    sX["X"]',
      '    sX["Y"]',
      '    sX["A"]',
      '    sX["B"]',
      '    sX["C"]',
      '    cX(((halt)))',
      '  end',
      '  idle -. enter .-> sX',
      '  sX == "call" ==> sX',
      '  sX == "call" ==> sX',
      '  sX == "call" ==> sX',
      '  w_X -. "return" .-> sX & sX & sX',
      '  sX --> sX',
      '  sX --> sX',
      '  sX --> sX',
      '  sX -- "[*] → [K]/[S]" --> cX',
      '  sX -- "[*] → [K]/[S]" --> cX',
      "  sX -- \"['1'] → [K]/[R]\" --> sX",
      "  sX -- \"['2'] → [K]/[R]\" --> sX",
      '  sX -- "[*] → [K]/[R]" --> sX',
      '  sX -- "[*] → [K]/[R]" --> sX',
      '  sX -- "[*] → [K]/[S]" --> sX',
      '  sX -- "[*] → [K]/[S]" --> sX',
      '  sX -- "[*] → [K]/[S]" --> sX',
      "  sX -- \"['1'] → [K]/[S]\" --> sX",
      "  sX -- \"['2'] → [K]/[S]\" --> sX",
      "  sX -- \"['3'] → [K]/[S]\" --> sX",
    ].join('\n');

    expect(stripIds(out)).toBe(expected);
  });
});

describe('toMermaid: tags (#186)', () => {
  test('no tags → no classDef / class lines', () => {
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 'plain');

    const out = toMermaid(State.toGraph(s, tapeBlock));

    expect(out).not.toContain('classDef');
    expect(out).not.toContain('class ');
  });

  test('one tag → one classDef + matching class assignment', () => {
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 'tagged').tag('hot');

    const out = toMermaid(State.toGraph(s, tapeBlock));

    expect(out).toMatch(/classDef tag_hot /);
    expect(out).toMatch(/class s\d+ tag_hot/);
  });

  test('multiple states sharing a tag → one classDef, comma-joined ids in class', () => {
    const alphabet = new Alphabet([' ', '0', '1']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const b = new State({
      [symbol(['1'])]: {nextState: haltState},
    }, 'b').tag('hot');
    const a = new State({
      [symbol(['0'])]: {nextState: b},
    }, 'a').tag('hot');

    const out = toMermaid(State.toGraph(a, tapeBlock));

    expect((out.match(/classDef tag_hot /g) ?? []).length).toBe(1);
    // Two states share the tag — emitted on one `class` line with
    // comma-joined ids.
    expect(out).toMatch(/class s\d+,s\d+ tag_hot/);
  });

  test('multiple tags on one state → one class line per tag', () => {
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 'tagged').tag('hot', 'sampled');

    const out = toMermaid(State.toGraph(s, tapeBlock));

    expect(out).toMatch(/classDef tag_hot /);
    expect(out).toMatch(/classDef tag_sampled /);
    expect(out).toMatch(/class s\d+ tag_hot/);
    expect(out).toMatch(/class s\d+ tag_sampled/);
  });
});

describe('fromMermaid: tags (#186)', () => {
  test('parses classDef + class lines back into GraphNode.tags', () => {
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s0(((halt)))',
      '  s1["a"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      "  s1 -- \"['0'] → [K]/[S]\" --> s0",
      '  classDef tag_hot fill:#fef3c7',
      '  class s1 tag_hot',
    ].join('\n');

    const graph = fromMermaid(mermaid);

    expect(graph.nodes[1].tags).toEqual(['hot']);
    expect(graph.nodes[0].tags).toEqual([]);
  });

  test('multi-tag round-trip preserves order', () => {
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 'rt').tag('alpha', 'beta');

    const emitted = toMermaid(State.toGraph(s, tapeBlock));
    const reparsed = fromMermaid(emitted);

    expect(reparsed.nodes[s.id].tags).toEqual(['alpha', 'beta']);
  });
});

describe('Mermaid label escaping (#194)', () => {
  test('alphabet symbol containing literal " produces parseable output', () => {
    // Repro from the issue: a write of `"` would land inside the
    // `"..."`-wrapped edge label and terminate the string early on
    // Mermaid's tokenizer.
    const alphabet = new Alphabet([' ', 'a', '"']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['a'])]: {
        command: [{symbol: '"', movement: movements.right}],
        nextState: haltState,
      },
    }, 's');

    const mermaid = toMermaid(State.toGraph(s, tapeBlock));

    // No unescaped `"` inside the edge label between the outer wrappers.
    expect(mermaid).toContain('&quot;');
    expect(mermaid).not.toMatch(/-- "[^"]*"[^"]*"[^"]*" -->/);
    // Round-trips back to a parseable graph that preserves the symbol.
    const reparsed = fromMermaid(mermaid);
    const reparsedTransitions = reparsed.nodes[s.id].transitions;
    expect(reparsedTransitions).toHaveLength(1);
    expect(reparsedTransitions[0].command[0].symbol).toBe("'\"'");
  });

  test('state name with grammar-significant chars survives round-trip', () => {
    // <, >, &, " inside a State.name. Encoded as named entities; decoded
    // verbatim on the way back.
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const name = 'A<&">B';
    const s = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, name);

    const reparsed = fromMermaid(toMermaid(State.toGraph(s, tapeBlock)));
    expect(reparsed.nodes[s.id].name).toBe(name);
  });

  test('tag name with grammar-significant chars survives round-trip', () => {
    // Tag content is escaped per-fragment so a tag containing `<br>` or
    // `,` doesn't get confused with the structural tag separators (which
    // would split the tag wrong on the way back) or with HTML tag
    // boundaries in the rendered SVG.
    //
    // The round-trip also picks up the `class tag_<sanitized>` line from
    // the emit — that adds a second copy of each tag in its sanitized
    // form (`has"quote` → `has_quote`). That's a known artifact of the
    // #186 tag-emit design, not part of #194; this test only asserts
    // that the ORIGINAL forms come back intact.
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 's').tag('a<br>b', 'has,comma', 'has"quote');

    const reparsed = fromMermaid(toMermaid(State.toGraph(s, tapeBlock)));
    expect(reparsed.nodes[s.id].tags).toEqual(
      expect.arrayContaining(['a<br>b', 'has,comma', 'has"quote']),
    );
  });

  test('newlines and C0 controls in alphabet symbols encode as numeric entities', () => {
    const alphabet = new Alphabet([' ', 'a', '\n', '']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['a'])]: {
        command: [{symbol: '\n', movement: movements.right}],
        nextState: haltState,
      },
    }, 's');

    const mermaid = toMermaid(State.toGraph(s, tapeBlock));

    // No raw newline inside the emitted line (other than the inter-line
    // separators between statements).
    const transitionLine = mermaid
      .split('\n')
      .find((l) => l.includes('-- "') && l.includes('--> '));
    expect(transitionLine).toBeDefined();
    expect(transitionLine).toContain('&#10;');

    const reparsed = fromMermaid(mermaid);
    expect(reparsed.nodes[s.id].transitions[0].command[0].symbol).toBe("'\n'");
  });

  test('bidi control in state name encodes as numeric entity', () => {
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const name = 'left‮right';
    const s = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, name);

    const mermaid = toMermaid(State.toGraph(s, tapeBlock));
    expect(mermaid).toContain('&#8238;');
    expect(mermaid).not.toContain('‮');

    const reparsed = fromMermaid(mermaid);
    expect(reparsed.nodes[s.id].name).toBe(name);
  });

  test('printable Unicode passes through unescaped (alphabet readability)', () => {
    // Cyrillic + CJK glyphs in the alphabet and state name. Alphabet
    // rejects multi-code-unit symbols (`.length === 1` check) so emoji
    // outside the BMP can't be tested at this layer — that's fine,
    // surrogate-pair handling is covered by the encoder's regex range
    // and the round-trip decode-path tests above.
    const alphabet = new Alphabet([' ', 'я', '中']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['я'])]: {
        command: [{symbol: '中', movement: movements.right}],
        nextState: haltState,
      },
    }, 'имя');

    const mermaid = toMermaid(State.toGraph(s, tapeBlock));
    expect(mermaid).toContain('имя');
    expect(mermaid).toContain('я');
    expect(mermaid).toContain('中');
    // No spurious numeric entities for printable Unicode.
    expect(mermaid).not.toMatch(/&#\d+;/);
  });

  test('callable-subtree frame label escapes the bare name', () => {
    // The frame label `callable subtree of NAME` interpolates the bare
    // state's name. Quotes in the bare name would break the
    // `subgraph w_N["..."]` declaration.
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const bare = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 'b"are');
    const wrapper = bare.withOverriddenHaltState(haltState);

    const mermaid = toMermaid(State.toGraph(wrapper, tapeBlock));
    expect(mermaid).toContain('callable subtree of b&quot;are');
    // The subgraph declaration line itself has exactly two `"`s: the
    // outer label wrappers. Any additional one would mean an unescaped
    // user `"` slipped through.
    const subgraphLine = mermaid
      .split('\n')
      .find((l) => l.trimStart().startsWith('subgraph w_'));
    expect(subgraphLine).toBeDefined();
    expect((subgraphLine!.match(/"/g) ?? []).length).toBe(2);
  });

  test('carriage return in alphabet symbol encodes as &#13;', () => {
    // Sibling of the `\n` test above — pins the second statement-terminator
    // branch in escapeMermaidLabel so coverage doesn't drift if someone
    // adds another escape category and forgets the `\r` case.
    const alphabet = new Alphabet([' ', 'a', '\r']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const s = new State({
      [tapeBlock.symbol(['a'])]: {
        command: [{symbol: '\r', movement: movements.right}],
        nextState: haltState,
      },
    }, 's');

    const mermaid = toMermaid(State.toGraph(s, tapeBlock));
    expect(mermaid).toContain('&#13;');

    const reparsed = fromMermaid(mermaid);
    expect(reparsed.nodes[s.id].transitions[0].command[0].symbol).toBe("'\r'");
  });

  test('hex numeric entity `&#xHH;` decodes (hand-edited Mermaid support)', () => {
    // `toMermaid` only emits decimal numeric entities (`&#NN;`), but
    // `fromMermaid` accepts hex too for hand-edited `.mmd` files where a
    // user might write `&#x22;` instead of `&quot;`. Pin the hex-decode
    // branch in unescapeMermaidLabel by constructing a minimal Mermaid
    // graph that uses a hex entity in a node name.
    const mermaid = [
      'flowchart TD',
      '%% alphabets: [[" ","0"]]',
      '  s0(((halt)))',
      '  s1["a&#x22;b"]',
      '  idle([idle])',
      '  idle -. enter .-> s1',
      '  s1 -- "[\'0\'] → [K]/[S]" --> s0',
    ].join('\n');

    const graph = fromMermaid(mermaid);
    expect(graph.nodes[1].name).toBe('a"b');
  });

  test('ambiguous `&amp;quot;` decodes once, not twice', () => {
    // User content that looks like a doubly-encoded entity. Single-pass
    // decode should give back the literal `&quot;` text, not `"`.
    const alphabet = new Alphabet([' ', '0']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const name = '&quot;literal&quot;';
    const s = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, name);

    const reparsed = fromMermaid(toMermaid(State.toGraph(s, tapeBlock)));
    expect(reparsed.nodes[s.id].name).toBe(name);
  });
});
