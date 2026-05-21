# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [7.0.0-alpha.2] - 2026-05-21

Second v7 pre-release. Refines alpha.1's `toMermaid` wrapped-state emit into the function-call model ([#174](https://github.com/mellonis/turing-machine-js/issues/174)) and adds two construction-time improvements to `withOverriddenHaltState` ([#175](https://github.com/mellonis/turing-machine-js/issues/175), [#176](https://github.com/mellonis/turing-machine-js/issues/176)). Published to npm under the `next` dist-tag: `npm install @turing-machine-js/machine@next`.

**Pre-release — the API surface may still shift before stable v7.0.0.** Pin to a specific alpha for reproducibility: `@turing-machine-js/machine@7.0.0-alpha.2`. Migration walkthrough at the bottom.

### Changed

- **`toMermaid` callable-subtree emit** ([#174](https://github.com/mellonis/turing-machine-js/issues/174)) — supersedes alpha.1's collapsed-bare emit (#138/#139) with a function-call model:
  - **Wrapper and bare are separate graph nodes.** The wrapper sits OUTSIDE any subgraph as `[[composite-name]]` (call site). The bare lives INSIDE its callable subtree subgraph as a regular `[name]` node.
  - **Subgraph label** changed from `"halt frame"` to `"callable subtree of NAME"` (single bare) or `"callable scope: A ∪ B"` (multi-bare union frame).
  - **Halt marker is per-frame**, not per-wrapper. When union-find merges two bares' subtrees (shared body state), they share one halt marker.
  - **Arrow vocabulary rewritten**:
    - Solid `-->` for regular transitions AND for the wrapper's post-return `--> override` (just an ordinary transition under the call/return model).
    - Bold `==> "call"` is RESERVED for the wrapper-to-bare call. `&` ribbon syntax (`s_W1 & s_W2 == "call" ==> s_A`) collapses multiple wrappers that share a bare.
    - Dotted `-.->` is reserved for frame-level dispatch: `w_N -. "return" .-> wrapper` (demand-emit), `w_N -. "halt" .-> s0` (demand-emit on non-wrapper entry), `idle -. enter .-> sN` (unchanged).
    - The `-. onHalt .->` keyword from alpha.1 is **retired** — replaced by a solid `--> override` arrow.
  - **No per-context duplication.** Shared bares (e.g. `library-binary-numbers/minusOne`'s `invertNumber`, called by two wrappers) appear as a single subtree with `& `-joined call arrows from each wrapper.
  - **`GraphNode` field changes**: `isWrapped` removed; `isWrapper: boolean`, `bareStateId: number | null`, `frameId: number | null` added. `overriddenHaltStateId` now lives on wrapper nodes only.
  - Bytewise round-trip stability now holds for **all** wrapped states, including shared-bare cases (alpha.1 was only stable for simple wrappers).

- **Nested `.wohs()` chain collapse** ([#176](https://github.com/mellonis/turing-machine-js/issues/176)) — `A.withOverriddenHaltState(t1).withOverriddenHaltState(t2)` is now equivalent to `A.withOverriddenHaltState(t2)`. The chain's inner override (`t1`) is dead at runtime (only the outermost wrapper's override is pushed onto the halt stack on entry — verified empirically). Composite name now reflects runtime behavior: `A(t2)`, not the misleading `A(t1)(t2)`. `withOverriddenHaltState` unwraps `this` to its bare before constructing the new wrapper.

### Added

- **`withOverriddenHaltState` memoization** ([#175](https://github.com/mellonis/turing-machine-js/issues/175)) — calls with the same `(bare, override)` pair return the literally-same `State` instance. Backed by a two-level `WeakMap` keyed by the bare with `WeakRef`-valued entries, so cached wrappers can be GC'd when nothing else holds them. Composes with #176's chain-collapse: `A.wohs(t1).wohs(t2)` and `A.wohs(t2)` both resolve to the same instance.

- **Spec doc** at `docs/superpowers/specs/2026-05-21-halt-frame-transitive-closure.md` capturing the callable-subtree model design (worked examples for simple wrappers, PostMachine subroutines, shared-bare wrappers, self-wrapping, nested chains, Reference cycles, shared body states).

### Migration from alpha.1

Three breaking changes vs alpha.1, all in the visualization layer:

**1. Mermaid format** — alpha.1 Mermaid strings (with `-. onHalt .->` edges or `[[bare]]` inside subgraphs) will NOT parse with the new `fromMermaid`. The format is one-way: re-emit via `toMermaid(toGraph(state, tapeBlock))` on alpha.2 to regenerate.

**2. `Graph` data shape** — `GraphNode.isWrapped` removed; replaced by `isWrapper: boolean`, `bareStateId: number | null`, `frameId: number | null`. If you store serialized `Graph` JSON from alpha.1, re-emit on alpha.2.

**3. Wrapper composite name in nested chains** — `A.wohs(t1).wohs(t2)` was `A(t1)(t2)` in alpha.1; under #176 it's now `A(t2)`. Code that parsed the composite name to extract intermediate overrides will need to adapt (those overrides were never actually pushed at runtime — alpha.1's name was misleading).

`withOverriddenHaltState` memoization (#175) is fully additive — same arguments now return the same instance, but no observable behavior changes for code that doesn't rely on instance identity.

### Out of v7-alpha.2 (still pending for stable v7.0.0)

- **[#102](https://github.com/mellonis/turing-machine-js/issues/102)** — debugger step-in / step-out / step-over primitives. Additive — won't change any existing API. Will land in `v7.0.0-alpha.3` or stable `v7.0.0`.
- **[#180](https://github.com/mellonis/turing-machine-js/issues/180)** — extract `State.toGraph`/`fromGraph` to its own module. Internal refactor; no API change.

### Compatibility

- Peer dep `@turing-machine-js/machine` widened `^7.0.0-alpha.1` → `^7.0.0-alpha.2` on `@turing-machine-js/builder`, `@turing-machine-js/library-binary-numbers`, `@turing-machine-js/library-binary-numbers-bare`.

## [7.0.0-alpha.1] - 2026-05-21

First v7 pre-release. Consolidates the composition-representation overhaul landed across [#149](https://github.com/mellonis/turing-machine-js/issues/149), [#148](https://github.com/mellonis/turing-machine-js/issues/148), [#138](https://github.com/mellonis/turing-machine-js/issues/138), and [#139](https://github.com/mellonis/turing-machine-js/issues/139). Published to npm under the `next` dist-tag: `npm install @turing-machine-js/machine@next`.

**Pre-release — the API surface may still shift before stable v7.0.0.** Pin to a specific alpha for reproducibility: `@turing-machine-js/machine@7.0.0-alpha.1`. Migration walkthrough at the bottom.

### Changed

- **`State.prototype.withOverrodeHaltState` renamed to `withOverriddenHaltState`** ([#149](https://github.com/mellonis/turing-machine-js/issues/149)). Grammar fix on a name introduced in 2019: `overridden` (past participle) fits the "with a halt-state that has been ___" naming idiom; `overrode` (simple past) didn't. Hard cutover — no deprecated alias. Renames in lockstep:
  - public method `State.prototype.withOverrodeHaltState` → `withOverriddenHaltState`
  - getter `state.overrodeHaltState` → `state.overriddenHaltState`
  - private field `#overrodeHaltState` → `#overriddenHaltState`
  - serialized `Graph` data field `node.overrodeHaltStateId` → `node.overriddenHaltStateId`

- **Wrapped-state composite name format flipped from `bare>override` to `bare(override)`** ([#148](https://github.com/mellonis/turing-machine-js/issues/148)). The old `>`-flat notation collided structurally-distinct wrap-trees into the same string: `A.with(B.with(A))` and `A.with(B).with(A)` both rendered as `A>B>A` despite being different runtime shapes. Paren-nested keeps them distinct: `A(B(A))` vs `A(B)(A)`. As a consequence, **user-provided state names must not contain `(` or `)`** — `State` constructor now throws on names with these characters. `>` is no longer reserved and is valid in user-provided names again.

- **`toMermaid` wrapped-state emit overhaul** ([#138](https://github.com/mellonis/turing-machine-js/issues/138), [#139](https://github.com/mellonis/turing-machine-js/issues/139)). Each `withOverriddenHaltState` wrapper collapses onto its bare's representation — `GraphNode.isWrapped: true`, no separate wrapper node in graph data. `toMermaid` wraps each `[[bare]]` (Mermaid subroutine shape) + a synthesized `(((halt)))` halt-marker (`GraphNode.isHaltMarker: true`) inside a `subgraph w_${bareId}["halt frame"] … end` block. Dotted `onHalt` from `[[bare]]` crosses the subgraph border to the override target. An always-emitted `idle([idle])` stadium sentinel + `idle -. enter .-> sN` arrow marks the initial state (replaces the v6 `((round))` shape convention).

- **Edge-label vocabulary rewritten** for readability — `[reads] → [writes]/[moves]` with each role wrapped in `[…]` (the tape-block indicator; always present, even single-tape). Read cells: `'X'` literal-quoted, `*` (ASCII; ifOtherSymbol catch-all — literal `*` in the alphabet renders as `'*'`), `B` (tape's blank shorthand). Write cells: literal-quoted, `K` (keep), `E` (erase = write blank). Move cells: `L` / `R` / `S`. Alternation per-pattern bracket: `['^']|['1']` for single-tape, `['0','a']|['1','b']` for multi-tape. Compact in-bracket `['^'|'1']` form is rejected by `fromMermaid` (would read as cross-product semantics in multi-tape).

- **Thick `==>` arrows for stack-pushing transitions.** When a transition's target is a wrapped state AND ≠ source (i.e. would push the wrapper's override onto the runtime stack per `TuringMachine.run`'s line ~220 transition-time push), the engine emits a thick `==>` arrow — visual signal for "this transition fires a stack push."

- **`GraphTransition.id`** — stable, deterministic per-edge identifier (`${fromNodeId}-${patternIx}`). Supports downstream tooling for edge-targeting in rendered Mermaid SVG (e.g. highlight-the-next-transition in interactive viewers).

- **`summarize().stateCount` filters `isHaltMarker` nodes** — halt markers are visualization sentinels (all map back to singleton `haltState` at runtime), not distinct runtime states. Matches the per-algorithm header count in `library-binary-numbers/states.md`.

### Added

- **#139 regression test** — `toMermaid → fromMermaid → toGraph → toMermaid` is bytewise stable for simple wrappers. The wrapper's composite name (e.g. `scanToX(eraseHere)`) no longer appears as any graph-node label, so `fromGraph` reconstructs and recomputes the composite fresh on each pass — no round-trip name accumulation.

- **Multi-tape example** in the engine README illustrating the bracketed format with two tapes.

- **§Diagram conventions section** in the engine README — full reference: node shapes, edge styles, groupings, edge label format + cell vocabulary, alternation rule, multi-tape example.

- **Cross-package introspection consistency** — `library-binary-numbers/states.md` per-algorithm header line now uses `summarizeGraph(graph)` for its `N states; N transitions; N wrappers (max nesting depth N); has cycles` summary, dogfooding the same API any consumer would use.

### Removed

- Hand-drawn pedagogical Mermaid blocks in engine + root READMEs. The v7 `toMermaid` output is now the primary illustration — no more vocabulary mismatch between hand-drawn and engine-rendered diagrams.

### Migration

For consumers updating from v6.x:

**1. Identifier rename** (mechanical):

```sh
git grep -l 'OverrodeHaltState\|overrodeHaltState' | xargs sed -i '' \
  -e 's/OverrodeHaltState/OverriddenHaltState/g' \
  -e 's/overrodeHaltState/overriddenHaltState/g'
```

Persisted `State.toGraph` JSON dumps need the same `overrodeHaltStateId` → `overriddenHaltStateId` field rename.

**2. Wrapper composite name format** — code that pattern-matches `state.name` for wrapper composites needs to switch from `>`-split to paren-parse: `'A>B'` is now `'A(B)'`.

**3. State name validation** — any code that constructs `new State(null, 'foo(bar)')` now throws. Real-world identifier-style state names (`scanToX`, `goHome`, `incT1`) are unaffected.

**4. `toMermaid` output format** — if you render `toMermaid` output programmatically, the edge-label vocabulary changed completely (bracketed-tape-block format with `K`/`E`/`B`/`*`/`L`/`R`/`S`). See the engine README's §Diagram conventions for the full vocabulary.

**5. `Graph` data shape** — `GraphNode` gained `isWrapped: boolean` + `isHaltMarker: boolean`; `GraphTransition` gained `id: string`. Most consumers don't need to change. If you call `summarize().stateCount`, the value now excludes halt markers (typically matches what you actually wanted — runtime state count, not visualization-node count).

### Out of v7-alpha.1 (still pending for stable v7.0.0)

- **[#102](https://github.com/mellonis/turing-machine-js/issues/102)** — debugger step-in / step-out / step-over primitives. Additive — won't change any existing API. Will land in `v7.0.0-alpha.2` or stable `v7.0.0`.

### Compatibility

- Peer dep `@turing-machine-js/machine` widened `^6.0.0` → `^7.0.0-alpha.1` on `@turing-machine-js/builder`, `@turing-machine-js/library-binary-numbers`, `@turing-machine-js/library-binary-numbers-bare`.

## [6.4.0] - 2026-05-19

Adds a new awaited hook on `TuringMachine.run`. Minor release, additive — no breaking changes. Closes [#163](https://github.com/mellonis/turing-machine-js/issues/163).

### Added

- **`onIter` callback** on `run()`: `onIter?: (m: MachineState) => void | Promise<void>`. Fires once per iteration at end-of-iter — *after* both `onPause(before, K)` and `onPause(after, K)` dispatches on the same yield. Awaited inline, so consumers returning a Promise suspend the run loop between iters. Unaffected by the `debug` master switch — `onIter` fires on every iter regardless of whether any `state.debug` breakpoints are armed.

  Use cases the hook serves:
  - **Per-iter throttle** (interactive debugger / animation UIs) — `await new Promise(r => setTimeout(r, intervalMs))` inside the callback gives a "wait between iters" pattern with no `state.debug` mutation.
  - **Iter-correct bookkeeping** — for downstream libraries that maintain per-iter prev state (e.g. PostMachine's `arrivalPath` tracking), `onIter` is the natural "iter K is done" boundary, after all `onPause` hooks have read their own snapshots. Avoids the prev-advance-during-onStep ordering hazard.
  - **Yield-to-other-work in batched runs** — a sync `await new Promise(r => queueMicrotask(r))` per iter lets long runs interleave with other event-loop work without owning the run loop.

### Three-hook contract recap

| Hook | Sync/Async | When | Use |
|---|---|---|---|
| `onStep` | Sync, not awaited | Mid-iter (between before/after) | Cheap tracer/logger, microtask-free hot loop |
| `onPause` | Awaited | Conditional on `state.debug[when]` match | User-authored breakpoints / debugger UI |
| `onIter` | Awaited | End of every iter | Per-iter coordination — throttle, prev-tracking, animation, yield-to-other-work |

### Changed (docs)

- README's **Throttle pattern** section rewritten to recommend `onIter` as the canonical hook. The v6.3.0 `onPause`-rearm workaround is superseded — that pattern still works (it's just the engine-native primitives), but `onIter` is the cleaner shape.

### Compatibility

- Default `onIter` is `undefined` → no behavior change for any existing consumer that doesn't opt in.
- Sync consumers using only `onStep` pay zero microtask overhead — `onIter` is purely opt-in.
- Peer-deps unchanged (`^6.0.0` includes 6.4.0 for the dependents).

## [6.3.0] - 2026-05-19

Corrective minor release. **Reverts v6.2.0's `await onStep` change** and restores the original sync `onStep` contract that held since the hook was introduced. See [GitHub release](https://github.com/mellonis/turing-machine-js/releases/tag/v6.3.0) for the full post-mortem.

### Changed

- **`TuringMachine.run`** — `await onStep(m)` reverted to `onStep(m)`; type narrowed back from `(m: MachineState) => void | Promise<void>` to `(m: MachineState) => void`. The original "Sync, ~free hook ... must not be async" contract is restored, with the docstring augmented to point readers at the new Throttle pattern section.

### Removed

- The v6.2.0 test `async onStep is awaited between iters (#158)` (no longer the contract).

### Added (docs)

- README: new **Throttle pattern** section under *Debugging breakpoints* showing the engine-native shape for per-iter throttle / "wait between iters" UIs — arm `state.debug.after = true` on the initial state, throttle inside `onPause`, rearm `m.nextState.debug.after = true` in the callback. Replaces the v6.2.0 throttle-in-`onStep` pattern.

### Kept from v6.2.0 (independent improvements)

- CI `typecheck` step + dependent packages' `tsconfig` `paths`/`rootDir` fix.

### Migration

- From v6.2.0: drop any `await` you wrote inside `onStep`. The engine ignores the returned Promise now. If you used the throttle-in-`onStep` pattern, migrate to the Throttle pattern section in the README.
- From v6.1.0 or earlier: no change for you.

## [6.2.0] - 2026-05-19 [SUPERSEDED by 6.3.0]

> ⚠️ **This release was a mistake.** It overturned the sync `onStep` contract that had held since the hook was introduced, motivated by a downstream throttle use case that didn't actually need an engine API change. Restored to sync in [6.3.0](#630---2026-05-19). The `await onStep` semantic shipped briefly on npm; consumers should upgrade to 6.3.0 and use the README's Throttle pattern instead.

### Changed

- **`TuringMachine.run`** — `onStep` type widened from `(m) => void` to `(m) => void | Promise<void>`; the run loop now awaits each `onStep(m)` call.

### Internal

- CI `typecheck` step added (mirrors the spec-including tsconfig to catch TS errors in `*.spec.ts`).
- Dependent packages' `tsconfig` `paths` and `rootDir` corrected — they now resolve `@turing-machine-js/machine` from source in CI (previously required a pre-built `dist/`).

## [6.1.0] - 2026-05-16

Minor release. One additive ergonomic improvement to `state.debug`, no breaking changes.

### Added

- **Lazy-init `DebugConfig` + `Object.seal` on instance ([#151](https://github.com/mellonis/turing-machine-js/pull/151), closes [#150](https://github.com/mellonis/turing-machine-js/issues/150)).** `state.debug` is now always a non-null `DebugConfig` instance, lazy-initialized on first read. Chained writes like `state.debug.before = true` work on a fresh state without a prior `state.debug = {}` setup step. The `DebugConfig` instance is `Object.seal`-ed — typos like `state.debug.bofore = true` throw `TypeError` (in strict mode — default for TS-emitted modules) instead of silently creating a useless own property.

### Changed

- **`state.debug` getter type narrowed** — `DebugConfig | null` → `DebugConfig`. Setter still accepts `null`; the semantic shifts to "reset filters" (next read returns a fresh empty config rather than literal `null`).
- **Wrapper sharing preserved** — `withOverrodeHaltState`'s `#debugRef` cell continues to share a single `DebugConfig` instance across wrapper and original; first read on either lazy-creates, both subsequent reads return the same instance.

### Migration

No code changes required:
- `state.debug?.X` patterns keep working (the `?.` is now redundant but correct).
- `state.debug = { ... }` whole-object assignment works as before.
- `state.debug = null` works as before, with the new "reset filters" semantic.
- Consumer code checking `if (state.debug === null)` becomes dead code but doesn't crash; the narrowed getter type may surface TS warnings on those branches, safe to delete.

## [6.0.0] - 2026-05-09

### Changed (BREAKING)

- **`onPause` dispatch order rewritten** ([#119](https://github.com/mellonis/turing-machine-js/issues/119)). `onPause(after, K)` now fires on iter K's *own* yield, alongside `onPause(before, K)` and `onStep(K)` — instead of v5's behavior of firing on iter K+1's yield with a `prevYield` substitution. The set of dispatched calls per run and per-iter semantics are unchanged; only the cross-hook *sequence* differs. Per-iter lifecycle inside `run()` is now `before → step → after`. Consumers using both `onStep` and `onPause` and asserting cross-hook ordering must update; consumers treating the hooks as independent observers see no change.

  Subordinate consequences:
  - `onPause(after)` carries the iteration's own `MachineState` directly — no `prevYield` substitution dance.
  - `runStepByStep` no longer tracks `pendingAfterFromPrev` across yields; `debugBreak.after` on a yield refers to *that* iter's after-arm.
  - The v5 post-loop after-fire drain (#108 part 1) collapses — the halting iter's after rides along on its own yield like any other iter.
  - The generator's return type narrows back from `Generator<MachineState, MachineState | null>` to `Generator<MachineState>`; `for..of` consumers (the canonical pattern) are unaffected.

### Closes

- [#107](https://github.com/mellonis/turing-machine-js/issues/107) — "expose un-substituted `machineState` for after-break consumers" disappears as a problem: there is no substitution to expose around.

### Migration

No call-site change to `run()`'s API:

```ts
await machine.run({
  initialState,
  onStep:  (m) => { /* unchanged */ },
  onPause: (m) => {
    if (m.debugBreak?.before) console.log('before:', m.state.name);
    if (m.debugBreak?.after)  console.log('after:',  m.state.name);
  },
});
```

Tests asserting the v5 sequence (`pause(after K-1) → pause(before K) → step(K)`) need updating to the v6 sequence (`pause(before K) → step(K) → pause(after K)`).

## [5.0.0] - 2026-05-09

### Changed (BREAKING)

- **Hook renamed: `onDebugBreak` → `onPause`** on `run()` ([#110](https://github.com/mellonis/turing-machine-js/issues/110)). Hard rename, no deprecation alias. The hook signature, payload shape, and dispatch semantics are unchanged — only the option key on `run()` differs. Resolution of the [#109 RFC](https://github.com/mellonis/turing-machine-js/issues/109): the hook now describes the consumer's relationship (this is where you can pause) rather than the engine's event (a debug break fired). The `m.debugBreak` payload field is unchanged.
- **`haltState.debug.after` now throws on assignment** ([#108](https://github.com/mellonis/turing-machine-js/issues/108) part 2). Halt is terminal — there is no iteration-after-halt for an after-fire to anchor on. Symmetric `{ before: true, after: true }` writes also throw; use `{ before: true }`. Symbol-list filters on `haltState.debug.before` remain silent no-ops as in v4.

### Fixed

- **Halting iter's `state.debug.after` now fires** ([#108](https://github.com/mellonis/turing-machine-js/issues/108) part 1). Previously `pendingAfterFromPrev` set after the halting iter's yield was discarded when the `while (!state.isHalt)` loop exited — losing that after-fire. `run()` now drains a final after-fire after the loop when the prior yield armed one. Observable: a debugger UI sees a "we just halted because of state X's after-filter" event that was silent before.

### Added

- **`run({ debug: boolean })` flag** ([#106](https://github.com/mellonis/turing-machine-js/issues/106)). Master switch for `onPause` dispatch. When `false`, suppresses all pause-fires (before, after, and the post-loop after-drain) regardless of `state.debug` assignments. `onStep` is unaffected. Defaults to `true`. The `m.debugBreak` field is still populated on yields by the underlying generator (it's a property of the iteration); only `run()`'s hook dispatch is gated. Useful for toggling "debug mode" without editing `state.debug = ...` across the state graph.

### Migration

```diff
  await machine.run({
    initialState,
-   onDebugBreak: (m) => { ... },
+   onPause: (m) => { ... },
  });
```

```diff
- haltState.debug = { before: true, after: true }; // throws in v5
+ haltState.debug = { before: true };
```

## [4.0.0] - 2026-05-07

### Added

- **`State.debug` field** — runtime-mutable per-state breakpoints with `{ before, after }` symbol filtering ([#98](https://github.com/mellonis/turing-machine-js/issues/98)). Backed by a shared `Ref` cell so `withOverrodeHaltState` wrappers see assignments propagated from the original state. Validator rejects symbols that aren't transition keys of the owning state (catches cross-tape-block / cross-state mistakes); for `haltState`, list filters are silent no-ops because halt has no resolved head symbol.
- **`DebugConfig` class** — exported from the package. Per-property setters validate and freeze the stored array, so push / index-write throw `TypeError`. Plain-object input to `state.debug = { ... }` is wrapped in a `DebugConfig` instance automatically.
- **`onDebugBreak` hook** on `run()` — awaited at every break (one or two times per yield: `after` from the previous step, then `before` for the current step). For `after` calls, `run()` substitutes the previous yield's snapshot so `m.state` corresponds to the state whose `after` fired. `onStep` always sees the original (un-substituted) yield.
- **`haltState.debug.before = true`** — pauses on every halt entry (program exit AND subroutine return via halt-stack pop). Symbol-list filters on `haltState` are silent no-ops; only the `true` wildcard activates. `haltState` is a module-level singleton — clear in `afterEach` / `finally` for test isolation.
- **`MachineState.debugBreak`** field — optional metadata on every yield from `runStepByStep`; consumers can opt in to reading it and mirror `run()`'s pause behavior if desired.

### Changed (BREAKING)

- **`run()` is now `async`** and returns `Promise<void>`. Existing callers must update to `await machine.run({ ... })` (or `void machine.run({ ... })` if intentionally discarding the result). Without an `onDebugBreak` hook, debug breaks fire-and-resume invisibly — the trajectory observed by `onStep` is identical to running with all `debug` fields cleared.

## [3.0.2] - 2026-05-04

### Fixed

- **`Tape` constructor now normalises and validates `viewportWidth`** ([#95](https://github.com/mellonis/turing-machine-js/issues/95)). The constructor stored `viewportWidth` raw — the setter padded `#symbols` via `normalise()` and validated `>= 1` / bumped even values to odd, but the constructor did neither. As a result, `new Tape({ alphabet, symbols: ['a','b','a','b'], viewportWidth: 23 }).viewport.length` was `4` instead of `23`, and `viewportWidth: 0` or `viewportWidth: 4` silently produced an invalid tape. The constructor now defers to the setter, so a single source of truth handles validation + normalisation.

### Changed (observable)

- A constructor call with an out-of-range `position` (e.g. `position: 5` with `symbols: ['x']`) now normalises at construction — the symbol array is padded with blanks so `position` lands inside the viewport. Previously the tape was left in a malformed state until the first head movement triggered `normalise()`. Strictly a fix, but observable if user code inspected `.symbols.length` immediately after construction.

## [3.0.1] - 2026-04-30

### Fixed

- **`graphFormats.ts` — polynomial-time regex (CodeQL `js/polynomial-redos`).** `alphabetsRegex` was `/^%%\s*alphabets:\s*(.+)$/`, where the `\s*` and `(.+)` both match whitespace, letting the engine try N+1 split points on inputs like `"%%alphabets:"` followed by many trailing spaces. Anchored the first captured char as `\S` to remove the ambiguity.

### Added

- **`MachineState` re-export** from `index.ts`. The type was always `export type MachineState = ...` in `classes/TuringMachine.ts`, but the package barrel didn't surface it. Consumers (notably `@post-machine-js/machine`'s `PostMachine` overrides of `run` / `runStepByStep`) can now `import { type MachineState } from '@turing-machine-js/machine'` directly, dropping any local `Generator<infer T>` workaround.

### Changed (internal)

- Removed the unreachable `if (hasCycles) return` guard at the top of `summarizeGraph`'s `visit()` cycle-detection. The recursive call pattern (outer for-loop checks before calling, inner loop checks after each recursive call) ensures `visit()` is never invoked when `hasCycles` is already true. Static analysis confirmed the guard was dead code.
- Tightened test coverage on `State.ts` and the v3 utilities — overall coverage rose from 95.64% / 88.39% / 95.5% (statements/branches/lines) to 98.39% / 94.01% / 98.34%. New tests cover invalid-input paths in the `State` constructor (string-keyed definitions, non-`State`/`Reference` `nextState`, empty-array commands), the `getSymbol` fallback to `ifOtherSymbol`, the `toGraph` skip of unbound `Reference` transitions, the `fromGraph` cyclic-override-halt error, and the previously-unexercised branches in `splitUnescaped`, `parsePatternString`, `parseMovementLabel`, and `fromMermaid`'s ensureNode update / error paths.

## [3.0.0] - 2026-04-30

### Added

- **`State.toGraph(state, tapeBlock)`** static — walks the reachable graph from a state and returns a serializable `Graph` (states, transitions, alphabets).
- **`State.fromGraph(graph)`** static — inverse of `toGraph`; rebuilds `State` instances + a fresh `TapeBlock` from a `Graph`. Round-trips losslessly via `toMermaid` / `fromMermaid`.
- **`State.inspect(state)`** static — single-state introspection (id, name, isHalt, override-halt target, transitions) without graph traversal or a tapeBlock.
- **`toMermaid(graph)`** — renders a `Graph` to Mermaid flowchart syntax.
- **`fromMermaid(text)`** — parses Mermaid produced by `toMermaid` back into a `Graph`.
- **`summarize(state, tapeBlock)`** / **`summarizeGraph(graph)`** — quantitative analysis of a state graph (state count, transition count, composition depth, cycles, alphabet sizes). Useful for comparing two implementations of the same algorithm.
- **`equivalentOn(reference, candidate, cases, options?)`** — behavioral equivalence checking. Runs both machines on test cases and reports agreement, first-divergence step, and per-side step counts. Supports same-alphabet and (with custom comparator) cross-alphabet comparison.
- New type exports: `Graph`, `GraphNode`, `GraphTransition`, `GraphCommand`, `GraphSummary`, `Runnable`, `EquivalenceCase`, `EquivalenceResult`, `EquivalenceReport`.

### Changed

- TypeScript `target` and `module` raised from `ES6` to `ES2020` (consumers see compiled `dist/` only — no observable difference).

### Removed

- **BREAKING** — the `./src` subpath in `package.json` `exports` was removed. Consumers using `import { ... } from '@turing-machine-js/machine/src'` must drop the `/src` suffix and use `import { ... } from '@turing-machine-js/machine'`.

### Migration

```diff
- import { ... } from '@turing-machine-js/machine/src';
+ import { ... } from '@turing-machine-js/machine';
```

The `/src` subpath was an in-monorepo dev-time shim that never had a real reason to be on the npm tarball.

## [2.0.2] - earlier

Initial public 2.x release.
