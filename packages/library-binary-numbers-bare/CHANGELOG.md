# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
