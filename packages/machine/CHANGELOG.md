# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [5.0.0] - UNRELEASED

> Draft. Lands as v5.0.0 once the linked issues are closed.

### Changed (BREAKING)

- **Hook renamed: `onDebugBreak` → `onPause`** on `run()` ([#110](https://github.com/mellonis/turing-machine-js/issues/110)). Hard rename, no deprecation alias. The hook signature, payload shape, and dispatch semantics are unchanged — only the option key on `run()` differs. Resolution of the [#109 RFC](https://github.com/mellonis/turing-machine-js/issues/109): the hook now describes the consumer's relationship (this is where you can pause) rather than the engine's event (a debug break fired). The `m.debugBreak` payload field is unchanged.
- **`haltState.debug.after` now throws on assignment** ([#108](https://github.com/mellonis/turing-machine-js/issues/108) part 2). Halt is terminal — there is no iteration-after-halt for an after-fire to anchor on. Symmetric `{ before: true, after: true }` writes also throw; use `{ before: true }`. Symbol-list filters on `haltState.debug.before` remain silent no-ops as in v4.

### Fixed

- **Halting iter's `state.debug.after` now fires** ([#108](https://github.com/mellonis/turing-machine-js/issues/108) part 1). Previously `pendingAfterFromPrev` set after the halting iter's yield was discarded when the `while (!state.isHalt)` loop exited — losing that after-fire. `run()` now drains a final after-fire after the loop when the prior yield armed one. Observable: a debugger UI sees a "we just halted because of state X's after-filter" event that was silent before.

### Added

- **`run({ debug: boolean })` flag** ([#106](https://github.com/mellonis/turing-machine-js/issues/106)). Gates whether `state.debug` assignments produce `debugBreak` metadata on yields, without editing the assignments. Defaults to `true` when an `onPause` hook is provided (preserves v4 behavior); set `false` to suppress all break dispatches while keeping `state.debug = ...` in code.

### Migration

```diff
  await machine.run({
    initialState,
-   onDebugBreak: (m) => { ... },
+   onPause: (m) => { ... },
  });
```

```diff
- haltState.debug = { before: true, after: true }; // throws in v5
+ haltState.debug = { before: true };
```

## [4.0.0] - 2026-05-07

### Added

- **`State.debug` field** — runtime-mutable per-state breakpoints with `{ before, after }` symbol filtering ([#98](https://github.com/mellonis/turing-machine-js/issues/98)). Backed by a shared `Ref` cell so `withOverrodeHaltState` wrappers see assignments propagated from the original state. Validator rejects symbols that aren't transition keys of the owning state (catches cross-tape-block / cross-state mistakes); for `haltState`, list filters are silent no-ops because halt has no resolved head symbol.
- **`DebugConfig` class** — exported from the package. Per-property setters validate and freeze the stored array, so push / index-write throw `TypeError`. Plain-object input to `state.debug = { ... }` is wrapped in a `DebugConfig` instance automatically.
- **`onDebugBreak` hook** on `run()` — awaited at every break (one or two times per yield: `after` from the previous step, then `before` for the current step). For `after` calls, `run()` substitutes the previous yield's snapshot so `m.state` corresponds to the state whose `after` fired. `onStep` always sees the original (un-substituted) yield.
- **`haltState.debug.before = true`** — pauses on every halt entry (program exit AND subroutine return via halt-stack pop). Symbol-list filters on `haltState` are silent no-ops; only the `true` wildcard activates. `haltState` is a module-level singleton — clear in `afterEach` / `finally` for test isolation.
- **`MachineState.debugBreak`** field — optional metadata on every yield from `runStepByStep`; consumers can opt in to reading it and mirror `run()`'s pause behavior if desired.

### Changed (BREAKING)

- **`run()` is now `async`** and returns `Promise<void>`. Existing callers must update to `await machine.run({ ... })` (or `void machine.run({ ... })` if intentionally discarding the result). Without an `onDebugBreak` hook, debug breaks fire-and-resume invisibly — the trajectory observed by `onStep` is identical to running with all `debug` fields cleared.

## [3.0.2] - 2026-05-04

### Fixed

- **`Tape` constructor now normalises and validates `viewportWidth`** ([#95](https://github.com/mellonis/turing-machine-js/issues/95)). The constructor stored `viewportWidth` raw — the setter padded `#symbols` via `normalise()` and validated `>= 1` / bumped even values to odd, but the constructor did neither. As a result, `new Tape({ alphabet, symbols: ['a','b','a','b'], viewportWidth: 23 }).viewport.length` was `4` instead of `23`, and `viewportWidth: 0` or `viewportWidth: 4` silently produced an invalid tape. The constructor now defers to the setter, so a single source of truth handles validation + normalisation.

### Changed (observable)

- A constructor call with an out-of-range `position` (e.g. `position: 5` with `symbols: ['x']`) now normalises at construction — the symbol array is padded with blanks so `position` lands inside the viewport. Previously the tape was left in a malformed state until the first head movement triggered `normalise()`. Strictly a fix, but observable if user code inspected `.symbols.length` immediately after construction.

## [3.0.1] - 2026-04-30

### Fixed

- **`graphFormats.ts` — polynomial-time regex (CodeQL `js/polynomial-redos`).** `alphabetsRegex` was `/^%%\s*alphabets:\s*(.+)$/`, where the `\s*` and `(.+)` both match whitespace, letting the engine try N+1 split points on inputs like `"%%alphabets:"` followed by many trailing spaces. Anchored the first captured char as `\S` to remove the ambiguity.

### Added

- **`MachineState` re-export** from `index.ts`. The type was always `export type MachineState = ...` in `classes/TuringMachine.ts`, but the package barrel didn't surface it. Consumers (notably `@post-machine-js/machine`'s `PostMachine` overrides of `run` / `runStepByStep`) can now `import { type MachineState } from '@turing-machine-js/machine'` directly, dropping any local `Generator<infer T>` workaround.

### Changed (internal)

- Removed the unreachable `if (hasCycles) return` guard at the top of `summarizeGraph`'s `visit()` cycle-detection. The recursive call pattern (outer for-loop checks before calling, inner loop checks after each recursive call) ensures `visit()` is never invoked when `hasCycles` is already true. Static analysis confirmed the guard was dead code.
- Tightened test coverage on `State.ts` and the v3 utilities — overall coverage rose from 95.64% / 88.39% / 95.5% (statements/branches/lines) to 98.39% / 94.01% / 98.34%. New tests cover invalid-input paths in the `State` constructor (string-keyed definitions, non-`State`/`Reference` `nextState`, empty-array commands), the `getSymbol` fallback to `ifOtherSymbol`, the `toGraph` skip of unbound `Reference` transitions, the `fromGraph` cyclic-override-halt error, and the previously-unexercised branches in `splitUnescaped`, `parsePatternString`, `parseMovementLabel`, and `fromMermaid`'s ensureNode update / error paths.

## [3.0.0] - 2026-04-30

### Added

- **`State.toGraph(state, tapeBlock)`** static — walks the reachable graph from a state and returns a serializable `Graph` (states, transitions, alphabets).
- **`State.fromGraph(graph)`** static — inverse of `toGraph`; rebuilds `State` instances + a fresh `TapeBlock` from a `Graph`. Round-trips losslessly via `toMermaid` / `fromMermaid`.
- **`State.inspect(state)`** static — single-state introspection (id, name, isHalt, override-halt target, transitions) without graph traversal or a tapeBlock.
- **`toMermaid(graph)`** — renders a `Graph` to Mermaid flowchart syntax.
- **`fromMermaid(text)`** — parses Mermaid produced by `toMermaid` back into a `Graph`.
- **`summarize(state, tapeBlock)`** / **`summarizeGraph(graph)`** — quantitative analysis of a state graph (state count, transition count, composition depth, cycles, alphabet sizes). Useful for comparing two implementations of the same algorithm.
- **`equivalentOn(reference, candidate, cases, options?)`** — behavioral equivalence checking. Runs both machines on test cases and reports agreement, first-divergence step, and per-side step counts. Supports same-alphabet and (with custom comparator) cross-alphabet comparison.
- New type exports: `Graph`, `GraphNode`, `GraphTransition`, `GraphCommand`, `GraphSummary`, `Runnable`, `EquivalenceCase`, `EquivalenceResult`, `EquivalenceReport`.

### Changed

- TypeScript `target` and `module` raised from `ES6` to `ES2020` (consumers see compiled `dist/` only — no observable difference).

### Removed

- **BREAKING** — the `./src` subpath in `package.json` `exports` was removed. Consumers using `import { ... } from '@turing-machine-js/machine/src'` must drop the `/src` suffix and use `import { ... } from '@turing-machine-js/machine'`.

### Migration

```diff
- import { ... } from '@turing-machine-js/machine/src';
+ import { ... } from '@turing-machine-js/machine';
```

The `/src` subpath was an in-monorepo dev-time shim that never had a real reason to be on the npm tarball.

## [2.0.2] - earlier

Initial public 2.x release.
