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

  // Name-accumulation regression: in v6 the wrapper composite name accumulated an extra
  // `>${override.name}` suffix on each round-trip pass (`scanToX>eraseHere`
  // → `scanToX>eraseHere>eraseHere` on the second pass), breaking bytewise
  // stability. v7's emit doesn't carry the composite name in any graph node's
  // label (only the bare's name appears), so reconstruction recomputes the
  // composite fresh and the emit is stable.
  //
  // Uses the `scanToX(eraseHere)` example from the original bug report — a simple
  // single-wrapper case. Shared-bare cases (like minusOne, where the same
  // bare backs two wrappers) emit a single de-duped node with `&`-joined
  // call arrows — the sharing survives the round-trip. What doesn't survive
  // bytewise is the serialization: node ids are runtime `State` ids, and a
  // shared bare's post-rebuild id no longer follows the original emission
  // order, so ids reorder under sort-by-id across rebuild. That's a separate
  // limitation, out of scope for this regression.
  test('toMermaid round-trip is bytewise stable for wrapped states (name-accumulation regression)', () => {
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
    // comparing. Under the namespaced id scheme, user/bare/wrapper
    // states render as `uN` and per-frame halt markers as `s0-N` — both
    // derive from the same reassigning runtime State-id counter (a frame's
    // id is the smallest bare id in its component), so both churn together
    // across a rebuild and must both be normalized. `w_N` subgraph names
    // are frame-id-derived too. Real halt (`s0`, id always 0) and the abort
    // sentinel (`s1`, id always -1) are genuine constants — not normalized
    // — since neither is reassigned by a rebuild; `s0-N` is matched BEFORE
    // the bare `u\d+` rule so the marker's own digits aren't caught twice.
    const normalize = (mermaid: string): string => mermaid
      .replace(/\bs0-\d+\b/g, 's0-X')
      .replace(/\bu\d+\b/g, 'uX')
      .replace(/\bw_\d+\b/g, 'w_X');

    expect(normalize(reEmittedMermaid)).toBe(normalize(originalMermaid));
  });
});
