import {
  Alphabet,
  State,
  Tape,
  TapeBlock,
  TuringMachine,
  fromMermaid,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
  toMermaid,
} from '@turing-machine-js/machine';
import binaryNumbers from '@turing-machine-js/library-binary-numbers';

// Round-trips the binary library's algorithms through:
//
//   originalState
//     ──toGraph──▶  Graph
//     ──toMermaid──▶  Mermaid string
//     ──fromMermaid──▶  Graph
//     ──fromGraph──▶  rebuiltState
//
// Then asserts the rebuilt machine produces the same tape on the same input.

describe('toGraph / toMermaid / fromMermaid / fromGraph round trip', () => {
  const cases: Array<{
    name: keyof typeof binaryNumbers.states;
    pairs: [input: string, expected: string][];
  }> = [
    {
      name: 'plusOne',
      pairs: [
        ['^$', '^1$'],
        ['^1$', '^10$'],
        ['^10$', '^11$'],
        ['^111$', '^1000$'],
      ],
    },
    {
      name: 'minusOneFast',
      pairs: [
        ['^1$', '^$'],
        ['^10$', '^1$'],
        ['^111$', '^110$'],
        ['^1000$', '^111$'],
      ],
    },
    {
      name: 'invertNumber',
      pairs: [
        ['^1$', '^0$'],
        ['^0$', '^1$'],
        ['^101$', '^010$'],
      ],
    },
    {
      name: 'normalizeNumber',
      pairs: [
        ['^0101$', '^101$'],
        ['^101$', '^101$'],
        ['^00101$', '^101$'],
      ],
    },
  ];

  for (const {name, pairs} of cases) {
    test(`${name} reconstructed from Mermaid runs identically`, () => {
      // 1. start with the original state from the library
      const originalTapeBlock = binaryNumbers.getTapeBlock();
      const originalState = binaryNumbers.states[name];

      // 2. forward path: state → graph → mermaid
      const graph = State.toGraph(originalState, originalTapeBlock);
      const mermaid = toMermaid(graph);

      // 3. reverse path: mermaid → graph → state
      const reparsedGraph = fromMermaid(mermaid);
      const {start: rebuiltState, tapeBlock: rebuiltTapeBlock} = State.fromGraph(reparsedGraph);

      // 4. for each test pair, run BOTH machines on identical input and compare
      const rebuiltMachine = new TuringMachine({tapeBlock: rebuiltTapeBlock});

      for (const [input, expected] of pairs) {
        const tape = new Tape({
          alphabet: rebuiltTapeBlock.tapes[0].alphabet,
          symbols: input.split(''),
        });

        rebuiltTapeBlock.replaceTape(tape);
        rebuiltMachine.run({initialState: rebuiltState});

        expect(tape.symbols.join('').trim()).toBe(expected);
      }
    });
  }

  // Regression for #139: in v6 the wrapper composite name accumulated an extra
  // `>${override.name}` suffix on each round-trip pass (`scanToX>eraseHere`
  // → `scanToX>eraseHere>eraseHere` on the second pass), breaking bytewise
  // stability. v7's emit doesn't carry the composite name in any graph node's
  // label (only the bare's name appears), so reconstruction recomputes the
  // composite fresh and the emit is stable.
  //
  // Uses the `scanToX(eraseHere)` example from #139's issue body — a simple
  // single-wrapper case. Shared-bare cases (like minusOne, where the same
  // bare appears in two wrapper contexts via per-context duplication) have
  // ids that depend on the wrapper's runtime `#id`; those ids reorder under
  // sort-by-id across rebuild, which is a separate limitation not in #139's
  // scope.
  test('toMermaid round-trip is bytewise stable for wrapped states (regression for #139)', () => {
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

    const wrapped = scanToX.withOverriddenHaltState(eraseHere);

    const originalMermaid = toMermaid(State.toGraph(wrapped, tapeBlock));
    const {start: rebuilt, tapeBlock: rebuiltTapeBlock} = State.fromGraph(fromMermaid(originalMermaid));
    const reEmittedMermaid = toMermaid(State.toGraph(rebuilt, rebuiltTapeBlock));

    // State IDs auto-reassign on each rebuild, so normalize them before
    // comparing. v7's emit also uses `cN` for halt-marker ids and `w_N` for
    // subgraph names — normalize all three.
    const normalize = (mermaid: string): string => mermaid
      .replace(/\bs\d+\b/g, 'sX')
      .replace(/\bc\d+\b/g, 'cX')
      .replace(/\bw_\d+\b/g, 'w_X');

    expect(normalize(reEmittedMermaid)).toBe(normalize(originalMermaid));
  });
});
