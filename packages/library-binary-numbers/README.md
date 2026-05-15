# @turing-machine-js/library-binary-numbers

[![build](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml/badge.svg)](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml)
[![npm (tag)](https://img.shields.io/npm/v/@turing-machine-js/library-binary-numbers)](https://www.npmjs.com/package/@turing-machine-js/library-binary-numbers)

Binary arithmetic on a **5-symbol alphabet** (` `, `^`, `$`, `0`, `1`) supporting **multiple numbers per tape**. Numbers are delimited by `^…$` markers — the markers cost extra states per algorithm but enable inter-number navigation. Side-by-side with [`@turing-machine-js/library-binary-numbers-bare`](../library-binary-numbers-bare), which drops the markers for smaller graphs at the cost of single-number-only operation.

## Install

```sh
npm install @turing-machine-js/machine @turing-machine-js/library-binary-numbers
```

`@turing-machine-js/machine` is a peer dependency.

## Concept

A number is a sequence of `0`/`1` cells delimited by `^` (start) and `$` (end). Several numbers can sit on one tape, separated by blanks.

```
…blank ^101011$ blank ^110010$ blank…
       ╰─ 43 ─╯       ╰─ 50 ─╯
```

Examples:
- `^$` represents 0
- `^1$` represents 1
- `^10$` represents 2
- `^11$` represents 3

Negative numbers are not currently supported.

## Algorithms

| name | what it does |
|---|---|
| `goToNumber` | move the head to the current number's `$` |
| `goToNextNumber` | move the head to the next number (rightward) |
| `goToPreviousNumber` | move the head to the previous number (leftward) |
| `goToNumbersStart` | move the head to the current number's `^` |
| `deleteNumber` | erase the current number entirely |
| `invertNumber` | flip every bit (`0` ↔ `1`) |
| `normalizeNumber` | erase leading zeros (preserving `^$` for the value zero) |
| `plusOne` | add 1 to the number; extends leftward on overflow (`111 + 1 = 1000`) |
| `minusOne` | subtract 1, computed via `~(~x + 1)` — composes `invertNumber` → `plusOne` → `invertNumber` → `normalizeNumber` |
| `minusOneFast` | direct borrow propagation; smaller than `minusOne` and auto-normalizes |

To use these, the tape block **must** come from `getTapeBlock()` — that's the one that interns the `^`/`$`/`01` patterns the states key against.

## Usage

```javascript
import { Tape, TuringMachine } from '@turing-machine-js/machine';
import binaryNumbers from '@turing-machine-js/library-binary-numbers';

const tapeBlock = binaryNumbers.getTapeBlock();
const tape = new Tape({
  alphabet: tapeBlock.alphabets[0],
  symbols: '^101$'.split(''), // binary 5
});

tapeBlock.replaceTape(tape);

const machine = new TuringMachine({ tapeBlock });

await machine.run({ initialState: binaryNumbers.states.plusOne });

console.log(tape.symbols.join('').trim()); // "^110$" (binary 6)
```

To run several algorithms in sequence on the same value, reuse the same `TapeBlock` across `machine.run(...)` calls — every state in `binaryNumbers.states` halts cleanly with the head positioned for the next algorithm to pick up.

## How it compares to the bare library

Both libraries solve the same arithmetic problem; the trade is **alphabet symbols** vs **state-graph size**.

| algorithm | this library (5-symbol) | bare library (3-symbol) |
|---|---|---|
| `plusOne` | 5 states | **3** states |
| `minusOne` | 17 / 10 (`minusOne` / `minusOneFast`) | **3** states |
| `invertNumber` | 5 states | **2** states |
| `normalizeNumber` | 7 states | **2** states |
| **multi-number on tape?** | yes — `goToNumber`, `goToNextNumber`, etc. | no |
| **head-position flexibility** | anywhere on the number | leftmost digit |
| **`minusOne` auto-normalizes?** | yes — `minusOneFast` chains into `normalizeNumber` | no — leading `0` kept |

The extra states this library spends are mostly bookkeeping for the `^`/`$` markers (planting `^` on left-overflow, sweeping past it on entry, etc.). The pay-off is multi-number-per-tape support and head-position flexibility — `goToNumber` / `goToNextNumber` / `goToPreviousNumber` / `deleteNumber` / `goToNumbersStart` have no counterpart in the bare library.

For a teaching context, both libraries shipping in parallel makes the cost of representation choices tangible.

See the rendered Mermaid graphs for every state in [`states.md`](states.md) — regenerated via `npm run docs:states` from the repo root.

## Links

- [`@turing-machine-js/machine`](../machine) — the core engine
- [`@turing-machine-js/library-binary-numbers-bare`](../library-binary-numbers-bare) — the 3-symbol counterpart
- [Turing Machine](https://en.wikipedia.org/wiki/Turing_machine) on Wikipedia
