# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
