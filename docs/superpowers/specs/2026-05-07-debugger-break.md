# Debugger break for State graphs — design

**Status:** Draft. Not yet implemented.
**Date:** 2026-05-07
**Repo:** `@turing-machine-js/machine`
**Issue:** [mellonis/turing-machine-js#98](https://github.com/mellonis/turing-machine-js/issues/98)

---

## 1. Motivation

The engine has two ways to pause/stop today:

1. **Halt** — `nextState: haltState` stops the loop. With `withOverrodeHaltState(continuation)` it acts as "subroutine return" via the `TuringMachine` halt-stack.
2. **External pacing** — `runStepByStep` returns a Generator; the caller decides when to call `.next()`. `run()` consumes the generator without intervention.

Neither lets a **graph author** plant a "stop here" marker in the graph. To pause at a specific point during continuous `run()`, the runner has to externally know which state to watch — impossible in `run()`, verbose in `runStepByStep`.

This proposal adds an in-graph breakpoint that:

- works for both `runStepByStep` and `run()`,
- is invisible to passive observers (`onStep` loggers see no behavioral difference),
- can be set/unset at runtime without rebuilding the graph,
- supports symbol-based filtering (break only when the head shows specific symbols),
- supports both before-command and after-command timings per state.

The goal is **per-state breakpoints with symbol filtering**, not per-edge. (Pure per-edge granularity is sacrificed for runtime mutability and per-state robustness — see §10.)

---

## 2. Design at a glance

A **mutable** `debug` field on `State`, backed by a shared internal `Ref` cell so that wrappers (`withOverrodeHaltState`) see assignments and nullings. `DebugConfig` is a **class** with validating setters for `before` / `after`; assigned arrays are deep-frozen so in-place mutation (`push`, index-write) fails fast. Plain-object input to `state.debug = ...` is automatically wrapped:

```ts
class DebugConfig {
  constructor(
    ownerState: State,
    initial?: { before?: symbol[] | true; after?: symbol[] | true },
  );

  get before(): readonly symbol[] | true | undefined;
  set before(v: symbol[] | true | undefined);   // validates, freezes a copy

  get after(): readonly symbol[] | true | undefined;
  set after(v: symbol[] | true | undefined);    // validates, freezes a copy
}

class State {
  // Internal: shared mutable cell.
  #debugRef: { current: DebugConfig | null } = { current: null };

  get debug(): DebugConfig | null { return this.#debugRef.current; }

  // Setter accepts:
  //   - null       → clears the cell
  //   - DebugConfig instance → stored as-is (caller controls owner)
  //   - plain object         → wrapped: `new DebugConfig(this, value)`
  set debug(v: DebugConfig | { before?: symbol[] | true; after?: symbol[] | true } | null);

  // ...everything else unchanged
}
```

Setting `state.debug` makes the engine pause when execution visits that state and the current head symbol matches the filter. The pause is exposed through a new `onDebugBreak` hook on `run()` (otherwise invisible).

```ts
const myState = new State({
  [symA]: { command: cmdA, nextState: nextA },
  [symB]: { command: cmdB, nextState: nextB },
});

// At any time — build-time or runtime:
myState.debug = {
  before: [symA],   // pause before applying myState's command for symA
  after: [symB],    // pause after applying myState's command for symB
};

// Disable later:
myState.debug = null;
```

---

## 3. API

### 3.1 `State.debug`

A mutable accessor backed by a shared `Ref<DebugConfig | null>` cell. Default `null`. Engine reads it on every iteration that visits the state. Mutations (including `state.debug = null` to clear) take effect on the next visit, and propagate to all states that share the same underlying ref (see §8.1).

**Setter input shapes.** The setter accepts:

- `null` — clears the cell.
- A `DebugConfig` instance — stored directly. Validation already ran when the instance's setters were assigned, so no re-validation here.
- A plain object literal `{ before?, after? }` — wrapped automatically: `this.#debugRef.current = new DebugConfig(this, value)`. The DebugConfig's constructor invokes its own setters, which validate and freeze.

**Validation site (`DebugConfig` setters).** Setting `cfg.before = [...]` or `cfg.after = [...]` calls a validator on the config's `ownerState`. The validator iterates the supplied array and ensures every symbol is either `ifOtherSymbol` OR a transition key of `ownerState.#symbolToDataMap`. On failure:

```
State.debug.<before|after>: symbol is not a transition key of this state
(state name: <name>). Common cause: symbol comes from a different tape block,
or doesn't match any of this state's transitions.
```

This catches three classes of footgun fail-fast at the assignment site:

- **Cross-tape-block symbols.** `tapeBlock.symbol([...])` interns per-tape-block; the same logical pattern in two tape blocks produces two distinct JS `Symbol` values. Putting a foreign tape-block's symbol in a filter would never match — silent breakpoint failure.
- **Cross-state symbols.** A symbol that's a transition key of a *different* state on the same tape block — also never matches, also silent.
- **Random `Symbol(...)`.** Anything not interned by the tape block.

`true` (wildcard), `[]` (empty list, never matches), and `undefined` (field absent) bypass validation. `ifOtherSymbol` is always allowed in the array. Valid filters are accepted regardless of whether the state has an `ifOtherSymbol` transition — if the state doesn't, the engine's `getCommand` would throw before the filter ever fires, which is a separate (existing) error path.

Validation runs at assignment time only, not per-iteration — the engine's hot path is unaffected.

**Post-assignment immutability via frozen arrays.** When a `DebugConfig` setter receives a list filter, it stores `Object.freeze([...v])` (a frozen copy of the input). This means:

- `state.debug.before.push(sym)` — `TypeError: Cannot add property X, object is not extensible`.
- `state.debug.before[0] = sym` — same `TypeError`.

To extend a filter at runtime, the user re-assigns through the setter (which re-validates and re-freezes):

```ts
state.debug.before = [...state.debug.before, newSym];   // validates the new array, freezes it
```

This is the ergonomic incremental-update path. The `Array.isArray(...)` shape stays consistent for the consumer; only the identity of the underlying array changes between assignments.

`state.debug = { ...state.debug, before: [...] }` (full-config reassignment) also works — it goes through `State.debug` setter and rebuilds a `DebugConfig`.

The freeze is on the array, not on the original input — the user's source array is left untouched (a copy is stored).

### 3.2 `DebugConfig`

```ts
export class DebugConfig {
  /**
   * @param ownerState  The State this config belongs to. Used by the
   *                    setters' validators to resolve transition keys.
   * @param initial     Optional initial filter values. Each is run through
   *                    its setter — same validation and freezing rules.
   */
  constructor(
    ownerState: State,
    initial?: { before?: symbol[] | true; after?: symbol[] | true },
  );

  /** Filter for the "before-command" pause. See §4. */
  get before(): readonly symbol[] | true | undefined;
  /** Validates the new filter and stores a frozen copy. */
  set before(v: symbol[] | true | undefined);

  /** As `before`, but the pause fires AFTER the state's command applies. */
  get after(): readonly symbol[] | true | undefined;
  set after(v: symbol[] | true | undefined);
}
```

- `before` — filter. Engine pauses **before** applying the state's command if the filter matches the resolved head symbol.
- `after` — filter. Engine pauses **after** applying the state's command if the filter matches.
- A filter is either:
  - a **list of symbols** — matches when `getSymbol(tapeBlock)` returns one of them. The list may include `ifOtherSymbol` as a regular element, in which case the filter matches the catch-all case (same meaning `ifOtherSymbol` has in transition keys);
  - the literal **`true`** — wildcard, matches any resolved symbol (interned or `ifOtherSymbol` fallback).
- Both `before` and `after` may be set. If both filters match the same symbol on the same visit, **two pauses fire** for that visit (before, then after).

The class is exported so users can construct configs explicitly (for cases where they want to share a config across states they consider equivalent — though the more idiomatic path is a plain-object literal that gets auto-wrapped).

> **Note:** `[ifOtherSymbol]` is **not** a wildcard — it matches only the no-explicit-pattern-match case. To match any symbol, write `true`. See §4.

### 3.3 `RunParameter` extension

```ts
type RunParameter = {
  initialState: State;
  stepsLimit?: number;
  onStep?: (machineState: MachineState) => void;
  onDebugBreak?: (machineState: MachineState) => void | Promise<void>; // NEW
};

// Signature change: run() returns Promise<void>.
async run(params: RunParameter): Promise<void>
```

Without `onDebugBreak`: behavior is unchanged from today — breakpoints fire-and-resume invisibly. With `onDebugBreak`: the hook is awaited at every break, holding execution open until it resolves. Suitable for UI integration ("Continue" button) and async test fixtures.

### 3.4 `MachineState` extension

```ts
type MachineState = {
  step: number;
  state: State;
  currentSymbols: string[];
  nextSymbols: string[];
  movements: symbol[];
  nextState: State;
  // NEW. Field is OMITTED entirely when this yield is not a debug break.
  // When present, at least one of `before` / `after` is `true`.
  debugBreak?: {
    before?: true;  // current state's `before` filter matched
    after?: true;   // previous state's `after` filter matched (firing at this boundary)
  };
};
```

When neither flag fires, `debugBreak` is **not present on the object** (no `debugBreak: undefined` field).

Loggers reading only the original fields are unaffected. `onDebugBreak` consumers read `debugBreak.before` / `debugBreak.after` to know which timing fired (§5.2 ensures only one flag is set per hook call, even when both are scheduled on the same yield).

**Important — `state` field semantics across timings:**

- For **`before` calls**, the `MachineState` describes the **current iteration**: `state` is the state about to apply its command, `currentSymbols` reflects the pre-apply tape, etc.
- For **`after` calls**, the `MachineState` is **substituted** by `run()` to reflect the **previous iteration** — i.e., the state whose `after` filter matched. So the consumer sees `state === theStateWhoseAfterFired`, with all fields (`step`, `currentSymbols`, `nextSymbols`, `movements`, `nextState`) describing that prior transition. The tape itself, observed externally, has already mutated by the time the hook fires.

This substitution makes the natural pattern `if (m.state === stateB && m.debugBreak?.after) {...}` work as expected — the consumer always sees "the state whose debug fired" in `m.state`.

`runStepByStep` consumers do not get a separate hook — they're pacing manually anyway. The `debugBreak` metadata is still attached to yields (with `state` reflecting the current iteration, no substitution since there's no hook to dispatch). Custom step-by-step consumers wanting `run()`-equivalent semantics need to track previous yields themselves.

---

## 4. Symbol filter semantics

Filter resolution uses `state.getSymbol(tapeBlock)` — the same symbol used to pick the state's outgoing command. Result is either an interned tape-pattern symbol or `ifOtherSymbol` if no pattern matches.

| Filter | Behavior |
|---|---|
| Field absent (`debug === null` or `debug.before` undefined) | Never |
| `[]` (empty list) | Never |
| `[symA]` | Match only when `getSymbol` returns `symA` |
| `[symA, symB]` | Match when `getSymbol` returns either |
| `[ifOtherSymbol]` | Match only when `getSymbol` falls back to `ifOtherSymbol` (no interned pattern matched) — same meaning as in transition keys |
| `true` | **Wildcard.** Match any resolved symbol. |

`ifOtherSymbol` inside `DebugConfig` is **not** a wildcard — it's a regular symbol that matches the unmatched-fallback case, consistent with its meaning in transition keys. To express "match anything," use the literal `true` (e.g. `before: true`).

---

## 5. Runtime semantics

Pause is anchored to **iteration boundaries** in the generator loop. There is no extra yield per breakpoint — each visit to a state still produces exactly one yield.

### 5.1 Loop changes (pseudocode)

```ts
let pendingAfterFromPrev = false;

while (!state.isHalt) {
  const symbol = state.getSymbol(this.#tapeBlock);
  const command = state.getCommand(symbol);
  let nextState = state.getNextState(symbol).ref;

  const beforeMatch = matchFilter(state.debug?.before, symbol);

  // Build yield object; only attach debugBreak when at least one flag fires.
  const yielded = {
    // ...existing fields with halt-pop substitution for nextState...
  };
  if (pendingAfterFromPrev || beforeMatch) {
    const dbg: { before?: true; after?: true } = {};
    if (pendingAfterFromPrev) dbg.after = true;
    if (beforeMatch) dbg.before = true;
    yielded.debugBreak = dbg;
  }
  yield yielded;

  pendingAfterFromPrev = false;

  // (existing) apply command, halt-pop, halt-stack push, state = nextState
  this.#tapeBlock.applyCommand(command, executionSymbol);
  // ...

  // After applying state's command — set pending-after flag for NEXT iteration's yield.
  if (matchFilter(state.debug?.after, symbol)) {
    pendingAfterFromPrev = true;
  }

  state = nextState;
}

// Edge case: pending after-break at halt.
// If the loop exits with pendingAfterFromPrev = true, the `after` break has nowhere to fire.
// Resolution: lost. Users wanting a pause at halt should set `haltState.debug.before = true`
// instead of `priorState.debug.after`. See §8.6.
```

### 5.2 `run()` consumer

When both `after` (from prev) and `before` (current) flags are set on a single yield, two hook calls fire in sequence: after-from-prev first, then before-current. `run()` passes a per-call view of the `MachineState` that exposes only the firing flag in `debugBreak`. For **after-calls**, `run()` additionally substitutes the entire `MachineState` with the **previous yield**, so `m.state` corresponds to the state whose `after` filter triggered (see §3.4):

```ts
async run({ initialState, stepsLimit, onStep, onDebugBreak }: RunParameter): Promise<void> {
  let prevYield: MachineState | null = null;

  for (const machineState of this.runStepByStep({ initialState, stepsLimit })) {
    // 'after' (from prev step): substitute prev yield so m.state is the source state.
    if (machineState.debugBreak?.after && onDebugBreak && prevYield) {
      await onDebugBreak({ ...prevYield, debugBreak: { after: true } });
    }
    // 'before' (current step): no substitution — m.state is the current state.
    if (machineState.debugBreak?.before && onDebugBreak) {
      await onDebugBreak({ ...machineState, debugBreak: { before: true } });
    }
    if (onStep) onStep(machineState);
    prevYield = machineState;
  }
}
```

`onStep` always sees the original (un-split, un-substituted) `machineState` — the engine's view of the trajectory is unaffected.

### 5.3 Transparency for `onStep`

`onStep` is invoked **once per yield**, after both possible debug-pauses for that yield. Loggers see the same trajectory of states/symbols/movements they would see with all `debug` fields cleared. The `debugBreak` field is metadata that loggers may choose to ignore.

---

## 6. Consumer matrix

| Consumer | What it sees |
|---|---|
| `runStepByStep` (generator) | One yield per state visit. `debugBreak` metadata present on yields where breaks fire, but no separate pause mechanism — the consumer is already pacing manually. |
| `run({ onStep })` no `onDebugBreak` | `onStep` called for every yield. Breaks fire-and-resume invisibly. Trajectory identical to `debug = null` everywhere. |
| `run({ onStep, onDebugBreak })` | `onDebugBreak` awaited at every break point (one or two times per yield, see §5.2). `onStep` still sees one call per yield. |

---

## 7. Examples

### 7.1 Pause before applying any command at `myState`

```ts
myState.debug = { before: true }; // wildcard — match any symbol
```

Every visit to `myState` pauses before that visit's command runs.

### 7.2 Pause only when `myState` sees `symX`

```ts
myState.debug = { before: [symX] };
```

Visits where the head shows `symX` pause; other symbols pass through normally.

### 7.3 Pause both before and after for the same symbol

```ts
myState.debug = { before: [symX], after: [symX] };
```

When `myState` is visited with `symX` on the head: pause → resume → apply → pause → resume → next iteration. Two `onDebugBreak` calls, sandwiching the apply.

### 7.4 Per-state effect through assignment

```ts
const stateRef = new State({...});
graphTransitionsUsingStateRef();   // built somewhere
graphAlsoUsingStateRef();          // built somewhere else

// Single assignment affects ALL references in the graph:
stateRef.debug = { before: true };
```

Compare to the (rejected) wrapper-based design where every `nextState: stateRef` site would have to be rewritten as `nextState: break(stateRef)`.

### 7.5 Composition with `withOverrodeHaltState`

```ts
const subroutine = innerState.withOverrodeHaltState(continuation);
innerState.debug = { before: [symX] };

// `subroutine` is a NEW state object. Does it see `innerState.debug`?
// → YES (this design): debug is shared by reference (see §8).
```

### 7.6 Pause only on the catch-all (fallback) symbol

```ts
const myState = new State({
  [tapeBlock.symbol([['a']])]: { command: ..., nextState: ... },
  [tapeBlock.symbol([['b']])]: { command: ..., nextState: ... },
  [ifOtherSymbol]: { command: ..., nextState: ... }, // catch-all
});

// Break only when the head shows something other than 'a' or 'b' —
// i.e., when the catch-all transition is about to fire.
myState.debug = { before: [ifOtherSymbol] };
```

Visits with `'a'` or `'b'` on the head pass through silently; visits with anything else (the catch-all path) pause first. Distinct from `before: true`, which would pause on every visit including `'a'` and `'b'`.

### 7.7 Interactive UI flow (demo)

```ts
// User clicks node `myState` in the visualization:
myState.debug = { before: true };

// Engine is mid-run; on the next visit, pauses.
// User inspects, clicks "Continue":
resolveOnDebugBreakHook();

// User clicks node again to clear:
myState.debug = null;
```

No graph rebuild required. The shared `Ref` (§8.1) ensures the assignment is visible from every state-object that's a wrapper of `myState` (e.g. `myState.withOverrodeHaltState(...)`).

---

## 8. Interactions with existing features

### 8.1 `withOverrodeHaltState` and the shared `Ref`

`state.withOverrodeHaltState(H)` returns a new state object with the same transition map. **Decision:** the new object shares the **same internal `Ref<DebugConfig | null>` cell** as the original — not just a snapshot of the current value.

```ts
class State {
  #debugRef: { current: DebugConfig | null } = { current: null };

  get debug() { return this.#debugRef.current; }
  set debug(v) { this.#debugRef.current = v; }

  withOverrodeHaltState(overrodeHaltState: State) {
    const s = new State(null, ...);
    s.#symbolToDataMap = this.#symbolToDataMap;
    s.#overrodeHaltState = overrodeHaltState;
    s.#debugRef = this.#debugRef;  // SHARE the cell
    return s;
  }
}
```

Why a `Ref`-cell instead of a plain field-copy: assignments and **nullings** propagate. After `original.debug = null`, every wrapper (whether created before or after the assignment) reads `null`. With a plain field-copy, a wrapper created BEFORE the null would still hold the old config. The cell makes "this is conceptually the same state" hold across all wrappers.

Chained wrappers (`state.withOverrodeHaltState(A).withOverrodeHaltState(B)`) all share the same cell via the chain.

If a user wants a wrapper with **independent** debug, they should construct a separate `State` object with the same transition map — debug-independence implies state-identity-independence.

### 8.2 `Reference` and forward-declaration

`Reference` resolves to a `State` via `.ref`. The engine reads `state.debug` after resolving the reference, so forward-declared cyclic graphs work transparently.

### 8.3 `toGraph` / `fromGraph` (serialization)

**Decision:** `debug` is **not serialized**. It's a runtime side-channel, not part of the graph's identity.

`toGraph(initialState, tapeBlock)` ignores the `debug` field. `fromGraph(graph)` produces states with `debug = null`. If callers need to preserve breakpoints across serialize/deserialize, they reapply them manually after deserialization.

### 8.4 `inspect`

`State.inspect(state)` MAY include the `debug` field in its output (read-only snapshot). Including it is helpful for debugging tooling. Cost is minimal.

### 8.5 `lock` / concurrent runs

`debug` mutations are not protected by `TapeBlock`'s `Lock`. Mutating `state.debug` while the machine is in a `run()` is allowed and observed on the next iteration. If a debug-aware UI mutates from a different async context, the engine will pick it up; no explicit synchronization needed because JS is single-threaded.

### 8.6 `haltState.debug` — pause on halt / subroutine return

`haltState` is a regular `State` instance with `id === 0`; the debug field works on it like any other. Setting `haltState.debug.before = true` causes a pause **every time the engine is about to enter halt**, which covers both:

- **Program halt** — the outermost halt with empty halt-stack. The pause fires immediately before the loop exits.
- **Subroutine return** — `nextState.isHalt && stack.length` (the existing pop logic at `TuringMachine.ts:101-103`). The pause fires before the pop replaces `nextState` with the popped continuation.

Use case: "stop me on every subroutine boundary" — useful when debugging the binary-numbers chains where many `withOverrodeHaltState` subroutines are stacked.

**Important caveat — singleton.** `haltState` is a module-level singleton shared across all machines in the process. Setting `haltState.debug` affects every running machine in this process, not just the current one. For test isolation, `haltState.debug = null` should be set in `afterEach` / `finally`. Long-term, if cross-machine isolation becomes a real concern, we can add a per-machine override config — out of scope here.

Implementation: the `before` filter check on the current state happens at the top of each iteration. To handle entering halt, the engine ALSO checks `nextState.debug` after computing `nextState` — if `nextState.isHalt && nextState.debug?.before` matches, fire a pause before the halt-pop logic executes.

`haltState.debug.after` is meaningless (halt has no command to apply) and is silently ignored.

---

## 9. Use cases

### 9.1 Programmatic breakpoints (graph author embeds)

```ts
const factorial = buildFactorialMachine();
factorial.someInternalState.debug = { before: [ifOtherSymbol] };
await machine.run({ initialState: factorial.start, onDebugBreak: pauseHook });
```

### 9.2 Test fixtures

```ts
test('halts at expected point', async () => {
  let captured = null;
  myState.debug = { after: [symX] };
  await machine.run({
    initialState,
    onDebugBreak: (m) => { captured = m; },
  });
  expect(captured.currentSymbols).toEqual(['expected']);
  myState.debug = null; // clean up
});
```

### 9.3 Interactive UI (machines-demo)

User toggles breakpoints by clicking state nodes in the graph visualization. The demo's run loop runs the machine in a Web Worker, awaiting `onDebugBreak` to gate execution on a "Continue" message from the main thread.

---

## 10. Trade-offs and rejected alternatives

### 10.1 Pure per-edge breakpoints (rejected)

A `break(target, filter?)` wrapper used as `nextState`. Per-edge granularity, but:
- **No runtime mutability** — to toggle a breakpoint, the graph must be rebuilt.
- **Per-state effect through global replacement is fragile** — every reference to the target must be rewritten; missing one silently disables the breakpoint there.

These two issues were the user's #2 and #3 critical concerns, decisive for choosing per-state.

### 10.2 Symmetric `breakAfter(source)` wrapper (rejected)

Originally proposed alongside `break(target)`. With the per-state field, both `before` and `after` timings live in the same `DebugConfig` object. Asymmetric filter semantics (target's symbol vs source's symbol) is also eliminated — both filters use the **state's own symbol resolution** uniformly.

### 10.3 Immutable `state.withDebug({...})` method (rejected)

Considered for stylistic consistency with `withOverrodeHaltState`. Rejected because:
- `with...` methods on State exist for compositional needs (the same subgraph reused with different halt-continuations). `debug` has no compositional use case — it's a runtime side-channel.
- Mutability is the **whole point** for runtime dynamism. An immutable method would be a parallel-but-redundant API.

### 10.4 Per-edge granularity loss

With the per-state design, you cannot break only on a specific incoming edge to a state — `state.debug` affects all visits. The `before` symbol filter approximates per-edge for cases where different incoming edges leave different head symbols at the target, but is not a full equivalent.

**Mitigation 1 — trampoline state.** Insert a pass-through state on the edge you care about. The trampoline carries the `debug` config; the original target stays clean. Awkward but workable for rare cases.

**Mitigation 2 — external bookkeeping in `onDebugBreak` via step adjacency.** Use external state in the consumer to gate the pause based on step adjacency. Example: pause at `stateA` only when arriving DIRECTLY from `stateB` (i.e., `B → A` is a single transition; `B → C → A` does NOT pause):

```ts
const ctx = { stepOnB: -Infinity };

stateB.debug = { after: true };
stateA.debug = { before: true };

await machine.run({
  initialState,
  onDebugBreak: async (m) => {
    if (m.state === stateB && m.debugBreak?.after) {
      // m.state === stateB because §5.2 substitutes prev yield for after-calls.
      ctx.stepOnB = m.step;     // record the step where B fired its after.
      return;                   // resume immediately, no user-visible pause.
    }
    if (m.state === stateA && m.debugBreak?.before) {
      if (m.step === ctx.stepOnB + 1) {
        // adjacent — A is the immediately-next step after B.
        await holdForUser();
      }
      // else: arrived at A through some intermediate state → resume immediately.
      return;
    }
  },
});
```

Why step adjacency rather than a boolean `lastWasB` flag: a boolean wouldn't get cleared on intermediate states (which have no debug config and thus no hook call). After `B → C → A`, a stale `lastWasB === true` would wrongly fire at A. Comparing `m.step === ctx.stepOnB + 1` is path-length-aware and correct without per-state cleanup.

The consumer treats the breakpoint as a **trigger**, not a final stop — committing to the user-visible pause only when the path-condition holds. This pattern handles arbitrary path/state correlations the static design can't express directly.

If true per-edge breakpoints turn out to be a common need, a complementary edge-wrapper API can be added later (the two designs are not mutually exclusive).

---

## 11. Resolved decisions

All previously-open questions have been settled by user review. Recording outcomes here for future reference.

### 11.1 Pending `after` at halt — RESOLVED

Decision: **silent loss.** Users wanting a pause at halt set `haltState.debug.before = true` instead (see §8.6). `state.debug.after` on a transition that leads to halt fires nothing — documented behavior.

Rationale: introducing a special "fire-after-loop" hook just for this edge case adds API complexity for a workflow that's better expressed via `haltState.debug` directly.

### 11.2 `ifOtherSymbol` semantic — RESOLVED

Decision: **`true` is the wildcard sentinel; `ifOtherSymbol` retains its existing meaning** (matches the unmatched-fallback case) inside debug filters. No dual-semantic — `ifOtherSymbol` means the same thing everywhere.

This was reflected in §3.2 and §4.

### 11.3 `onDebugBreak` timing parameter — RESOLVED

Decision: **no extra parameter on the hook.** `run()` passes a per-call view of `MachineState` with only the firing flag set in `debugBreak` (§5.2). The consumer disambiguates by reading `machineState.debugBreak.before` / `.after`.

### 11.4 `run()` becoming async — RESOLVED

Decision: **major version bump (v3 → v4).** `run()` returns `Promise<void>`. Callers update or add `void` cast.

### 11.5 `runStepByStep` and `debugBreak` metadata — RESOLVED

Decision: **keep the metadata on every yield.** Step-by-step consumers can opt in to reading it and mirror `run()`'s pause behavior if desired. Hiding it adds no value.

---

## 12. Out of scope

- **Conditional breakpoints based on full tape inspection.** Filter is by head symbol only.
- **Watchpoints** (pause on tape change at a position). Different feature.
- **Step-in / step-out / step-over** (debugger control beyond pause-and-continue). The current design is "pause until consumer resumes."
- **Tracepoints** (log on hit without pausing). Use `onStep` for logging needs.
- **Breakpoint catalog API** on `TuringMachine` (list/enumerate active breakpoints across the graph). Could be added later as a tooling helper that walks the graph and collects states with `debug != null`.
- **Builder-package support** (`@turing-machine-js/builder`'s declarative state-table). Adding a `debug` column is a follow-up.

---

## 13. Implementation footprint (rough estimate)

- `State.ts` — add `debug` field with mutable accessor; preserve in `withOverrodeHaltState` (one line). +5–10 lines.
- `TuringMachine.ts` — extend loop with filter check + pending-after flag, extend yield with metadata, make `run()` async with `onDebugBreak` await. +20–30 lines.
- `inspect` — optionally include `debug` in output. +5 lines.
- `toGraph` / `fromGraph` — explicitly skip `debug`; document. +1 comment.
- Tests — coverage parallel to existing halt/halt-override tests. New test file `State.debug.spec.ts` and additions to `TuringMachine.spec.ts`.
- Docs (README, JSDoc on the new types) — non-trivial. The dual `ifOtherSymbol` meaning needs explicit, prominent treatment.

No second stack, no new wrapper class, no new core abstractions.

---

## 14. Migration / rollout

Single PR introducing the field, the `onDebugBreak` hook, and the `run()` async signature. Major version bump in `turing-machine-js` (v3 → v4). Changelog notes the type-level break in `run()`'s return.

`builder` package and `library-binary-numbers` / `library-binary-numbers-bare` are unaffected at the surface — they don't use `debug`. They should be tested for regression to confirm the engine changes don't break existing graphs. Lockstep version bump as per release pattern.

### `post-machine-js` peer dependency

`@post-machine-js/machine` declares `@turing-machine-js/machine` as a **peer dependency** (currently `^3`). Two options:

- **(a) Widen peer to `^3 || ^4`** in `post-machine-js` v3 patch release. No code change required if `post-machine-js` doesn't call `run()` directly (it returns the underlying `TuringMachine` for the caller to drive). Verify by searching `post-machine-js`'s source for `.run(` and `.runStepByStep(` calls — if the only consumers are users' code, no break.
- **(b) Bump `post-machine-js` to v4** in lockstep. Cleaner version story; users upgrade both together.

**Recommendation:** start with (a) — minimum disruption — unless `post-machine-js` itself wraps `run()` and needs to surface `onDebugBreak`. If it does want to surface the new hook, then (b).
