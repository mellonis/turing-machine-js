# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
