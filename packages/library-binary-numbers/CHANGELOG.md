# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

### Added

- **`minusOneFast`** — a direct borrow-propagation `minusOne` (10 nodes), an alternative to the existing `minusOne` (17 nodes via `~(~x + 1)`). Both kept side-by-side; the heavier composition-based version is pedagogically valuable.
- Auto-generated [`states.md`](states.md) — rendered Mermaid graph for every exported state, produced by `src/graphs.spec.ts`.
- Algorithm-explaining comments in `src/index.ts` (node count, intent, composition trade-offs).
- Tests for `goToNextNumber` and `goToPreviousNumber` (previously `test.todo`).

### Changed

- **BREAKING** — `@turing-machine-js/machine` is now a `peerDependency` (was a regular `dependency`). With npm 7+ this is auto-installed; with older npm you may need to install it explicitly. The change ensures consumer and library share the same singleton sentinels (`haltState`, `ifOtherSymbol`, etc.) — duplicate copies would break `instanceof` checks and identity equality.
- Peer-dep range bumped to `^3.0.0` to require the v3 line of the engine.
- Internal source files now import the bare `@turing-machine-js/machine` (was `@turing-machine-js/machine/src`).

### Migration

If you previously had:

```json
{ "dependencies": { "@turing-machine-js/library-binary-numbers": "^2.0.2" } }
```

You should now have both as direct dependencies (npm 7+ does this automatically):

```json
{
  "dependencies": {
    "@turing-machine-js/machine": "^3.0.0",
    "@turing-machine-js/library-binary-numbers": "^3.0.0"
  }
}
```

## [2.0.2] - earlier

Initial public 2.x release.
