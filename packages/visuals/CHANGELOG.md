# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.0.0-alpha.7.1] - 2026-05-30

### Added

- **`createSnippetPlayer(snippet): SnippetPlayer`** — pure-state playback driver for a `Snippet`. Exposes `currentFrame` / `frameIndex` / `done` getters plus `forward()` / `back()` / `reset()` / `goTo(idx)`. Stateless w.r.t. wall-clock — consumers wire their own ticking (`setInterval`, `requestAnimationFrame`, `IntersectionObserver`); renderer-agnostic — consumers read `currentFrame` and apply it however they like (typically `applyHighlight(snippet.graph, frame.highlight, ops)` for the state graph plus app-specific tape rendering). Each call yields an independent player — the same `Snippet` can drive any number of concurrent players (frame storage is shared and read-only). `forward()` / `back()` return a `boolean` (true if moved, false at end/start — no-op in that case); `goTo(idx)` throws `RangeError` on out-of-bounds.

### Compatibility

- Engine + builder + library-binary-numbers + library-binary-numbers-bare stay at `7.0.0-alpha.7` — no changes there. Visuals-only follow-up patch, mirroring the alpha.6.1 precedent for additive consumer-package enhancements.
- Peer dep `@turing-machine-js/machine: ^7.0.0-alpha.7` unchanged (semver-prerelease caret already accepts `alpha.7.1`).

## [7.0.0-alpha.7] - 2026-05-30

Lockstep re-alignment with the engine 7.0.0-alpha.7 bump (engine [#213](https://github.com/mellonis/turing-machine-js/issues/213) `CallFrame` extraction + [#223](https://github.com/mellonis/turing-machine-js/issues/223) `toMermaid` framed-wrapper emit fix). No source or behavior changes in this package since alpha.6.1. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.6` → `^7.0.0-alpha.7`.

## [7.0.0-alpha.6.1] - 2026-05-30

### Added

- `formatStepNotation(reads, commands, blanks, matchKinds?)` — engine edge-label format primitive, matches `toMermaid` emit byte-for-byte. Per-cell encoding: literal `'X'`, blank shortcut `B`, wildcard `*='X'` (shows what `ifOtherSymbol` caught), keep-with-concrete-symbol `K='X'` / `K=B`, erase `E`. Multi-tape comma-separated within one outer bracket per role. Pass `reads === null` for the manual-Apply path (no transition fired) — output collapses to `[writes]/[moves]`. Folds in the richness machines-demo's local `format.ts` had so demo can drop the local helper and call visuals's primitive directly.
- `tokenizeStep(reads, commands, blanks, matchKinds?)` + `ReadToken` / `WriteToken` / `StepTokens` types — renderer-agnostic structured form of one step. Same input contract as `formatStepNotation`; returns discriminated-union tokens per cell (`{ kind: 'literal' | 'blank' | 'wildcard', ... }` for reads, `{ kind: 'literal' | 'erase' | 'keep', ... }` for writes). Consumers wanting custom rendering — HTML spans with CSS classes for syntax highlighting, ANSI-colored terminal output, alternative move vocabulary, clickable cells — walk the tokens themselves. `formatStepNotation` is refactored to be a thin string renderer over `tokenizeStep` (output byte-identical).
- `formatTape(tape)` — inline tape rendering with the head bracketed in place (`a[b]c`).
- `StepCommand` — plain per-tape command shape (`{ movement: 'L' | 'R' | 'S'; symbol: string | null }`) consumed by `formatStepNotation` and `tokenizeStep`. Distinct from the engine's `TapeCommand` class; matches the shape machines-demo's worker boundary exposes.

### Compatibility

- alpha.6's `formatCommand(tapeCommand)` and `formatStep(m)` unchanged. Additive release.
- Engine + builder + library-binary-numbers + library-binary-numbers-bare stay at `7.0.0-alpha.6` — no changes there. Visuals-only follow-up patch; the workspace's lockstep convention is for coordinated peer-dep widening when engine APIs break, not for additive consumer-package enhancements.
- Peer dep `@turing-machine-js/machine: ^7.0.0-alpha.6` unchanged (semver-prerelease caret already accepts `alpha.6.1`).

## [7.0.0-alpha.6] - 2026-05-30

### Added

- Initial extraction from machines-demo (highlight + graph-indexing surface):
  - Types: `HighlightOps`, `IndicatorOps`, `RecordedOp`, `NodeKey`, `HighlightClass`, `GraphIndexes`, `GraphHighlight`, `TapeSnapshot`.
  - Functions: `indexGraph`, `applyHighlight`, `applyIndicator`, `bareIdOf`, `highlightExpand`, `equivalentIds`, `recordingOps`.
  - Rules doc at `docs/graph-highlight-and-breakpoints.md`.
- Initial `recordSnippet` surface (folded in from step 3 of #204 — first published alpha ships with a complete v1 API ready to feed downstream consumers):
  - Types: `Snippet` (`{ version: 1, name?, graph, alphabets, frames }`), `Frame` (`{ step, tape, commands?, highlight, log? }`), `RecordSnippetOptions`.
  - `Frame.commands` carries per-tape `{ movement, read, write }` — both sides of the cell, so players can step forward and backward without recomputing from neighbouring frames.
  - `recordSnippet({ machine, initialState, graph, alphabets, name?, maxSteps?, log? }) => Snippet` runs `machine.runStepByStep` and captures one frame per iter plus a frame-0 initial-state snapshot.
  - Composable formatter primitives: `formatCommand(tapeCommand)` + `formatStep(machineState)` — match the engine's edge-label notation (`[reads] → [writes]/[moves]`) so logged steps line up with rendered graph edges.

Closes [#204](https://github.com/mellonis/turing-machine-js/issues/204).
