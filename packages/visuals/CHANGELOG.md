# Changelog

All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
