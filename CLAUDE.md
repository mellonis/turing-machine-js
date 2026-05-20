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

`npm` >= 7 is required (workspaces). Node 24 is what CI uses.

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

- **`State.withOverriddenHaltState(next)` is a composition primitive.** It returns a copy of the state whose `haltState` transition is replaced by a *continuation* pushed onto `TuringMachine`'s internal stack. When the machine would halt inside that subgraph, it instead pops and resumes. `library-binary-numbers/src/index.ts` uses this heavily (e.g. `minusOne` chains `invertNumber → plusOne → invertNumber → normalizeNumber`). When you see `.withOverriddenHaltState(...)`, read it as "subroutine call, then continue with the argument."

- **`Reference`** is a forward-declaration handle. `new Reference()` then `.bind(state)` later — this lets you build cyclic state graphs where a state's `nextState` is itself or a not-yet-constructed peer. The `builder` package relies on this to wire arbitrary state-name graphs in a single declarative pass; user code rarely needs `Reference` directly.

- **`haltState` is identified by `id === 0`** (see `State.isHalt`). The module-level `haltState` is the single sentinel; do not construct another.

- **`TapeBlock` has a `Lock`** that `TuringMachine.run` grabs for the duration of a run, asserting the block isn't being mutated by another machine. Calls to `applyCommand` from outside a run must pass the matching capture symbol.

- **`state.debug` (v4+)** — runtime-mutable breakpoint cell with `{ before, after }` symbol filtering. Shared across `withOverriddenHaltState` wrappers via a private `Ref` so an assignment on the original is visible from every wrapper instance — useful when the same primitive is reused in composition chains. Pauses dispatch via the optional `onPause` hook on `run()` (awaited; without the hook, breaks fire-and-resume invisibly). `haltState.debug.before = true` pauses on every halt entry (program exit + subroutine pop). See `packages/machine/README.md` "Debugging breakpoints (v4+)" for the full API.

  Cross-version notes:
  - **v5**: hook renamed `onDebugBreak` → `onPause` (#110). `haltState.debug.after = true` (or `{ before, after }` together) now throws at write-time — halt is terminal, no iteration-after-halt to anchor on (#108 part 2). Halting iter's after-fire stopped being silently lost (#108 part 1). New `run({ debug: boolean })` master switch suppresses all `onPause` dispatches without editing `state.debug` assignments (#106).
  - **v6**: `onPause(after, K)` now fires on iter K's *own* yield, alongside `onPause(before, K)` and `onStep(K)` — per-iter lifecycle is `before → step → after` (#119). Previously `after` fired on iter K+1's tick with a `prevYield` substitution dance; that substitution is gone. Implication: tests asserting cross-hook ordering at the lifecycle level need v6-aware shape.
  - **v6.1**: `state.debug` is now always a non-null `DebugConfig` (lazy-initialized on first read), so chained writes like `state.debug.before = true` work on a fresh state without a prior whole-object assignment. The instance is `Object.seal`-ed — typos throw `TypeError`. `state.debug = null` continues to work but now means "reset filters" (next read returns a fresh empty config). Type signature narrowed `DebugConfig | null` → `DebugConfig` on the getter; setter still accepts `null`. (#150)
  - **v6.2** *(superseded by v6.3)*: briefly widened `onStep` to `(m) => void | Promise<void>` and added an inline `await onStep(m)` in the run loop, motivated by a downstream throttle use case. That overturned the docstring-stated sync contract for `onStep` and was reverted in v6.3.0. Don't reach for that shape — the v6.4 `onIter` hook is the proper place for per-iter awaited coordination.
  - **v6.3**: `onStep` reverted to its v6.0–v6.1 sync contract — `(m) => void`, called synchronously inside the run loop. README's "Throttle pattern" section documents the engine-native shape for per-iter throttle / "wait between iters" UIs (initially via `onPause`-rearm; superseded by `onIter` in v6.4). No other API changes.
  - **v6.4**: new `onIter` hook on `run()` — `(m: MachineState) => void | Promise<void>`, awaited, fires once at the end of every iter (after both `onPause(before, K)` and `onPause(after, K)` on the same yield), unaffected by the `debug` master switch. (#163) Use for per-iter throttle / animation / prev-tracking that needs to read iter K's final state once all `onPause` hooks have settled. Three-hook contract: `onStep` (sync, mid-iter, tracing), `onPause` (awaited, conditional on `state.debug[when]`, user breakpoints), `onIter` (awaited, end-of-iter, coordination). The v6.3.0 README's `onPause`-rearm throttle workaround is superseded by `onIter`.

### Visualization & round-trip

`packages/machine` ships `State.toGraph(state, tapeBlock)` → `Graph` and `State.fromGraph(graph)` → `{start, tapeBlock, states}` for serialization. `toMermaid(graph)` and `fromMermaid(text)` round-trip the same `Graph` through [Mermaid flowchart](https://mermaid.js.org/syntax/flowchart.html) syntax (renderer: [mermaid-js/mermaid](https://github.com/mermaid-js/mermaid)). The parser is strict to the dialect `toMermaid` emits — hand-edited Mermaid with different arrow styles or shapes won't round-trip.

**v7 emit shape** (PR #169, closes #138/#139): each `withOverriddenHaltState` wrapper collapses onto its bare's representation — `GraphNode.isWrapped: true`, no separate wrapper node in graph data. `toMermaid` wraps each `[[bare]]` (subroutine shape) + a synthesized `(((halt)))` marker (`GraphNode.isHaltMarker: true`, negative id; maps back to singleton `haltState` in `fromGraph`) inside a `subgraph w_${bareId}["halt frame"] … end` block. Dotted `onHalt` from `[[bare]]` crosses the subgraph border to the override target. An always-emitted `idle([idle])` stadium sentinel + `idle -. enter .-> sN` arrow marks the initial state (replaces v6's `((round))` shape convention).

**Edge label vocabulary** — `[reads] → [writes]/[moves]`, each role wrapped in `[…]` (the tape-block indicator, one entry per tape; brackets always present, even single-tape). Read cells: literal-quoted (`'X'`), `🞰` (U+1F7B0, ifOtherSymbol catch-all), `B` (the tape's blank). Write cells: literal-quoted, `K` (keep), `E` (erase = write blank). Move cells: `L` / `R` / `S`. **Alternation is always per-pattern bracket** (`['^']|['1']|['0']` for single-tape, `['0','a']|['1','b']` for multi-tape); the compact in-bracket form `['^'|'1']` is rejected by `fromMermaid` to prevent the cross-product reading trap in multi-tape (`['0'|'1','a'|'b']` would read as 4 combinations rather than 2 paired alternatives, so the format avoids the shape entirely).

**Edge arrow styles** — thick `==>` marks transitions whose target is a wrapped state AND ≠ source (= stack-push happens at runtime per `TuringMachine.run` line ~220); regular `-->` for the rest (including self-loops on wrappers, which don't push); dotted `-. onHalt .->` for the wrapper's catch-and-redirect; dotted `-. enter .->` from `idle` for execution-start.

**Round-trip** is **bytewise stable for simple wrappers** (regression test in `test/round-trip.spec.ts` — #139). The wrapper's composite name (e.g. `scanToX(eraseHere)`) does NOT appear as a graph node label; only the bare's name does, so `fromGraph` recomputes the composite fresh on reconstruction — no accumulation. **Shared-bare cases** (same `State` instance used as the bare of multiple wrappers, e.g. `library-binary-numbers`'s `minusOne` where `invertNumber` is both the outermost bare AND wrapper-W1's bare) use **per-context duplication** in `toGraph`: each occurrence emits a separate graph node with the wrapper's `#id`. Reconstruction produces behaviorally-equivalent State instances (not necessarily the same runtime `#id`), but bytewise stability isn't guaranteed for shared-bare since duplicate ordering depends on runtime wrapper-ids that don't survive rebuild.

**Stats helpers** — `summarize(state, tapeBlock)` returns `{stateCount, transitionCount, compositionEdgeCount, maxCompositionDepth, selfLoopCount, hasCycles, tapeCount, alphabetCardinalities}`. `stateCount` filters out `isHaltMarker` sentinels (they're visualization-only, all map to the singleton `haltState` at runtime); matches the per-algorithm header in `library-binary-numbers/states.md` by construction. `equivalentOn(reference, candidate, cases)` is the separate behavioral-equivalence checker — runs both machines, compares outputs and per-step snapshots; lives in `./utilities/equivalence.ts`, unaffected by the visualization-layer changes above.

### Builder package

`buildMachine({ alphabetString, initialState, finalStateList, states })` (`packages/builder/src/index.ts`) takes a string-keyed state table where each transition is `{ symbol, movement: 'L'|'R'|'S', state }`. It constructs an `Alphabet` from `alphabetString.split('')`, makes a `Reference` per state name (so forward references work), then materializes every `State` and binds the references. Returns `[machine, initialState, statesByName]`. Use this when you have a textual/tabular spec; use the raw `machine` API when you need composition primitives (`withOverriddenHaltState`, custom symbol patterns, multi-tape).
