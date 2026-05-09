# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run build` — TypeScript project-references build (`tsc --build tsconfig.build.json`) then `scripts/build-node-entries.mjs`, which uses Rollup to repackage each `packages/*/dist/index.js` into `index.mjs` (ES) and `index.cjs` (CJS). The Rollup step marks `@turing-machine-js/machine` as `external` for the dependent packages, so cross-package imports stay as runtime dependencies rather than being inlined.
- `npm test` — Vitest (one-shot run via `vitest run`). Single root `vitest.config.ts`; tests are `*.spec.ts` colocated with source plus `test/**/*.spec.ts` for cross-package examples.
- `npm run test:watch` — Vitest in watch mode (`vitest`).
- `npm run test:coverage` — `vitest run --coverage` using `@vitest/coverage-v8`. CI runs this and uploads `coverage/lcov.info` to Coveralls. Hard floors enforced in `vitest.config.ts`: 97% statements / 90% branches / 95% functions / 97% lines (set in PR #124, ~1-2pt below current real coverage).
- `npm run lint` — ESLint (flat config, `typescript-eslint` recommended). `dist/` is ignored.
- `npm run docs:states` — runs `scripts/build-states-md.mjs`, which imports the built `dist/` of each binary-numbers library and regenerates `packages/library-binary-numbers/states.md` and `packages/library-binary-numbers-bare/states.md`. Requires a prior `npm run build`. Doc artifact is committed; refresh manually when state graphs change.
- Run a single test: `npx vitest run packages/machine/src/classes/State.spec.ts` (or `-t "name"`). Vitest uses esbuild for TypeScript, so `.ts` runs without prior compilation; no babel toolchain.

`npm` >= 7 is required (workspaces). Node 22 is what CI uses.

## Architecture

This is an npm-workspaces + Lerna monorepo (`packages/*`, single shared version managed by `lerna.json`). Four published packages:

- **`@turing-machine-js/machine`** — the core engine (no runtime deps).
- **`@turing-machine-js/builder`** — declarative state-table → machine builder; depends on `machine`. Soft-deprecated; see its README.
- **`@turing-machine-js/library-binary-numbers`** — prebuilt states for `^…$`-delimited binary arithmetic on a 5-symbol alphabet; depends on `machine`.
- **`@turing-machine-js/library-binary-numbers-bare`** — same operations on a 3-symbol alphabet (no markers, single number per tape, much smaller state graphs); depends on `machine`. Side-by-side with the marker-based library to make the alphabet-vs-graph-size trade-off visible.

### Documentation parity for the two binary libraries

`library-binary-numbers` and `library-binary-numbers-bare` are paired teaching artifacts — their READMEs **must stay structurally identical**: same section ordering, same headings, parallel comparison tables that mirror each other, same example shape. When updating one, update the other so a reader of either lands at the same checkpoints in the same order. Both READMEs use the *same canonical numbers* in their tape-pseudographic example (currently 43 = `0b101011` and 50 = `0b110010`) so a reader can cross-reference the two diagrams to see the alphabet-size difference visually. Don't break that parallel without updating both files.

### Source-vs-built imports (important)

Dependent packages and tests import the bare package name — `import { ... } from '@turing-machine-js/machine'`. Inside the repo, Vitest's `resolve.alias` (in the single root `vitest.config.ts`) intercepts the bare specifier and routes it to the TypeScript source (`<rootDir>/packages/machine/src`), so a change in `packages/machine/src` is picked up by tests in `builder` / `library-binary-numbers` / `library-binary-numbers-bare` with no rebuild step. After publishing, Node resolves the same specifier to `dist/index.{mjs,cjs}` via the package's `exports` field. When adding a new internal package: add a `resolve.alias` entry in `vitest.config.ts` mapping the bare name to the package's `src/`, and add the package to `scripts/build-node-entries.mjs`'s `packages` array.

### Runtime model (`packages/machine`)

A `TuringMachine` owns one `TapeBlock` (one or more `Tape`s sharing a head step). `await machine.run({ initialState })` walks a graph of `State` nodes until it reaches `haltState`. `run()` is `async` (`Promise<void>`) since v4 — see `state.debug` below.

Key shapes that take reading multiple files to grasp:

- **`State` is keyed by `symbol` (the JS primitive), not by string.** A state definition is `{ [tapeBlock.symbol([...])]: { command, nextState } }`. `tapeBlock.symbol(...)` interns a *pattern* over all tapes in the block and returns a unique JS `Symbol`. `State.getSymbol(tapeBlock)` then matches the current head against those interned patterns; if nothing matches, the special `ifOtherSymbol` key is used as a fallback. This is why everything goes through `tapeBlock.symbol(...)` — it's both a symbol factory and a multi-tape pattern compiler. See `TapeBlock.#getSymbolForPatternList` and `State.getSymbol`.

- **`State.withOverrodeHaltState(next)` is a composition primitive.** It returns a copy of the state whose `haltState` transition is replaced by a *continuation* pushed onto `TuringMachine`'s internal stack. When the machine would halt inside that subgraph, it instead pops and resumes. `library-binary-numbers/src/index.ts` uses this heavily (e.g. `minusOne` chains `invertNumber → plusOne → invertNumber → normalizeNumber`). When you see `.withOverrodeHaltState(...)`, read it as "subroutine call, then continue with the argument."

- **`Reference`** is a forward-declaration handle. `new Reference()` then `.bind(state)` later — this lets you build cyclic state graphs where a state's `nextState` is itself or a not-yet-constructed peer. The `builder` package relies on this to wire arbitrary state-name graphs in a single declarative pass; user code rarely needs `Reference` directly.

- **`haltState` is identified by `id === 0`** (see `State.isHalt`). The module-level `haltState` is the single sentinel; do not construct another.

- **`TapeBlock` has a `Lock`** that `TuringMachine.run` grabs for the duration of a run, asserting the block isn't being mutated by another machine. Calls to `applyCommand` from outside a run must pass the matching capture symbol.

- **`state.debug` (v4)** — runtime-mutable breakpoint cell with `{ before, after }` symbol filtering. Shared across `withOverrodeHaltState` wrappers via a private `Ref` so an assignment on the original is visible from every wrapper instance — useful when the same primitive is reused in composition chains. Pauses dispatch via the optional `onPause` hook on `run()` (awaited; without the hook, breaks fire-and-resume invisibly). Renamed from `onDebugBreak` in v5. `haltState.debug.before = true` pauses on every halt entry (program exit + subroutine pop). See `packages/machine/README.md` "Debugging breakpoints (v4+)" for the full API.

### Builder package

`buildMachine({ alphabetString, initialState, finalStateList, states })` (`packages/builder/src/index.ts`) takes a string-keyed state table where each transition is `{ symbol, movement: 'L'|'R'|'S', state }`. It constructs an `Alphabet` from `alphabetString.split('')`, makes a `Reference` per state name (so forward references work), then materializes every `State` and binds the references. Returns `[machine, initialState, statesByName]`. Use this when you have a textual/tabular spec; use the raw `machine` API when you need composition primitives (`withOverrodeHaltState`, custom symbol patterns, multi-tape).
