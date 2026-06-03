# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.0.0] - 2026-06-03

Stable v7. Lockstep release with `@turing-machine-js/machine` 7.0.0. See the machine package CHANGELOG for the cumulative v7 trajectory.

### Changed

- Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.8` → `^7.0.0`.

## [7.0.0-alpha.8] - 2026-06-02

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.8 — lifts `TapeSnapshot` + `tapeViewport` from `@turing-machine-js/visuals` into the engine ([#227](https://github.com/mellonis/turing-machine-js/issues/227)). No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.7` → `^7.0.0-alpha.8`.

## [7.0.0-alpha.7] - 2026-05-30

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.7 — adds `CallFrame` as a first-class `State` subclass ([#213](https://github.com/mellonis/turing-machine-js/issues/213)) and fixes a `toMermaid` framed-wrapper emit asymmetry ([#223](https://github.com/mellonis/turing-machine-js/issues/223)). No source or behavior changes in this package — `states.md` is unaffected (no diagram here uses an inner-wrapper-call pattern). Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.6` → `^7.0.0-alpha.7`.

## [7.0.0-alpha.6] - 2026-05-28

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.6 — adds the `DebugSession` interactive-debugging class and reshapes the engine debug surface: `run()` becomes synchronous + callback-free, `runStepByStep` becomes the pure-iteration primitive (no breakpoint detection), and the per-yield `m.debugBreak` is replaced by a one-sided `m.pause: { side, cause }` carried on `DebugSession` `pause` events ([#102](https://github.com/mellonis/turing-machine-js/issues/102)). No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.5` → `^7.0.0-alpha.6`.

## [7.0.0-alpha.5] - 2026-05-25

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.5 — adds per-iter `MachineState.matchedTransition` + renames `GraphTransition.id` separator `-` → `.` ([#205](https://github.com/mellonis/turing-machine-js/issues/205)), collapses `haltState.debug` to a `boolean` with halt-imminent pause on the AFTER side of the halt-triggering iter ([#207](https://github.com/mellonis/turing-machine-js/issues/207)). No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.4` → `^7.0.0-alpha.5`.

## [7.0.0-alpha.4] - 2026-05-23

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.4 — adds `State.collectStates` ([#195](https://github.com/mellonis/turing-machine-js/issues/195)), extracts graph serialization into `utilities/stateGraph.ts` ([#180](https://github.com/mellonis/turing-machine-js/issues/180)), fixes `toMermaid` label escape ([#194](https://github.com/mellonis/turing-machine-js/issues/194)) and `runStepByStep` halt-stack scope ([#196](https://github.com/mellonis/turing-machine-js/issues/196)). No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.3` → `^7.0.0-alpha.4`.

## [7.0.0-alpha.3] - 2026-05-21

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.3 — first-class out-of-band State tags ([#186](https://github.com/mellonis/turing-machine-js/issues/186)). No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.2` → `^7.0.0-alpha.3`.

## [7.0.0-alpha.2] - 2026-05-21

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.2 — `toMermaid` callable-subtree emit refinement ([#174](https://github.com/mellonis/turing-machine-js/issues/174)), `withOverriddenHaltState` memoization ([#175](https://github.com/mellonis/turing-machine-js/issues/175)), nested `.wohs()` chain collapse ([#176](https://github.com/mellonis/turing-machine-js/issues/176)). No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.1` → `^7.0.0-alpha.2`.

## [7.0.0-alpha.1] - 2026-05-21

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.1 — composition-representation overhaul: `withOverrodeHaltState` → `withOverriddenHaltState` ([#149](https://github.com/mellonis/turing-machine-js/issues/149)), paren-based wrapped-state naming `A(B)` ([#148](https://github.com/mellonis/turing-machine-js/issues/148)), `toMermaid` callable-subtree emit alpha.1 collapsed-bare shape ([#138](https://github.com/mellonis/turing-machine-js/issues/138), [#139](https://github.com/mellonis/turing-machine-js/issues/139)). No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^6.0.0` → `^7.0.0-alpha.1`.

## [6.4.0] - 2026-05-19

Released in lockstep with `@turing-machine-js/machine` 6.4.0. No source or behavior changes in this package.

## [6.3.0] - 2026-05-19

Released in lockstep with `@turing-machine-js/machine` 6.3.0. No source or behavior changes in this package.

## [6.2.0] - 2026-05-19 [SUPERSEDED by 6.3.0]

> ⚠️ **Lockstep release with `@turing-machine-js/machine` 6.2.0**, which was itself superseded by 6.3.0. No source changes in this package. See the engine's [6.2.0 CHANGELOG entry](../machine/CHANGELOG.md) for context.

## [6.1.0] - 2026-05-16

Released in lockstep with `@turing-machine-js/machine` 6.1.0. No source or behavior changes in this package.

## [6.0.0] - 2026-05-09

### Changed (BREAKING)

- **`peerDependencies."@turing-machine-js/machine"` widened from `^5.0.0` to `^6.0.0`** to match the v6 lockstep. Consumers pinned to `@turing-machine-js/machine@5` will see an unmet-peer warning when installing this version.

Released in lockstep with `@turing-machine-js/machine` 6.0.0. No source or behavior changes in this package beyond the peer-dep widening.

## [5.0.0] - 2026-05-09

### Changed (BREAKING)

- **`peerDependencies."@turing-machine-js/machine"` widened from `^4.0.0` to `^5.0.0`** to match the v5 lockstep. Consumers pinned to `@turing-machine-js/machine@4` will see an unmet-peer warning when installing this version.

Released in lockstep with `@turing-machine-js/machine` 5.0.0. No source or behavior changes in this package beyond the peer-dep widening.

## [4.0.0] - 2026-05-07

### Changed (BREAKING)

- **`peerDependencies."@turing-machine-js/machine"` widened from `^3.0.0` to `^4.0.0`** to match the v4 lockstep. Consumers pinned to `@turing-machine-js/machine@3` will see an unmet-peer warning when installing this version.

Released in lockstep with `@turing-machine-js/machine` 4.0.0. No source or behavior changes in this package beyond the peer-dep widening.

## [3.0.2] - 2026-05-04

Released in lockstep with `@turing-machine-js/machine` 3.0.2. No source or behavior changes in this package.

## [3.0.1] - 2026-04-30

Released in lockstep with `@turing-machine-js/machine` 3.0.1. No source or behavior changes in this package.

## [3.0.0] - 2026-04-30

Initial release. Companion library to [`@turing-machine-js/library-binary-numbers`](../library-binary-numbers) with the same operations on a 3-symbol alphabet (no `^`/`$` markers, single number per tape, much smaller state graphs).

### Added

- **`plusOne`** (3 states) — adds 1 to a binary number.
- **`minusOne`** (3 states) — subtracts 1; leaves leading zero on borrow-from-MSB.
- **`invertNumber`** (2 states) — flips every bit.
- **`normalizeNumber`** (2 states) — erases leading zeros, preserving a single `0` for the value zero.
- **`getTapeBlock()`** — returns a fresh `TapeBlock` for the 3-symbol alphabet (` `, `0`, `1`).
- Auto-generated [`states.md`](states.md) — rendered Mermaid graph for every exported state.

### Why this exists

`library-binary-numbers` and `library-binary-numbers-bare` ship as a paired teaching artifact. Comparing the same operations across the two libraries makes the **alphabet-size vs state-graph-size** trade-off concrete. See each library's "How it compares to..." section.

### Notes

- `@turing-machine-js/machine` is a `peerDependency` (`^3.0.0`).
