# abortState Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `abortState` — a non-overridable terminal sentinel that punches through the subroutine call stack — with call-scoped run outcomes, a DebugSession `'abort'` event, and namespaced Mermaid ids.

**Architecture:** A second module-level `State` singleton with reserved id −1 (odd negatives = sentinels; halt markers move to even negatives −2f). The run loop returns a call-scoped `RunResult` from both `run()` and the `runStepByStep` generator. Rendering namespaces Mermaid ids by prefix (`u` user / `s` sentinel / `s0-` marker) with the mapper exported from the engine and consumed by visuals.

**Tech Stack:** TypeScript, Vitest (root `vitest.config.ts`, source-aliased bare imports), npm workspaces + Lerna.

**Spec:** `docs/superpowers/specs/2026-07-05-abort-state-design.md` (issue #239).

## Global Constraints

- Target version: **v7.1.0** (minor). Feature branch `feat/239-abort-state` off **updated master** (`git pull origin master` first). PR targets master (the v7 integration branch is retired post-7.0.0).
- Coverage floors enforced by `vitest.config.ts`: **97% statements / 90% branches / 95% functions / 97% lines** — run `npm run test:coverage` before the final push.
- No Claude/AI attribution in commit messages or PR text.
- Existing behavior invariants: user-state ids stay `1, 2, 3, …`; `haltState` stays id 0; `GraphNode.id` stays `number`; `matchedTransition.id` separator stays `.`.
- The version bump + `packages/*/CHANGELOG.md` entries land in a **separate release PR** per the repo release process (draft entry in the Appendix).
- All test files are colocated `*.spec.ts` next to source. Run a single file: `npx vitest run <path>`.

## File Structure

| File | Responsibility in this plan |
|---|---|
| `packages/machine/src/utilities/functions.ts` | `reserveSentinelId` latch so a sentinel can claim a fixed id without disturbing the 0,1,2,… counter |
| `packages/machine/src/classes/State.ts` | `abortState` singleton, `isAbort`/`isSentinel`, sentinel-boolean `debug` generalization, `withOverriddenHaltState` guards, `AbortState` type |
| `packages/machine/src/classes/TuringMachine.ts` | sentinel-aware run loop, `RunResult` type, generator/`run()` return values, `abortImminent` internal flag |
| `packages/machine/src/classes/DebugSession.ts` | `'abort'` event, terminal-event payloads, abort breakpoint |
| `packages/machine/src/utilities/graph.ts` | `GraphNode.isAbort` field |
| `packages/machine/src/utilities/stateGraph.ts` | marker ids −2f, abort node emission, `fromGraph`/`collectStates` sentinel handling |
| `packages/machine/src/utilities/graphFormats.ts` | new `mermaidIdFor`/`parseMermaidId` (exported), abort emit + classDef, `fromMermaid` parsing |
| `packages/machine/src/index.ts` | new public exports |
| `packages/visuals/src/applyHighlight.ts` | consume engine `mermaidIdFor` instead of hardcoded `s${id}`/`c${frameId}` |
| `packages/machine/README.md`, `packages/library-binary-numbers*/states.md` | docs + regenerated diagrams |

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch from updated master**

```bash
cd /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js
git checkout master && git pull origin master
git checkout -b feat/239-abort-state
npm test   # baseline green
```

Expected: all suites pass before any change.

---

### Task 1: Sentinel id infrastructure + `abortState` singleton

**Files:**
- Modify: `packages/machine/src/utilities/functions.ts`
- Modify: `packages/machine/src/classes/State.ts` (getters near `isHalt` at ~line 214; singleton exports after `haltState` at ~line 635)
- Modify: `packages/machine/src/index.ts`
- Test: `packages/machine/src/classes/State.spec.ts`

**Interfaces:**
- Consumes: existing `id(object)` counter, `State` constructor, `HaltState` alias pattern.
- Produces: `reserveSentinelId(value: number): void` (module-internal, exported from `functions.ts`); `State#isAbort: boolean` (`id === -1`); `State#isSentinel: boolean` (`id <= 0`); `export const abortState: AbortState` (singleton, `name === 'abort'`); `export type AbortState = State & { get debug(): boolean; set debug(v: boolean | null) }`.

- [ ] **Step 1: Write the failing tests** (append to `State.spec.ts`)

```ts
describe('abortState sentinel (#239)', () => {
  it('has reserved id -1 with sentinel predicates', () => {
    expect(abortState.id).toBe(-1);
    expect(abortState.isAbort).toBe(true);
    expect(abortState.isHalt).toBe(false);
    expect(abortState.isSentinel).toBe(true);
  });

  it('haltState is a sentinel; user states are not', () => {
    expect(haltState.isSentinel).toBe(true);
    expect(haltState.isAbort).toBe(false);
    const user = new State(null);
    expect(user.isSentinel).toBe(false);
    expect(user.isAbort).toBe(false);
    expect(user.id).toBeGreaterThan(0);
  });

  it('does not consume the sequential id counter', () => {
    const a = new State(null);
    const b = new State(null);
    expect(b.id).toBe(a.id + 1); // abortState's -1 came from the reserve latch, not the counter
  });

  it('is named abort', () => {
    expect(abortState.name).toBe('abort');
  });
});
```

Add `abortState` to the existing `State.ts` import in the spec file.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/machine/src/classes/State.spec.ts -t 'abortState sentinel'`
Expected: FAIL — `abortState` is not exported.

- [ ] **Step 3: Implement the reserve latch in `functions.ts`**

```ts
let pendingSentinelId: number | null = null;

// Reserve a fixed id for the NEXT object passed to `id()`. Used by State.ts
// to construct global sentinels (abortState = -1, #239) without consuming
// the 0,1,2,… counter that haltState and user states draw from. Sentinel
// ids are odd negatives assigned once in creation order; even negatives
// belong to toGraph's synthetic halt markers (see stateGraph.ts).
function reserveSentinelId(value: number): void {
  pendingSentinelId = value;
}

function id(object: object): number {
  if (!id[idWeakMapKey].has(object)) {
    if (pendingSentinelId !== null) {
      id[idWeakMapKey].set(object, pendingSentinelId);
      pendingSentinelId = null;
    } else {
      id[idWeakMapKey].set(object, id[idKey]);
      id[idKey] += 1;
    }
  }

  return id[idWeakMapKey].get(object)!;
}
```

Export `reserveSentinelId` alongside `id` and `uniquePredicate`.

- [ ] **Step 4: Implement predicates + singleton in `State.ts`**

Next to `isHalt` (~line 214):

```ts
get isAbort() {
  return this.#id === -1;
}

// Sentinels occupy id <= 0: halt at 0, then odd negatives in creation
// order (abort = -1, a hypothetical #3 = -3, #k = -(2k-3)). Even
// negatives are NOT sentinels — they're toGraph's synthetic per-frame
// halt markers, which never exist as State instances.
get isSentinel() {
  return this.#id <= 0;
}
```

After the `haltState` export (~line 635):

```ts
/**
 * Typed alias for the abortState singleton (#239). Same narrowing rationale
 * as `HaltState`: sentinel debug is a single boolean.
 */
export type AbortState = State & {
  get debug(): boolean;
  set debug(value: boolean | null);
};

reserveSentinelId(-1);
export const abortState: AbortState = new State(null, 'abort') as AbortState;
```

Add `reserveSentinelId` to the `functions.ts` import at the top of `State.ts`. Re-export from `packages/machine/src/index.ts` next to `haltState`: `abortState`, `type AbortState`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run packages/machine/src/classes/State.spec.ts`
Expected: PASS (new describe green, no regressions).

- [ ] **Step 6: Commit**

```bash
git add packages/machine/src/utilities/functions.ts packages/machine/src/classes/State.ts packages/machine/src/index.ts packages/machine/src/classes/State.spec.ts
git commit -m "feat(machine): abortState sentinel with reserved id -1 (#239)"
```

---

### Task 2: Sentinel-boolean `debug` on abortState

**Files:**
- Modify: `packages/machine/src/classes/State.ts` (`debug` getter ~line 229-260, setter ~line 262-300, `#haltDebug` field ~line 130)
- Test: `packages/machine/src/classes/State.spec.ts`

**Interfaces:**
- Consumes: Task 1's `isSentinel`/`isAbort`, existing `#haltDebug` boolean storage.
- Produces: `abortState.debug` accepts/returns `boolean` (and `null` to reset); object-shaped writes throw — same contract as `haltState.debug` (#207). Field renamed `#haltDebug` → `#sentinelDebug`.

- [ ] **Step 1: Write failing tests**

```ts
describe('abortState.debug (#239, mirrors #207)', () => {
  afterEach(() => { abortState.debug = null; haltState.debug = null; });

  it('accepts boolean and null', () => {
    abortState.debug = true;
    expect(abortState.debug).toBe(true);
    abortState.debug = false;
    expect(abortState.debug).toBe(false);
    abortState.debug = null;
    expect(abortState.debug).toBe(false);
  });

  it('rejects object-shaped writes', () => {
    expect(() => { (abortState as unknown as State).debug = { before: true } as never; })
      .toThrow(/only accepts boolean/);
  });

  it('is independent from haltState.debug', () => {
    abortState.debug = true;
    expect(haltState.debug).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run packages/machine/src/classes/State.spec.ts -t 'abortState.debug'`
Expected: FAIL — abortState currently takes the generic `DebugConfig` path (`isHalt` is false for it).

- [ ] **Step 3: Generalize the sentinel branches**

In `State.ts`: rename `#haltDebug` → `#sentinelDebug` (each singleton instance has its own field — no sharing). Change the two `if (this.isHalt)` guards in the `debug` getter (~line 237) and setter (~line 270) to `if (this.isSentinel)`. Generalize the two error messages, preserving their shape, e.g.:

```ts
throw new Error(
  `${this.name}.debug only accepts boolean (or null to reset). Use `
  + `\`${this.name}.debug = true\` to enable the ${this.name} breakpoint, false to `
  + 'disable it.',
);
```

and in the non-sentinel branch: `'Boolean assignment is reserved for sentinel states (haltState / abortState).'`. Update the `#sentinelDebug` field comment to mention both singletons.

- [ ] **Step 4: Run the full machine suite**

Run: `npx vitest run packages/machine/src/classes/State.spec.ts packages/machine/src/classes/DebugSession.spec.ts`
Expected: PASS — existing haltState.debug tests must survive the rename/generalization verbatim.

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/State.ts packages/machine/src/classes/State.spec.ts
git commit -m "feat(machine): boolean abortState.debug via generalized sentinel branch (#239)"
```

---

### Task 3: `withOverriddenHaltState` guards

**Files:**
- Modify: `packages/machine/src/classes/State.ts` (`withOverriddenHaltState` body — search `withOverriddenHaltState(` method definition)
- Modify: `docs/superpowers/specs/2026-07-05-abort-state-design.md` (§2, one clarifying line)
- Test: `packages/machine/src/classes/State.spec.ts`

**Interfaces:**
- Consumes: Task 1 predicates.
- Produces: `abortState.withOverriddenHaltState(x)` throws; `x.withOverriddenHaltState(abortState)` throws. Both messages name #239's rationale.

- [ ] **Step 1: Write failing tests**

```ts
describe('withOverriddenHaltState × abortState (#239)', () => {
  it('cannot override abortState', () => {
    const cont = new State(null);
    expect(() => abortState.withOverriddenHaltState(cont))
      .toThrow(/abortState cannot be overridden/);
  });

  it('cannot use abortState as the continuation', () => {
    const bare = new State(null);
    expect(() => bare.withOverriddenHaltState(abortState))
      .toThrow(/cannot be used as a withOverriddenHaltState continuation/);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run packages/machine/src/classes/State.spec.ts -t 'withOverriddenHaltState × abortState'` → FAIL (no guards yet).

- [ ] **Step 3: Add guards at the top of `withOverriddenHaltState`**

```ts
if (this.isAbort) {
  throw new Error(
    'abortState cannot be overridden — it is non-composable by definition; '
    + 'it punches through the call stack and terminates the run (#239)',
  );
}

if (overriddenHaltState instanceof State && overriddenHaltState.isAbort) {
  throw new Error(
    'abortState cannot be used as a withOverriddenHaltState continuation — '
    + 'abort never sits on the subroutine stack; transition to abortState directly (#239)',
  );
}
```

(Adjust the parameter name to the actual signature. If the parameter accepts `Reference`, guard only the `State` case — a `Reference` later bound to `abortState` is caught at run time by the loop's sentinel handling and is out of scope here.)

- [ ] **Step 4: Amend the spec** — in §2 of `2026-07-05-abort-state-design.md`, replace the second bullet with:

```markdown
- Both composition directions are validation errors: `abortState.withOverriddenHaltState(x)` (overriding abort) and `x.withOverriddenHaltState(abortState)` (abort as continuation). Abort never appears on the subroutine stack, in wrapper composites, or in frame membership — transition to it directly.
```

- [ ] **Step 5: Run tests** — `npx vitest run packages/machine/src/classes/State.spec.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/machine/src/classes/State.ts packages/machine/src/classes/State.spec.ts docs/superpowers/specs/2026-07-05-abort-state-design.md
git commit -m "feat(machine): reject abortState in both withOverriddenHaltState directions (#239)"
```

---

### Task 4: Run loop punch-through + `RunResult`

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts` (`run` ~line 148, `runStepByStep` ~line 157-271, `MachineStateInternal` ~line 51)
- Modify: `packages/machine/src/index.ts` (export `type RunResult`)
- Test: `packages/machine/src/classes/TuringMachine.spec.ts`

**Interfaces:**
- Consumes: `abortState`, `isAbort`, `isSentinel` (Task 1).
- Produces:
  ```ts
  export type RunResult = {
    outcome: 'halted' | 'aborted';
    state: State;              // the state that transitioned into the sentinel
    stack: readonly State[];   // frozen; [] for 'halted' by construction
    step: number;
  };
  ```
  `runStepByStep(...): Generator<MachineState, RunResult>`; `run(...): RunResult`; `MachineStateInternal` gains `abortImminent: boolean`.

- [ ] **Step 1: Write failing tests**

The repo's existing `TuringMachine.spec.ts` has helpers for building small machines — reuse its `TapeBlock`/`Alphabet` setup pattern. Test skeleton (adapt symbol construction to the file's local helpers):

```ts
describe('abortState run semantics (#239)', () => {
  // build: tapeBlock over alphabet ['a','b']; states:
  //   inner: on 'a' -> abortState; ifOtherSymbol -> haltState
  //   outer = inner.withOverriddenHaltState(cont); cont: ifOtherSymbol -> haltState

  it('abort punches through the subroutine stack', () => {
    // tape 'a', start at outer → inner reads 'a' → abortState
    const result = machine.run({initialState: outer});
    expect(result.outcome).toBe('aborted');
    expect(result.state).toBe(inner);          // the triggering state (the bare)
    expect(result.stack).toEqual([cont]);      // the frame abort punched through
    expect(Object.isFrozen(result.stack)).toBe(true);
    expect(result.step).toBe(1);
  });

  it('halt returns outcome halted with empty stack', () => {
    // tape 'b' → inner falls to ifOtherSymbol → halt pops to cont → cont halts
    const result = machine.run({initialState: outer});
    expect(result.outcome).toBe('halted');
    expect(result.stack).toEqual([]);
  });

  it('the generator return value carries the outcome', () => {
    const gen = machine.runStepByStep({initialState: outer});
    let r = gen.next();
    while (!r.done) r = gen.next();
    expect(r.value.outcome).toBe('aborted');
  });

  it('the final yield shows nextState === abortState (canonical step-level signal)', () => {
    let last;
    for (const m of machine.runStepByStep({initialState: outer})) last = m;
    expect(last!.nextState).toBe(abortState);
  });

  it('initialState === abortState ends immediately as aborted at step 0', () => {
    const result = machine.run({initialState: abortState});
    expect(result).toMatchObject({outcome: 'aborted', state: abortState, step: 0});
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run packages/machine/src/classes/TuringMachine.spec.ts -t 'abortState run semantics'` → FAIL (`run` returns void; loop would misbehave on abort).

- [ ] **Step 3: Implement**

In `TuringMachine.ts`:

1. Define and export `RunResult` (shape above) near `MachineState`.
2. `MachineStateInternal` gains `abortImminent: boolean`; in the accessor installation (~line 241), add `const abortImminent = nextState === abortState;` beside `haltImminent` and include it in the returned object.
3. Loop condition `while (!state.isHalt)` → `while (!state.isSentinel)` (covers a caller passing `abortState`/future sentinels as `initialState` without iterating a transitionless sentinel).
4. Track the triggering state: declare `let lastIterState: State | null = null;` before the loop; set `lastIterState = state;` immediately before `state = nextState;`.
5. After `this.#tapeBlock.applyCommand(command, executionSymbol);` insert the punch-through exit **before** the halt-pop:

```ts
if (nextState.isAbort) {
  // Punch-through (#239): the stack is NOT popped — it becomes the
  // backtrace in the result. Freeze so the caller can't mutate engine
  // internals (same discipline as the #102 stack snapshot).
  return {outcome: 'aborted', state, stack: Object.freeze(stack.slice()), step: i};
}
```

6. After the loop (and reachable from the `break` in the thrown-haltState catch), return the halted result:

```ts
return {
  outcome: state.isAbort ? 'aborted' : 'halted',
  state: lastIterState ?? state,      // ?? covers initialState === sentinel (0 iters)
  stack: Object.freeze(stack.slice()), // [] by construction for 'halted'
  step: i,
};
```

(The `state.isAbort` ternary only matters for the zero-iteration `initialState === abortState` case; mid-run aborts returned inside the loop.)

7. `run()` drains manually to capture the return value:

```ts
run({initialState, stepsLimit = 1e5}: RunParameter): RunResult {
  const gen = this.runStepByStep({initialState, stepsLimit});
  let r = gen.next();
  while (!r.done) r = gen.next();
  return r.value;
}
```

8. Generator signature: `Generator<MachineState, RunResult>`. Note the pop-preview at ~line 203 (`nextStateForYield`) is deliberately untouched — abort yields `nextState === abortState` raw, which IS the canonical signal.

Export `type RunResult` from `packages/machine/src/index.ts`.

- [ ] **Step 4: Run the whole machine + dependents suite** — `npm test` → PASS (builder/libraries import the bare specifier; `run()` returning a value instead of void is additive for them).

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/TuringMachine.ts packages/machine/src/index.ts packages/machine/src/classes/TuringMachine.spec.ts
git commit -m "feat(machine): abort punch-through + call-scoped RunResult from run/runStepByStep (#239)"
```

---

### Task 5: DebugSession `'abort'` event + abort breakpoint

**Files:**
- Modify: `packages/machine/src/classes/DebugSession.ts` (event types ~line 21-56, `#drive` ~line 299-376)
- Test: `packages/machine/src/classes/DebugSession.spec.ts`

**Interfaces:**
- Consumes: `RunResult` (Task 4), `abortState` + boolean `debug` (Tasks 1-2), `abortImminent` internal flag (Task 4).
- Produces: `DebugSessionEvent = 'pause' | 'step' | 'iter' | 'halt' | 'abort'`; both terminal listeners typed `(result: RunResult) => void | Promise<void>`; exactly one terminal event fires per natural ending (never both, never on `stop()`).

- [ ] **Step 1: Write failing tests** (reuse the machine fixtures from Task 4's shape)

```ts
describe("DebugSession 'abort' event (#239)", () => {
  it('fires abort (not halt) with the RunResult payload', async () => {
    const halts: RunResult[] = []; const aborts: RunResult[] = [];
    const session = new DebugSession(machine, {initialState: outer}); // 'a' tape → aborts
    session.on('halt', (r) => { halts.push(r); });
    session.on('abort', (r) => { aborts.push(r); });
    await session.start();
    expect(halts).toHaveLength(0);
    expect(aborts).toHaveLength(1);
    expect(aborts[0]).toMatchObject({outcome: 'aborted', state: inner});
  });

  it('halt listeners now receive the RunResult (additive)', async () => {
    let got: RunResult | undefined;
    const session = new DebugSession(machine2, {initialState: outer2}); // 'b' tape → halts
    session.on('halt', (r) => { got = r; });
    await session.start();
    expect(got).toMatchObject({outcome: 'halted', stack: []});
  });

  it('abortState.debug pauses on the after side before the abort event', async () => {
    abortState.debug = true;
    const order: string[] = [];
    const session = new DebugSession(machine, {initialState: outer});
    session.on('pause', (m) => {
      order.push(`pause:${m.pause.side}:${m.pause.cause}`);
      session.continue();
    });
    session.on('abort', () => { order.push('abort'); });
    await session.start();
    abortState.debug = null;
    expect(order).toEqual(['pause:after:breakpoint', 'abort']);
  });

  it('no terminal event after stop()', async () => {
    // existing stop() test pattern — add an abort listener and assert it stays silent
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run packages/machine/src/classes/DebugSession.spec.ts -t 'abort'` → FAIL (`'abort'` is not a valid event).

- [ ] **Step 3: Implement**

1. `DebugSessionEvent` gains `'abort'`. Listener typing:

```ts
export type DebugSessionListener<E extends DebugSessionEvent> =
  E extends 'halt' | 'abort'
    ? (result: RunResult) => void | Promise<void>
    : E extends 'pause'
      ? (machineState: PausedMachineState) => void | Promise<void>
      : (machineState: MachineState) => void | Promise<void>;
```

`ListenerMap` gains `abort: Array<(result: RunResult) => void | Promise<void>>;` and `halt` changes to the same element type; initialize `abort: []` in the field literal (~line 84). Update the doc comment: both terminal events are fire-and-forget and carry the `RunResult`.

2. `#drive` switches from `for...of` (which discards the generator return) to manual iteration, preserving every early `return` on `#stopped`:

```ts
const gen = this.#machine.runStepByStep(this.#parameter);
let r = gen.next();
while (!r.done) {
  const machineState = r.value;
  this.#iterating = true;
  if (this.#stopped) return;
  // ... existing body of the for-of loop, verbatim ...
  r = gen.next();
}
const result = r.value;

if (!this.#stopped) {
  const listeners = result.outcome === 'aborted' ? this.#listeners.abort : this.#listeners.halt;
  for (const fn of listeners) {
    void fn(result);
  }
}
```

3. Abort breakpoint — extend `hasAfterBreakpoint` (~line 315):

```ts
const hasAfterBreakpoint = (matchedSymbol !== undefined
  && matchFilter(machineState.state.debug?.after, matchedSymbol))
  || (internal?.haltImminent === true && haltState.debug === true)
  || (internal?.abortImminent === true && abortState.debug === true);
```

Import `abortState` next to `haltState` (line 1). Note: `stop()` called from inside the abort-pause leaves `#stopped` set, so the terminal-dispatch guard already suppresses the abort event — this is what the fourth test pins.

- [ ] **Step 4: Run** — `npx vitest run packages/machine/src/classes/DebugSession.spec.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/classes/DebugSession.ts packages/machine/src/classes/DebugSession.spec.ts
git commit -m "feat(machine): DebugSession abort event, RunResult terminal payloads, abort breakpoint (#239)"
```

---

### Task 6: Graph layer — marker ids −2f, abort node, round-trip

**Files:**
- Modify: `packages/machine/src/utilities/graph.ts` (`GraphNode`, ~line 15)
- Modify: `packages/machine/src/utilities/stateGraph.ts` (marker ids ~lines 341+354; node literals ~lines 63, 87, 108, 161, 356; `fromGraph` sentinel mapping ~line 652; frame membership; `collectStates` ~line 586+)
- Test: `packages/machine/src/utilities/stateGraph.spec.ts`

**Interfaces:**
- Consumes: `abortState`, `isAbort`, `isSentinel`.
- Produces: `GraphNode.isAbort: boolean` on every node; halt marker ids `= -2 * frameId`; abort emits as one top-level node `{id: -1, name: 'abort', isAbort: true, isHalt: false, frameId: null, transitions: []}`; `fromGraph` maps `isAbort` nodes to the `abortState` singleton; `collectStates` includes the abort singleton (empty `transitionSymbols`) when referenced.

- [ ] **Step 1: Write failing tests**

```ts
describe('graph layer × abortState (#239)', () => {
  it('halt markers use even negative ids -2f', () => {
    // any existing wrapper fixture machine in this spec file:
    const graph = State.toGraph(outer, tapeBlock);
    const markers = Object.values(graph.nodes).filter((n) => n.isHaltMarker);
    expect(markers.length).toBeGreaterThan(0);
    for (const m of markers) {
      expect(m.id).toBeLessThan(0);
      expect(m.id % 2).toBe(-0 % 2 === 0 ? m.id % 2 : 0); // simply: expect(m.id % 2).toBe(-0); use Math.abs(m.id) % 2 === 0
      expect(Math.abs(m.id) % 2).toBe(0);
      expect(m.id).toBe(-2 * m.frameId!);
    }
  });

  it('abort emits as a single top-level node with id -1', () => {
    const graph = State.toGraph(outerWithAbort, tapeBlock); // Task 4's abort machine
    const abortNode = graph.nodes[-1];
    expect(abortNode).toMatchObject({id: -1, isAbort: true, isHalt: false, frameId: null, name: 'abort'});
    expect(abortNode.transitions).toEqual([]);
  });

  it('machines that never abort get no abort node', () => {
    const graph = State.toGraph(plainHaltMachineStart, tapeBlock);
    expect(graph.nodes[-1]).toBeUndefined();
  });

  it('in-frame abort transitions keep nextStateId -1 (no marker retarget)', () => {
    const graph = State.toGraph(outerWithAbort, tapeBlock);
    const innerNode = Object.values(graph.nodes).find((n) => n.frameId !== null && !n.isHaltMarker && n.transitions.some((t) => t.nextStateId === -1));
    expect(innerNode).toBeDefined();
  });

  it('fromGraph maps the abort node back to the singleton', () => {
    const graph = State.toGraph(outerWithAbort, tapeBlock);
    const {start} = State.fromGraph(graph);
    const rebuilt = State.toGraph(start, /* rebuilt tapeBlock per existing fromGraph test pattern */);
    expect(rebuilt.nodes[-1]).toMatchObject({isAbort: true});
    // identity: running the rebuilt machine and aborting must end on THE singleton
  });

  it('collectStates includes the abort singleton with empty transitionSymbols', () => {
    const map = State.collectStates(outerWithAbort, tapeBlock);
    expect(map.get(-1)?.state).toBe(abortState);
    expect(map.get(-1)?.transitionSymbols).toEqual([]);
  });
});
```

(Clean up the first test's parity assertion to just `expect(Math.abs(m.id) % 2).toBe(0)` — the draft line shows the intent.)

- [ ] **Step 2: Run to verify failure** — `npx vitest run packages/machine/src/utilities/stateGraph.spec.ts -t 'abortState'` → FAIL.

- [ ] **Step 3: Implement in `stateGraph.ts` + `graph.ts`**

1. `graph.ts`: add `isAbort: boolean;` to `GraphNode` (after `isHalt`).
2. `stateGraph.ts`: every `GraphNode` object literal gains `isAbort` — `state.isAbort` where a live `State` is at hand (lines ~63/87/108/161), literal `false` for halt markers (~line 356).
3. Marker ids: `const haltMarkerId = -node.frameId;` → `-2 * node.frameId` (~341) and `-frameId` → `-2 * frameId` (~354). Update the `id = -frameId` comments (~556, 586) to `id = -2 * frameId (even negatives; odd negatives are sentinel ids, #239)`.
4. Frame membership: in the frame/union-find computation, skip sentinel targets the way halt is skipped (`nextState.isSentinel` instead of `nextState.isHalt` in the reach-set walk) so abort never joins a frame and never retargets to a marker — only halt-bound transitions retarget.
5. `fromGraph`: where `id === 0` maps to `haltState`, add the sibling mapping — `node.isAbort` (or `id === -1`) → `abortState` singleton. Marker collapse (~655 comment) is unchanged (`isHaltMarker` flag, maps to `haltState`).
6. `collectStates`: mirror the halt-singleton entry — when the walk reaches `abortState`, include `{state: abortState, transitionSymbols: []}` at key `-1`, and extend the JSDoc singleton warning to name both sentinels (toggling `abortState.debug` affects every machine in the runtime).

- [ ] **Step 4: Run** — `npx vitest run packages/machine/src/utilities/stateGraph.spec.ts` → PASS. Then `npm test` — expect **failures in `graphFormats` / round-trip / visuals fixtures** from the marker id change; if the only failures are Mermaid-layer, proceed (Task 7 fixes them); any other failure gets fixed now.

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/utilities/graph.ts packages/machine/src/utilities/stateGraph.ts packages/machine/src/utilities/stateGraph.spec.ts
git commit -m "feat(machine): abort graph node, even-negative halt-marker ids, sentinel round-trip (#239)"
```

---

### Task 7: Mermaid layer — namespaced ids, abort emit, parse

**Files:**
- Modify: `packages/machine/src/utilities/graphFormats.ts` (`mermaidIdFor`/`parseMermaidId` ~line 30-45; node emit ~line 188-205; classDef emission near the tags block; `fromMermaid` node/class parsing)
- Modify: `packages/machine/src/index.ts` (export `mermaidIdFor`, `parseMermaidId`)
- Test: `packages/machine/src/utilities/graphFormats.spec.ts`, `test/round-trip.spec.ts`

**Interfaces:**
- Consumes: Task 6's graph shapes.
- Produces (public, consumed by visuals in Task 8):
  ```ts
  export function mermaidIdFor(id: number): string;   // 1→'u1', 0→'s0', -1→'s1', -3→'s2', -2→'s0-1', -4→'s0-2'
  export function parseMermaidId(s: string): number;  // exact inverse
  ```
  Abort emits `s1(((abort)))` + `classDef abortSentinel stroke:#c0392b,stroke-width:2px,stroke-dasharray:4 3` + `class s1 abortSentinel` (all three lines only when the abort node exists). `fromMermaid` round-trips.

- [ ] **Step 1: Write failing unit tests for the id mapping**

```ts
describe('mermaidIdFor / parseMermaidId namespacing (#239)', () => {
  const cases: Array<[number, string]> = [
    [1, 'u1'], [2, 'u2'], [42, 'u42'],       // user states
    [0, 's0'],                               // halt
    [-1, 's1'], [-3, 's2'], [-5, 's3'],      // sentinels (odd negatives)
    [-2, 's0-1'], [-4, 's0-2'], [-6, 's0-3'], // halt markers (even negatives)
  ];
  it.each(cases)('%d ⇄ %s', (num, str) => {
    expect(mermaidIdFor(num)).toBe(str);
    expect(parseMermaidId(str)).toBe(num);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run packages/machine/src/utilities/graphFormats.spec.ts -t namespacing` → FAIL (old `sN`/`cN` scheme; functions not exported).

- [ ] **Step 3: Implement the mapping**

```ts
// Maps a graph node id to its Mermaid id. Namespaced by prefix with a total
// parsing rule (#239): 'u' user state / 's0-' halt marker / other 's' sentinel.
//   - positive id N            → "uN"          (user state)
//   - id 0                     → "s0"          (haltState)
//   - odd negative id          → "s{(1-id)/2}" (sentinel: -1 → s1 abort, -3 → s2, …)
//   - even negative id -2f     → "s0-{f}"      (frame f's halt marker — a
//                                               frame-local stand-in for s0)
export function mermaidIdFor(id: number): string {
  if (id > 0) return `u${id}`;
  if (id === 0) return 's0';
  if (id % 2 === 0) return `s0-${-id / 2}`;
  return `s${(1 - id) / 2}`;
}

// Inverse of mermaidIdFor. Check 's0-' BEFORE the generic 's' branch.
export function parseMermaidId(s: string): number {
  if (s.startsWith('u')) return Number(s.slice(1));
  if (s.startsWith('s0-')) return -2 * Number(s.slice(3));
  const ordinal = Number(s.slice(1));
  return ordinal === 0 ? 0 : -(2 * ordinal - 1);
}
```

Export both from `graphFormats.ts` and re-export from `packages/machine/src/index.ts` next to `toMermaid`/`fromMermaid`.

- [ ] **Step 4: Write failing emit/parse tests**

```ts
describe('toMermaid × abortState (#239)', () => {
  it('emits the abort terminal with classDef, only when referenced', () => {
    const withAbort = toMermaid(State.toGraph(outerWithAbort, tapeBlock));
    expect(withAbort).toContain('s1(((abort)))');
    expect(withAbort).toContain('classDef abortSentinel stroke:#c0392b,stroke-width:2px,stroke-dasharray:4 3');
    expect(withAbort).toContain('class s1 abortSentinel');

    const without = toMermaid(State.toGraph(plainHaltMachineStart, tapeBlock));
    expect(without).not.toContain('abort');
  });

  it('in-frame abort edges are solid arrows to the global s1', () => {
    const text = toMermaid(State.toGraph(outerWithAbort, tapeBlock));
    // the in-frame bare uses a uN id and points straight at s1, not at a marker
    expect(text).toMatch(/u\d+ --> \|.*\| ?s1|u\d+ -->.*s1/);
  });

  it('round-trips through fromMermaid', () => {
    const graph = State.toGraph(outerWithAbort, tapeBlock);
    const text = toMermaid(graph);
    const reparsed = fromMermaid(text);
    expect(Object.values(reparsed.nodes).find((n) => n.isAbort)).toMatchObject({id: -1, name: 'abort'});
    expect(toMermaid(reparsed)).toBe(text); // bytewise, matching the existing round-trip discipline
  });
});
```

(Adjust the edge-label regex in the second test to the emitter's actual `-->|"label"|` syntax once visible in the first failing run — the assertion's substance is `u\d+` source and `s1` target with a solid arrow.)

- [ ] **Step 5: Implement emit + parse**

1. Emit, in the top-level nodes section (~line 190):

```ts
if (node.isHalt) {
  lines.push(`  ${mid}(((halt)))`);
} else if (node.isAbort) {
  lines.push(`  ${mid}(((abort)))`);
} else {
  lines.push(`  ${mid}["${labelOf(node)}"]`);
}
```

2. After the node/edge emission (next to the tags `classDef` block), when the graph contains an abort node:

```ts
if (Object.values(graph.nodes).some((n) => n.isAbort)) {
  lines.push('  classDef abortSentinel stroke:#c0392b,stroke-width:2px,stroke-dasharray:4 3');
  lines.push(`  class ${mermaidIdFor(-1)} abortSentinel`);
}
```

3. `fromMermaid`: parse `(((abort)))` node shape into `{id: parseMermaidId(mid), name: 'abort', isAbort: true, isHalt: false, isHaltMarker: false, frameId: null, transitions: [], tags: []}` (mirror the existing `(((halt)))` handling); teach the `class`/`classDef` scanner to treat `abortSentinel` lines as decorative (skip), exactly like tag classes; every parsed node literal gains `isAbort: false` by default.
4. No changes to edge handling: abort-bound transitions were never retargeted (Task 6), so they emit/parse as ordinary solid arrows crossing the subgraph boundary.

- [ ] **Step 6: Fix the fixture churn**

Run: `npm test`. Every `.mmd`-comparing fixture now differs mechanically (`s3` → `u3`, `c1` → `s0-1`). Update inline-string fixtures in `graphFormats.spec.ts`, `test/round-trip.spec.ts`, and any `packages/machine/src/utilities/*.spec.ts` snapshot by applying the new scheme — **review each diff**: only id prefixes may change; labels, arrows, subgraph structure must stay identical. Update the emitter header comment (graphFormats.ts lines 9-28) — `c${frameId}` → `s0-${frameId}`, and the `(subgraph → s0)` halt-arrow note stays valid.

- [ ] **Step 7: Run everything** — `npm test` → PASS except (possibly) visuals — Task 8 territory. `npx vitest run packages/visuals` failures at this point must ONLY be about id prefixes.

- [ ] **Step 8: Commit**

```bash
git add packages/machine/src/utilities/graphFormats.ts packages/machine/src/index.ts packages/machine/src/utilities/graphFormats.spec.ts test/round-trip.spec.ts
git commit -m "feat(machine): namespaced Mermaid ids (u/s/s0-), abort terminal emit + parse (#239)"
```

---

### Task 8: visuals adopts the engine id mapper

**Files:**
- Modify: `packages/visuals/src/applyHighlight.ts` (hardcoded `s${...}`/`c${...}` at lines 83, 87, 96, 107, 110, 128, 130, 132 — and any siblings a grep reveals)
- Test: `packages/visuals/src/applyHighlight.spec.ts` (+ `packages/visuals/src/fixtures/`)

**Interfaces:**
- Consumes: `mermaidIdFor` from `@turing-machine-js/machine` (Task 7; peer dep — the root `vitest.config.ts` alias resolves it to source).
- Produces: all `HighlightOps` node/edge keys use the new scheme (`u3`, `s0`, `s1`, `s0-1`, `w_1` unchanged). The 16-rule contract doc gets its id examples updated.

- [ ] **Step 1: Write/adjust failing tests** — extend the existing `recordingOps`-based specs with one assertion per new key shape:

```ts
it('emits u-prefixed keys for user states and s0-f for halt markers (#239)', () => {
  // drive an existing wrapper fixture through applyHighlight with recordingOps
  expect(ops.calls).toContainEqual(['highlightNode', 'u3']);          // was 's3'
  expect(ops.calls.some(([, key]) => /^s0-\d+$/.test(String(key)))).toBe(true); // was 'c1'
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run packages/visuals/src/applyHighlight.spec.ts` → FAIL with old-prefix keys.

- [ ] **Step 3: Implement** — in `applyHighlight.ts`, `import { mermaidIdFor } from '@turing-machine-js/machine';` and replace every hand-built key:

- `` `s${highlight.fromId}` `` → `mermaidIdFor(highlight.fromId)` (same for `toId`, `wrapperId`, `bareId`, `overrideId`)
- `` `c${fromFrameId}` `` → `mermaidIdFor(-2 * fromFrameId)`
- `` `w_${frameId}` `` stays as-is (frame subgraph ids are unchanged).

Grep the package for any other literal prefix use: `grep -rn "\`s\${\|\`c\${" packages/visuals/src/` — replace all hits the same way.

- [ ] **Step 4: Update fixtures + contract doc** — fix `packages/visuals/src/fixtures/` JSONs the tests compare against (prefix-only diffs), and update id examples in `packages/visuals/docs/graph-highlight-and-breakpoints.md`.

- [ ] **Step 5: Run** — `npm test` → fully green across all packages now. Also `npm run lint && npm run typecheck` (typecheck exists per workspace convention; if the script name differs here, `npm run build` is the type gate).

- [ ] **Step 6: Commit**

```bash
git add packages/visuals
git commit -m "feat(visuals): adopt engine mermaidIdFor key scheme (u/s/s0-) (#239)"
```

---

### Task 9: Docs + regenerated diagrams + final verification

**Files:**
- Modify: `packages/machine/README.md` (Debugging section + a new "Sentinels: halt vs abort" subsection)
- Modify: `CLAUDE.md` (repo root — Runtime model, Visualization, and debug-surface paragraphs)
- Regenerate: `packages/library-binary-numbers/states.md`, `packages/library-binary-numbers-bare/states.md`
- Modify: `packages/machine/src/utilities/graphFormats.ts` header comment if any stale reference survived Task 7

**Interfaces:** none new — documentation of Tasks 1-8's surface.

**Gate:** docs revision (README + CLAUDE.md) is a **pre-publish blocker** — the v7.1.0 npm publish must not happen before this task lands. Same rule applies repo-family-wide: post-machine-js's README/CLAUDE.md checklist lives on post-machine-js#112, machines-demo's on machines-demo#122.

- [ ] **Step 1: README** — add to `packages/machine/README.md`:
  - `abortState` in the API list next to `haltState`, with the one-sentence semantic ("never popped, never composed — terminates the run through any call depth") and the opt-in framing from spec §1.
  - `run()` return value: the `RunResult` shape, the `'halted'`-implies-empty-stack invariant, the generator-return caveat (`for...of` discards it; last-yield `nextState === abortState` is the canonical step-level check).
  - DebugSession: `'abort'` event row, terminal payloads, `abortState.debug = true`.
  - Mermaid id scheme table (u / s / s0- / w_) with the changelog-style one-liner from spec §4.

- [ ] **Step 1b: CLAUDE.md** — revise the repo-root `CLAUDE.md` paragraphs that this feature makes stale:
  - Runtime model: "`haltState` is identified by `id === 0`" bullet gains the sentinel family (`abortState` id −1, `isSentinel ≡ id ≤ 0`, odd/even negative split vs halt markers).
  - `run()` described as returning nothing → now returns `RunResult` (and `runStepByStep`'s generator return).
  - DebugSession event list gains `'abort'` + terminal payloads; `haltState.debug` paragraph gains the `abortState.debug` sibling.
  - Visualization section: Mermaid id scheme note (`uN` / `sK` / `s0-F`), `mermaidIdFor`/`parseMermaidId` exports, marker ids `−2f`.

- [ ] **Step 2: Regenerate library diagrams**

```bash
npm run build && npm run docs:states
git diff --stat packages/library-binary-numbers/states.md packages/library-binary-numbers-bare/states.md
```

Expected: prefix-only churn (`s3` → `u3`, `c1` → `s0-1`) in every diagram; **no structural changes** (same arrows, same labels, same subgraphs). Spot-check one diagram by pasting into a Mermaid renderer (validate-before-commit rule for Mermaid-bearing docs).

- [ ] **Step 3: Full gate**

```bash
npm run lint && npm run build && npm run test:coverage
```

Expected: green, coverage ≥ 97/90/95/97. New branches (sentinel guards, abort paths) are all covered by Tasks 1-8's tests; if the branch floor dips, the uncovered branch is a bug in the plan — add the missing test, don't lower the floor.

- [ ] **Step 4: Commit + PR**

```bash
git add packages/machine/README.md CLAUDE.md packages/library-binary-numbers/states.md packages/library-binary-numbers-bare/states.md
git commit -m "docs: abortState README + CLAUDE.md + regenerated states.md under namespaced Mermaid ids (#239)"
git push -u origin feat/239-abort-state
gh pr create --title "abortState: non-overridable terminal for abnormal termination (#239)" --body "Implements docs/superpowers/specs/2026-07-05-abort-state-design.md. Closes #239."
```

(PR body: summarize per-task bullets; no attribution footer.)

---

## Appendix: draft CHANGELOG entry (for the later v7.1.0 release PR)

```markdown
## [7.1.0] - YYYY-MM-DD

### Added
- `abortState` — non-overridable terminal sentinel for abnormal termination (#239). Never popped by the subroutine halt-stack, never composed by `withOverriddenHaltState`; punches through call/return and ends the run.
- `run()` / `runStepByStep` now return a call-scoped `RunResult` `{outcome: 'halted' | 'aborted', state, stack, step}` (additive — `run()` previously returned `void`).
- `DebugSession`: new `'abort'` terminal event; both `'halt'` and `'abort'` listeners receive the `RunResult`. `abortState.debug` (boolean) arms an after-side abort breakpoint.
- `GraphNode.isAbort`; abort renders as a dashed-red `(((abort)))` terminal. `mermaidIdFor` / `parseMermaidId` exported.

### Changed
- **Mermaid node ids are now namespaced**: `uN` user states (was `sN`), `sK` sentinels (`s0` halt, `s1` abort), `s0-F` per-frame halt markers (was `cF`). Rendered-output churn only — numeric `Graph` ids for user states and halt are unchanged.
- Synthetic halt-marker graph ids moved from `-frameId` to `-2*frameId` (even negatives; odd negatives are reserved for sentinels).
- `@turing-machine-js/visuals` emits `HighlightOps` keys in the new id scheme.
- visuals: peer dependency on `@turing-machine-js/machine` raised to `^7.1.0` (runtime import of `mermaidIdFor`).
```

## Self-review notes

- Spec coverage: §2 → Tasks 3-4; §3 → Tasks 1, 6; §4 → Task 7; §5 → Tasks 6-7; §6 → Task 4; §7 → Tasks 2, 5; §8 → Tasks 6-9; §9 → Tasks 7-9 fixture steps; §10 is out of repo scope (post#112 filed).
- Type consistency: `RunResult` defined once (Task 4), consumed by Task 5 listeners and the Appendix; `mermaidIdFor` signature identical in Tasks 7-8; `isSentinel` used by Tasks 2, 4, 6.
- Known judgment call encoded: run-loop condition switches to `!state.isSentinel` so sentinel `initialState` never iterates; `lastIterState ?? state` covers the zero-iteration edge.
