# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.1.0] - 2026-07-06

Released in lockstep with `@turing-machine-js/machine` 7.1.0 — the abort feature. No source or behavior changes in this package; the existing dependency range `^7.0.0` already accepts the 7.1.0 engine.

## [7.0.0] - 2026-06-03

Stable v7. Lockstep release with `@turing-machine-js/machine` 7.0.0. See the machine package CHANGELOG for the cumulative v7 trajectory.

### Changed

- Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.8` → `^7.0.0`.

## [7.0.0-alpha.8] - 2026-06-02

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.8 — lifts `TapeSnapshot` + `tapeViewport` from `@turing-machine-js/visuals` into the engine. No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.7` → `^7.0.0-alpha.8`.

## [7.0.0-alpha.7] - 2026-05-30

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.7 — adds `CallFrame` as a first-class `State` subclass and fixes a `toMermaid` framed-wrapper emit asymmetry. No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.6` → `^7.0.0-alpha.7`.

## [7.0.0-alpha.6] - 2026-05-28

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.6 — adds the `DebugSession` interactive-debugging class and reshapes the engine debug surface: `run()` becomes synchronous + callback-free, `runStepByStep` becomes the pure-iteration primitive (no breakpoint detection), and the per-yield `m.debugBreak` is replaced by a one-sided `m.pause: { side, cause }` carried on `DebugSession` `pause` events. No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.5` → `^7.0.0-alpha.6`.

## [7.0.0-alpha.5] - 2026-05-25

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.5 — adds per-iter `MachineState.matchedTransition` + renames `GraphTransition.id` separator `-` → `.`, collapses `haltState.debug` to a `boolean` with halt-imminent pause on the AFTER side of the halt-triggering iter. No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.4` → `^7.0.0-alpha.5`.

## [7.0.0-alpha.4] - 2026-05-23

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.4 — adds `State.collectStates`, extracts graph serialization into `utilities/stateGraph.ts`, fixes `toMermaid` label escape and `runStepByStep` halt-stack scope. No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.3` → `^7.0.0-alpha.4`.

## [7.0.0-alpha.3] - 2026-05-21

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.3 — first-class out-of-band State tags. No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.2` → `^7.0.0-alpha.3`.

## [7.0.0-alpha.2] - 2026-05-21

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.2 — `toMermaid` callable-subtree emit refinement, `withOverriddenHaltState` memoization, nested `.wohs()` chain collapse. No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.1` → `^7.0.0-alpha.2`.

## [7.0.0-alpha.1] - 2026-05-21

Released in lockstep with `@turing-machine-js/machine` 7.0.0-alpha.1 — composition-representation overhaul: `withOverrodeHaltState` → `withOverriddenHaltState`, paren-based wrapped-state naming `A(B)`, `toMermaid` callable-subtree emit alpha.1 collapsed-bare shape. No source or behavior changes in this package. Peer dep `@turing-machine-js/machine` widened `^6.0.0` → `^7.0.0-alpha.1`.

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

- **`peerDependencies."@turing-machine-js/machine"` widened from `^5.0.0` to `^6.0.0`** to match the v6 lockstep. Consumers pinned to `@turing-machine-js/machine@5` will see an unmet-peer warning when installing this version. The v6 dispatch-order change in the engine doesn't affect this package directly (the builder doesn't call `run()`).

Released in lockstep with `@turing-machine-js/machine` 6.0.0. No source or behavior changes in this package beyond the peer-dep widening.

## [5.0.0] - 2026-05-09

### Added

- **`debug` parameter on `buildMachine()`**. Optional per-state breakpoint config; maps to `state.debug = { before, after }` on the matching `State` after construction. Filter values are raw alphabet characters (matching the input-symbol notation in `states`); the builder translates each to a `tapeBlock.symbol([char])`-interned `Symbol` at build time. `true` is the wildcard.
  - Errors at build time on: unknown state name, final-state name (alias for `haltState`, out of scope by design), symbol not in alphabet.
  - `haltState.debug` declarative support is out of scope — set it directly on the imported singleton if you need to pause on halt entry.

### Changed (BREAKING)

- **`peerDependencies."@turing-machine-js/machine"` widened from `^4.0.0` to `^5.0.0`** to match the v5 lockstep. Consumers pinned to `@turing-machine-js/machine@4` will see an unmet-peer warning when installing this version. Note that the `onDebugBreak` → `onPause` rename in engine v5 doesn't affect this package (the builder doesn't call `run()`).

## [4.0.0] - 2026-05-07

### Changed (BREAKING)

- **`peerDependencies."@turing-machine-js/machine"` widened from `^3.0.0` to `^4.0.0`** to match the v4 lockstep. Consumers pinned to `@turing-machine-js/machine@3` will see an unmet-peer warning when installing this version.

Released in lockstep with `@turing-machine-js/machine` 4.0.0. No source or behavior changes in this package beyond the peer-dep widening.

## [3.0.2] - 2026-05-04

Released in lockstep with `@turing-machine-js/machine` 3.0.2. No source or behavior changes in this package.

## [3.0.1] - 2026-04-30

Released in lockstep with `@turing-machine-js/machine` 3.0.1. No source or behavior changes in this package.

## [3.0.0] - 2026-04-30

### Changed

- **Status: not actively developed by the author.** The package still works and existing tests pass; the same state-table construction pattern is now shown as an inline example in [`@turing-machine-js/machine`'s README](../machine/README.md). Most users won't need this package as a separate dependency. Contributions are welcome — see the README for areas a contributor could pick up.
- **BREAKING** — `@turing-machine-js/machine` is now a `peerDependency` (was a regular `dependency`). npm 7+ auto-installs peers; older npm may need explicit installation.
- Peer-dep range bumped to `^3.0.0` to require the v3 line of the engine.
- Fixed `repository.directory` in `package.json` (was `packages/machine`, now correct `packages/builder`).
- Internal source files now import the bare `@turing-machine-js/machine` (was `@turing-machine-js/machine/src`).

### Migration

If you previously had:

```json
{ "dependencies": { "@turing-machine-js/builder": "^2.0.2" } }
```

You should now have both as direct dependencies (npm 7+ does this automatically):

```json
{
  "dependencies": {
    "@turing-machine-js/machine": "^3.0.0",
    "@turing-machine-js/builder": "^3.0.0"
  }
}
```

## [2.0.2] - earlier

Initial public 2.x release.
