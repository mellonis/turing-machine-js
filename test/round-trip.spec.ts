import {
  State,
  Tape,
  TuringMachine,
  fromMermaid,
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
});
