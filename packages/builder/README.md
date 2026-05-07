# @turing-machine-js/builder

[![npm (tag)](https://img.shields.io/npm/v/@turing-machine-js/builder)](https://www.npmjs.com/package/@turing-machine-js/builder)

> **Status: not actively developed by the author.** The package still works and existing tests pass — but no new features are planned. The same state-table construction pattern is shown as an inline example in [`@turing-machine-js/machine`'s README](../machine/README.md), so most users won't need this package as a separate dependency. **Contributions are welcome** if you'd like to extend it (e.g. multi-tape support, OR-patterns, a string-DSL parser shipped with the package itself).

## What it does

Constructs a Turing machine from a declarative state-table object. Every transition is a single `(state, currentSymbol) → (nextState, nextSymbol, movement)` row — the simplest possible API surface, matching how state machines are typically presented in textbooks.

```javascript
import { Tape } from '@turing-machine-js/machine';
import buildMachine from '@turing-machine-js/builder';

const [machine, initialState] = buildMachine({
  alphabetString: '_01XY#',
  initialState: 'Q8',
  finalStateList: ['Q5'],
  states: {
    Q8: { '#': { state: 'Q6', symbol: '#', movement: 'R' } },
    Q6: {
      '0': { state: 'Q0', symbol: 'X', movement: 'R' },
      '1': { state: 'Q1', symbol: 'Y', movement: 'R' },
      '#': { state: 'Q2', symbol: '#', movement: 'R' },
    },
    // ... more states ...
  },
});

machine.tapeBlock.replaceTape(new Tape({
  alphabet: machine.tapeBlock.alphabets[0],
  symbols: '#011#'.split(''),
}));

await machine.run({ initialState, stepsLimit: 100 });
// tape now contains: #011#011#  (the input duplicated)
```

See [`builder.spec.ts`](src/builder.spec.ts) for a complete worked example, including a small parser that reads the `(state,symbol)→(state,symbol,movement);` textual notation often used in textbooks.

## Limitations

The state-table format is intentionally minimal. It does **not** support:

- **OR-patterns** (matching multiple current symbols with one transition row). For `tapeBlock.symbol('^10$')` style patterns, use the raw `@turing-machine-js/machine` API.
- **Multi-tape machines** (`buildMachine` is single-tape only).
- **`withOverrodeHaltState` composition** (the subroutine-call mechanism). For composed machines like `library-binary-numbers`'s `minusOne`, use the raw API.

If you need any of the above, the inline state-table example in [`@turing-machine-js/machine`'s README](../machine/README.md) shows how to write your own `buildMachine`-equivalent in ~30 lines, and you can extend it to fit your case.

## Install

```sh
npm install @turing-machine-js/machine @turing-machine-js/builder
```

`@turing-machine-js/machine` is a peer dependency (so consumer and library share the same singleton sentinels — `haltState`, `ifOtherSymbol`, etc.).

## Links

- [Turing Machine](https://en.wikipedia.org/wiki/Turing_machine) on Wikipedia
- [`@turing-machine-js/machine`](https://github.com/mellonis/turing-machine-js/tree/master/packages/machine) — the core engine, sufficient on its own for most use cases
