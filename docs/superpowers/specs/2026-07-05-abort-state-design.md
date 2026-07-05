# abortState — non-overridable terminal state for abnormal termination

**Issue**: [#239](https://github.com/mellonis/turing-machine-js/issues/239)
**Target**: v7.1.0 (minor). The numeric surface consumers key on is untouched; rendered-Mermaid-id churn is accepted with a loud changelog line.
**Design authority**: this spec consolidates the issue body plus the decision comments on #239. Where a comment conflicts with this spec, the spec wins (comments 2–4 on rendering are superseded).

## 1. Motivation

`haltState` inside a called subroutine means *return*, not *stop* — that is the whole call/return mechanism (`if (nextState.isHalt && stack.length) nextState = stack.pop()`). Its flip side: a nested subroutine cannot terminate the entire machine. "Detected invalid input three calls deep — stop everything" is inexpressible; the only abnormal endings are host-level JS exceptions, which a machine program cannot trigger deliberately.

`abortState` is strictly opt-in. The existing idiom — reserving an alphabet symbol and writing an in-band error marker before halting — remains right for many machines. `abortState` is for when in-band signaling doesn't fit: no symbol to spare (a 2-symbol machine's only free output channel *is* the termination kind), or the final tape must stay a clean result (golden tests that diff tapes).

Prompted by the Rust toolchain (`machines/toolchains`), where PM-1 distinguishes `stp` from `hlt` and the optimizer's equivalence contract treats termination kind as an observable output.

## 2. Core semantic

> `abortState` is **never popped by the subroutine halt-stack and never composed by `withOverriddenHaltState`** — it punches straight through call/return and terminates the run.

- Run loop: transition into `abortState` ends the run regardless of the subroutine stack; the stack is NOT popped.
- Both composition directions are validation errors: `abortState.withOverriddenHaltState(x)` (overriding abort) and `x.withOverriddenHaltState(abortState)` (abort as continuation). Abort never appears on the subroutine stack, in wrapper composites, or in frame membership — transition to it directly.
- Aborting is a legitimate program outcome, not a host failure — no `Error` is thrown.

## 3. Identity scheme

Numeric ids (`State`-internal, `graph.nodes` keys). Nothing user-visible renumbers, ever:

| thing | id |
|---|---|
| halt | `0` (unchanged) |
| user states | `1, 2, 3, …` (unchanged) |
| sentinels | odd negatives, creation order: abort `−1`, #3 `−3`, #k `−(2k−3)` |
| halt marker, frame f | even negatives: `−2f` (**was `−f`**) |

Predicates: `isHalt ≡ id === 0`; `isAbort ≡ id === −1`; `isSentinel ≡ id ≤ 0`; halt marker ≡ even negative, with `frameId = −id / 2`.

Rationale: negative ids were already occupied — `toGraph` emits synthetic per-frame halt markers at `id = −frameId` (`stateGraph.ts`), so a dense sentinel sequence `−1, −2, …` collides with frame markers. The odd/even split gives two unbounded families that can never meet, and ids are assigned once and never renumbered (adding sentinel #4 at `−5` moves nobody).

**Boundary, explicitly chosen**: even negatives are halt-marker-only. Markers exist because halt is *composable* (frame-local meaning via `withOverriddenHaltState`); every other sentinel is abort-like by definition — one global node, zero markers. A future *composable* non-halt sentinel would be a major redesign that brings its own encoding; pre-reserving id space for it (`−2(2f−1)` markers, multiples of 4 free) was considered and rejected in favor of the self-evident `−2f`.

## 4. Mermaid id namespacing

Prefix-namespaced, total parsing rule (`u` user / `s` sentinel / `s0-` marker / `w_` frame):

| thing | Mermaid id |
|---|---|
| user states | `u{id}` (`u1`, `u2`, …) — **was `s{id}`** |
| sentinels | `s{ordinal}`: halt `s0`, abort `s1`, #k `s{k−1}` (`ordinal = (1 − id) / 2` for odd negatives) |
| halt marker, frame f | `s0-{f}` — reads as "frame-f-local stand-in for `s0`" — **was `c{f}`** |
| frame subgraphs | `w_{f}` (unchanged) |
| idle | `idle` (unchanged) |

Dash-in-node-id is validated against Mermaid: `s0-1` renders as a single node and works in `class` statements.

The old worries this replaces: `s1` was already taken by user state 1 under the old `s{id}` scheme (which is why users move to `u`), and the leading-`-`-in-composite-keys concern is moot — GraphTransition ids already use the `.` separator (alpha.5) precisely to be negative-safe, and abort has no outgoing transitions and never appears in wrapper composites anyway.

## 5. Diagram emit (`toMermaid`)

- Abort emits with the **same terminal shape as halt** — `s1(((abort)))` — distinguished by a `classDef` (dashed stroke, red accent) applied via a `class s1 …` line. Sentinels stay one shape family: double circle = run ends here; styling says abnormally. Hexagon/other shapes rejected — they read as "special node", not "terminal".
- The abort node appears **only when referenced** (falls out of the reachability walk — machines that never abort get no orphan abort node).
- In-frame abort transitions draw as plain **solid arrows straight to the global `s1`**, crossing the subgraph boundary — no per-frame retargeting, no abort markers. The punch-through is depicted literally, in deliberate contrast with halt's frame-local `s0-f` marker + dotted dispatch arrows.

## 6. Outcome signaling

1. **Step level (`runStepByStep`)**: no new channel — the final yielded `MachineState` has `nextState === abortState`, the exact idiom halt uses today. Identity check, zero API addition.
2. **`run()`**: returns the outcome (additive; currently returns nothing) — uniform shape:

   ```ts
   { outcome: 'halted' | 'aborted', state, stack, step }
   ```

   - `aborted`: `state` = the state that transitioned into `abortState`; `stack` = the call chain abort punched through — the backtrace, precisely the information abort otherwise discards.
   - `halted`: `stack` is `[]` **by construction** (haltState with a non-empty stack pops/returns; true halt only happens at depth zero) — which is why one uniform shape is honest and no union type is needed.
   - The generator also carries the outcome as its **return value** (`return { … }`, visible in the final `{ done: true, value }`). Documented caveat: `for...of` discards generator returns, so the last-frame `nextState` check stays the canonical step-level signal.
   - `stack` reuses #102's frozen-snapshot discipline (`Object.freeze(stack.slice())`) so the result object can't mutate engine internals.

Anti-pattern, explicitly rejected: an instance-level `lastRunOutcome` property — #196 moved the halt stack from instance to call scope to fix ghost-iteration on reuse; a stateful outcome field would reintroduce that bug class. Outcome is call-scoped, always.

## 7. DebugSession

1. `DebugSessionEvent` gains `'abort'` alongside `'halt'`. Listeners never fire for the wrong ending — a shared terminal event with a `kind` payload was rejected (existing halt listeners would start firing on aborts, semantically wrong for listeners that treat halt as success).
2. **Both** terminal events (`'halt'` and `'abort'`) receive the run-result object `{outcome, state, stack, step}` as their argument — the same shape `run()` returns. Additive for existing halt listeners (they declared zero args).
3. `abortState.debug` is a **boolean**, mirroring `haltState.debug` (#207): `abortState.debug = true` arms a pause with `{side: 'after', cause: 'breakpoint'}` on the abort-triggering iter, fired **before** the terminal `'abort'` event — "break on abnormal termination" with tapes still inspectable.

## 8. Serialization / validation / docs

- `State.toGraph` / `fromGraph` round-trip the abort node (`GraphNode.id` stays `number`; abort is `−1`, `isAbort` field mirrors `isHalt`).
- `fromMermaid` parses the new id namespace (`u`/`s`/`s0-` prefixes).
- Validation: overriding `abortState` throws; `abortState` accepts no transitions (terminal, like halt).
- `@turing-machine-js/visuals`: `indexGraph` / `bareIdOf` / `equivalentIds` and the graph-id ↔ DOM-id mapping learn the new Mermaid id scheme in the same release.
- README + `packages/machine/CHANGELOG.md` entry (mandatory per release process).

## 9. Churn budget (accepted)

- Numeric: only synthetic halt-marker keys move (`−f` → `−2f`); markers are excluded from `collectStates`, so no consumer-facing key semantics change.
- Mermaid: every `.mmd` golden changes mechanically (`s1` → `u1`, `c1` → `s0-1`); `library-binary-numbers/states.md` regenerates; visuals + machines-demo fixtures update in lockstep.

## 10. Follow-ups (separate issues)

- [post-machine-js#112](https://github.com/mellonis/post-machine-js/issues/112) — `abort` command mirroring `stop` (filed; open questions tracked there: group usage, argument guard, lockdown treatment).
- machines-demo: render the `aborted` outcome distinctly (to be filed when the engine work lands).
