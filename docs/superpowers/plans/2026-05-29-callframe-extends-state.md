# CallFrame extends State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the implicit wrapper-State produced by `withOverriddenHaltState` (a plain `State` whose private `#symbolToDataMap`/`#debugRef` are aliased to its bare) with a first-class `CallFrame extends State` that *delegates* to its bare, with zero public behavior change.

**Architecture:** `CallFrame` is a subclass of `State` defined inline in `State.ts` (after the `State` class, to avoid the `extends State` module-init TDZ cycle). It holds its own `#bare`/`#override`, overrides the transition-lookup methods + `debug` + `STATE_INTERNAL` to forward to `#bare`, and inherits `#id`/`#name`/`#tags`/`isHalt` unchanged. `withOverriddenHaltState` constructs a `CallFrame` instead of mutating a fresh `State`. Because `CallFrame instanceof State` stays true, no consumer migration is needed; `instanceof CallFrame` becomes the explicit wrapper discriminator.

**Tech Stack:** TypeScript (project references), Vitest, npm workspaces. Run a single spec: `npx vitest run packages/machine/src/classes/State.spec.ts -t "name"`.

**Branch:** `feat/213-callframe-extends-state` (off `v7`). Issue: mellonis/turing-machine-js#213.

**Coverage floors (must hold):** 97% statements / 90% branches / 95% functions / 97% lines.

---

## File Structure

- `packages/machine/src/classes/State.ts` — add `export class CallFrame extends State` after the `State` class; rewrite `withOverriddenHaltState` to build a `CallFrame`; route `State.inspect` through `STATE_INTERNAL` so it works for `CallFrame`; widen `#wrapperCache` value type to `WeakRef<CallFrame>`.
- `packages/machine/src/classes/TuringMachine.ts` — simplify the `resolvableStateId` derivation (`:197-198`) to a `CallFrame` instanceof check; import `CallFrame`.
- `packages/machine/src/index.ts` — export `CallFrame`.
- `packages/machine/src/classes/State.spec.ts` — add CallFrame-identity / delegation tests.
- Verification only (expected unchanged): `utilities/stateGraph.ts` (toGraph/fromGraph/collectStates), `TuringMachine.spec.ts`, `library-binary-numbers` specs, `test/round-trip.spec.ts`.

---

## Task 1: `CallFrame extends State` (inline in State.ts)

**Files:**
- Modify: `packages/machine/src/classes/State.ts`
- Test: `packages/machine/src/classes/State.spec.ts`

- [ ] **Step 1: Write failing tests** (append to `State.spec.ts`)

```ts
import State, {CallFrame, haltState, ifOtherSymbol} from './State';
import TapeBlock from './TapeBlock';

describe('CallFrame', () => {
  const tb = TapeBlock.fromSymbols([['a', 'b']]);
  const sA = new State({[tb.symbol([['a']])]: {nextState: haltState}}, 'A');
  const sB = new State({[tb.symbol([['b']])]: {nextState: haltState}}, 'B');

  it('withOverriddenHaltState returns a CallFrame that is also a State', () => {
    const w = sA.withOverriddenHaltState(sB);
    expect(w).toBeInstanceOf(State);
    expect(w).toBeInstanceOf(CallFrame);
  });

  it('composite name is bare(override)', () => {
    expect(sA.withOverriddenHaltState(sB).name).toBe('A(B)');
  });

  it('is not the halt state', () => {
    expect(sA.withOverriddenHaltState(sB).isHalt).toBe(false);
  });

  it('exposes the override via overriddenHaltState', () => {
    expect(sA.withOverriddenHaltState(sB).overriddenHaltState).toBe(sB);
  });

  it('delegates transition lookups to the bare', () => {
    const w = sA.withOverriddenHaltState(sB);
    const sym = sA.getSymbol(tb);
    expect(w.getSymbol(tb)).toBe(sym);
    expect(w.getNextState(sym)).toBe(sA.getNextState(sym));
    expect(w.getMatchedTransition(sym).ix).toBe(sA.getMatchedTransition(sym).ix);
  });

  it('memoizes by (bare, override) — #175', () => {
    expect(sA.withOverriddenHaltState(sB)).toBe(sA.withOverriddenHaltState(sB));
  });

  it('collapses a wohs chain — #176', () => {
    const sC = new State({[tb.symbol([['a']])]: {nextState: haltState}}, 'C');
    expect(sA.withOverriddenHaltState(sB).withOverriddenHaltState(sC))
      .toBe(sA.withOverriddenHaltState(sC));
  });

  it('keeps tags independent across wrappers sharing a bare — #186', () => {
    const sC = new State({[tb.symbol([['a']])]: {nextState: haltState}}, 'C');
    sA.withOverriddenHaltState(sB).tag('hot');
    expect(sA.withOverriddenHaltState(sC).tags).not.toContain('hot');
  });

  it('shares debug with the bare both ways', () => {
    const w = sA.withOverriddenHaltState(sB);
    const sym = sA.getSymbol(tb);
    sA.debug = {before: [sym]};
    expect(w.debug.before).toEqual([sym]);
    w.debug = {after: [sym]};
    expect(sA.debug.after).toEqual([sym]);
    sA.debug = null;
  });
});
```

- [ ] **Step 2: Run, verify failure**

Run: `npx vitest run packages/machine/src/classes/State.spec.ts -t "CallFrame"`
Expected: FAIL — `CallFrame` is not exported from `./State`.

- [ ] **Step 3: Add the `CallFrame` class** at the bottom of `State.ts`, after `export const haltState`:

```ts
export class CallFrame extends State {
  readonly #bare: State;

  readonly #override: State;

  constructor(bare: State, override: State) {
    super(null);
    this.#bare = bare;
    this.#override = override;
    // Composite name bypasses the constructor's paren-validator by going
    // through the STATE_INTERNAL name setter (writes the inherited #name).
    this[STATE_INTERNAL]().name = `${bare.name}(${override.name})`;
  }

  get bare(): State {
    return this.#bare;
  }

  get overriddenHaltState(): State {
    return this.#override;
  }

  getSymbol(tapeBlock: TapeBlock) {
    return this.#bare.getSymbol(tapeBlock);
  }

  getCommand(symbol: symbol) {
    return this.#bare.getCommand(symbol);
  }

  getNextState(symbol: symbol) {
    return this.#bare.getNextState(symbol);
  }

  getMatchedTransition(symbol: symbol) {
    return this.#bare.getMatchedTransition(symbol);
  }

  get debug(): DebugConfig {
    return this.#bare.debug;
  }

  set debug(
    value: DebugConfig | { before?: symbol[] | readonly symbol[] | true; after?: symbol[] | readonly symbol[] | true } | null,
  ) {
    this.#bare.debug = value;
  }

  [STATE_INTERNAL]() {
    // Own id/name/tags come from the inherited State fields (via super's
    // view); bareState/override/transition-map delegate to #bare/#override.
    const own = super[STATE_INTERNAL]();
    const bare = this.#bare;
    const override = this.#override;

    return {
      get id(): number { return own.id; },
      get name(): string { return own.name; },
      set name(v: string) { own.name = v; },
      get bareState(): State | null { return bare; },
      get overriddenHaltState(): State | null { return override; },
      get symbolToDataMap() { return bare[STATE_INTERNAL]().symbolToDataMap; },
      get tags(): ReadonlySet<string> { return own.tags; },
    };
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run packages/machine/src/classes/State.spec.ts -t "CallFrame"`
Expected: PASS (all CallFrame tests). If the `#wrapperCache`/`withOverriddenHaltState` still returns a plain `State`, the `instanceof CallFrame` test fails — that's fixed in Task 2; it's acceptable for Step 4 to leave `instanceof CallFrame` red until Task 2. Re-run after Task 2.

> Note: the `instanceof CallFrame`, memoization, chain-collapse, tag, and debug tests depend on `withOverriddenHaltState` building a `CallFrame` (Task 2). Implement Task 2 immediately, then this whole block goes green.

- [ ] **Step 5: Commit** (after Task 2 green — see Task 2 Step 6)

---

## Task 2: Build `CallFrame` in `withOverriddenHaltState`; route `inspect`; drop aliasing

**Files:**
- Modify: `packages/machine/src/classes/State.ts`

- [ ] **Step 1: Widen the cache value type** (`State.ts:106`)

```ts
  static #wrapperCache = new WeakMap<State, WeakMap<State, WeakRef<CallFrame>>>();
```

- [ ] **Step 2: Rewrite `withOverriddenHaltState`** (replace the body, `State.ts:441-484`)

```ts
  withOverriddenHaltState(overriddenHaltState: State): CallFrame {
    // Chain-collapse (#176): an inner override is dead at runtime, so a
    // wrapped `this` unwraps to its bare before re-wrapping.
    const bare = this instanceof CallFrame ? this.bare : this;

    let innerCache = State.#wrapperCache.get(bare);

    if (innerCache !== undefined) {
      const ref = innerCache.get(overriddenHaltState);

      if (ref !== undefined) {
        const cached = ref.deref();

        if (cached !== undefined) {
          return cached;
        }
      }
    } else {
      innerCache = new WeakMap();
      State.#wrapperCache.set(bare, innerCache);
    }

    const frame = new CallFrame(bare, overriddenHaltState);

    innerCache.set(overriddenHaltState, new WeakRef(frame));

    return frame;
  }
```

This removes the four field-aliasing assignments (`#symbolToDataMap`, `#overriddenHaltState`, `#debugRef`, `#bareState`) — they no longer exist on a wrapper.

- [ ] **Step 3: Route `State.inspect` through `STATE_INTERNAL`** so it reads the bare's transitions/override for a `CallFrame`. Replace the direct `state.#symbolToDataMap` / `state.#overriddenHaltState` / `state.#id` / `state.#name` reads in `inspect` (`State.ts:534-579`) with the internal view:

```ts
  static inspect(state: State): {
    id: number;
    name: string;
    isHalt: boolean;
    overriddenHaltState: { id: number; name: string } | null;
    transitions: Array<{
      rawPatternDescription: string | undefined;
      command: Array<{ symbol: string; movement: string }>;
      nextState: { id: number; name: string } | null;
    }>;
  } {
    const internal = state[STATE_INTERNAL]();
    const transitions: Array<{
      rawPatternDescription: string | undefined;
      command: Array<{ symbol: string; movement: string }>;
      nextState: { id: number; name: string } | null;
    }> = [];

    for (const [sym, {command, nextState}] of internal.symbolToDataMap) {
      let target: State | null = null;

      try {
        target = nextState instanceof State ? nextState : nextState.ref;
      } catch {
        target = null;
      }

      transitions.push({
        rawPatternDescription: sym.description,
        command: command.tapesCommands.map((tc) => ({
          symbol: decodeWriteSymbol(tc.symbol),
          movement: decodeMovement((tc.movement as symbol).description),
        })),
        nextState: target ? {id: target.id, name: target.name} : null,
      });
    }

    const override = internal.overriddenHaltState;

    return {
      id: internal.id,
      name: internal.name,
      isHalt: state.isHalt,
      overriddenHaltState: override
        ? {id: override.id, name: override.name}
        : null,
      transitions,
    };
  }
```

- [ ] **Step 4: Run the full State spec + the matchedTransition spec**

Run: `npx vitest run packages/machine/src/classes/State.spec.ts packages/machine/src/classes/State.debug.spec.ts`
Expected: PASS, including the Task 1 `instanceof CallFrame` / memo / chain / tags / debug tests.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (Watch for: `withOverriddenHaltState` return type vs `WeakRef<CallFrame>`; forward-reference of `CallFrame` as a type in the `#wrapperCache` annotation — allowed since types hoist.)

- [ ] **Step 6: Commit**

```bash
git add packages/machine/src/classes/State.ts packages/machine/src/classes/State.spec.ts
git commit -m "Extract CallFrame as a State subclass; delegate instead of field-aliasing"
```

(Commit only with the user's explicit go-ahead — see CLAUDE.md.)

---

## Task 3: Simplify run-loop stateId resolution

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts`

- [ ] **Step 1: Import `CallFrame`** (`TuringMachine.ts:1`)

```ts
import State, {CallFrame, haltState, STATE_INTERNAL, type DebugConfig} from './State';
```

- [ ] **Step 2: Replace the `resolvableStateId` derivation** (`TuringMachine.ts:189-198`). The `STATE_INTERNAL` peek for `bareState` becomes a direct `CallFrame` check:

```ts
        const resolvableStateId = state instanceof CallFrame ? state.bare.id : state.id;
```

Remove the now-unused `const stateInternal = state[STATE_INTERNAL]();` line and its comment block. If `STATE_INTERNAL` is no longer referenced anywhere else in `TuringMachine.ts`, drop it from the import (keep if `MACHINE_STATE_INTERNAL` plumbing or other sites still use it — grep first: `grep -n STATE_INTERNAL packages/machine/src/classes/TuringMachine.ts`).

- [ ] **Step 3: Run the TuringMachine specs**

Run: `npx vitest run packages/machine/src/classes/TuringMachine.spec.ts packages/machine/src/classes/TuringMachine.matchedTransition.spec.ts packages/machine/src/classes/TuringMachine.debug.spec.ts packages/machine/src/classes/DebugSession.spec.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/machine/src/classes/TuringMachine.ts
git commit -m "Use CallFrame instanceof for run-loop stateId resolution"
```

---

## Task 4: Export `CallFrame`; full verification gate

**Files:**
- Modify: `packages/machine/src/index.ts`

- [ ] **Step 1: Export `CallFrame`** (`index.ts:4`)

```ts
export { default as State, CallFrame, DebugConfig, haltState, ifOtherSymbol } from './classes/State';
```

- [ ] **Step 2: Full suite**

Run: `npm test`
Expected: PASS, all packages. Pay attention to `library-binary-numbers` (the `minusOne` 4-deep `wohs` chain), `stateGraph.spec.ts` (toGraph/fromGraph/collectStates), and `test/round-trip.spec.ts` (bytewise stability for simple wrappers + shared-bare cases). These are the regression net for the delegation change.

- [ ] **Step 3: Lint + typecheck + coverage**

Run: `npm run lint && npm run typecheck && npm run test:coverage`
Expected: clean lint, no type errors, coverage ≥ 97/90/95/97.

- [ ] **Step 4: Build (smoke the Rollup repackage)**

Run: `npm run build`
Expected: success — confirms the new export + class compile through the project-references + Rollup post-step.

- [ ] **Step 5: Commit**

```bash
git add packages/machine/src/index.ts
git commit -m "Export CallFrame from the public surface"
```

---

## Self-Review notes

- **Spec coverage:** CallFrame identity (T1), delegation of lookups/debug/STATE_INTERNAL (T1), memoization #175 (T1/T2), chain-collapse #176 (T1/T2), independent tags #186 (T1), inspect correctness (T2), run-loop simplification (T3), graph round-trip + collectStates (T4 verification), public discriminator export (T4). All design points covered.
- **`isHalt`:** inherited; `super(null)` → fresh nonzero `#id` → false. No override.
- **`validateDebugFilter`:** never runs on a CallFrame because `set debug` forwards to the bare, whose own validator uses the real transition map.
- **Out of scope:** halt-stack stays `State[]` (no `CallFrame[]` rework); no naming changes; binary-numbers libraries untouched.
- **Decision (locked):** CallFrame inline in State.ts (no cross-file `extends` cycle); debug delegates to bare (preserves shared contract).
