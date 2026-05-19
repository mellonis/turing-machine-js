# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

- **`peerDependencies."@turing-machine-js/machine"` widened from `^5.0.0` to `^6.0.0`** to match the v6 lockstep. Consumers pinned to `@turing-machine-js/machine@5` will see an unmet-peer warning when installing this version. The v6 dispatch-order change in the engine ([#119](https://github.com/mellonis/turing-machine-js/issues/119)) doesn't affect this package directly (the builder doesn't call `run()`).

Released in lockstep with `@turing-machine-js/machine` 6.0.0. No source or behavior changes in this package beyond the peer-dep widening.

## [5.0.0] - 2026-05-09

### Added

- **`debug` parameter on `buildMachine()`** ([#101](https://github.com/mellonis/turing-machine-js/issues/101)). Optional per-state breakpoint config; maps to `state.debug = { before, after }` on the matching `State` after construction. Filter values are raw alphabet characters (matching the input-symbol notation in `states`); the builder translates each to a `tapeBlock.symbol([char])`-interned `Symbol` at build time. `true` is the wildcard.
  - Errors at build time on: unknown state name, final-state name (alias for `haltState`, out of scope per the issue spec), symbol not in alphabet.
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
