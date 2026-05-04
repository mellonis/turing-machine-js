# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
