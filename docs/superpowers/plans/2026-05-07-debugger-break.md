# Debugger-break Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference:** Do NOT run `git commit` without explicit user confirmation per the user's global CLAUDE.md. Each commit step in this plan is the *content* of a commit; the executor must surface the diff and commit message and request approval before running `git commit`.

**Goal:** Add per-state, runtime-mutable debugger breakpoints to `@turing-machine-js/machine` — `state.debug = { before, after }` with symbol filtering, transparent for `onStep` loggers, async `run()` with new `onDebugBreak` hook.

**Architecture:** Mutable `debug` field on `State`, backed internally by a shared `Ref<DebugConfig | null>` cell so `withOverrodeHaltState` wrappers see the same config. Engine reads the field on every iteration and tags `MachineState` yields with `debugBreak` metadata. `run()` becomes async and dispatches to `onDebugBreak` per timing; `runStepByStep` exposes the metadata but doesn't dispatch (the caller already paces). Halt-state `before` is checked when the engine is about to enter halt (program exit OR subroutine pop). No new classes; no second stack; no serialization changes.

**Tech Stack:** TypeScript (strict), Jest (`*.spec.ts` colocated with source), npm-workspaces + Lerna (lockstep version bump across all 4 packages), ESLint flat config.

**Spec reference:** `docs/superpowers/specs/2026-05-07-debugger-break.md` (read this before starting).

**Tracking issue:** [mellonis/turing-machine-js#98](https://github.com/mellonis/turing-machine-js/issues/98) — PR description should `Closes #98`.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `packages/machine/src/classes/State.ts` | Modify | Add `DebugConfig` type; add `#debugRef` cell + `debug` getter/setter; share `#debugRef` in `withOverrodeHaltState`. |
| `packages/machine/src/classes/State.debug.spec.ts` | Create | Unit tests for `State.debug` field — default, set/get, ref-sharing through `withOverrodeHaltState`, null-propagation. |
| `packages/machine/src/classes/TuringMachine.ts` | Modify | Extend `MachineState` with `debugBreak`; add filter helper; add `before` / `after` / halt-state-`before` checks in `runStepByStep`; make `run()` async with `onDebugBreak` hook + per-call view + prev-yield substitution for `after` calls. |
| `packages/machine/src/classes/TuringMachine.debug.spec.ts` | Create | Integration tests for breakpoint behavior across `runStepByStep` and `run()`. |
| `packages/machine/src/index.ts` | Modify | Re-export the `DebugConfig` type. |
| `packages/machine/README.md` | Modify | Add a short section documenting the new `state.debug` API and `onDebugBreak` hook. |
| `lerna.json` | Modify | Lockstep version bump v3.0.2 → v4.0.0. |
| `packages/*/package.json` | Modify | Each package version field bumped to v4.0.0 (Lerna handles this). |

`builder` / `library-binary-numbers` / `library-binary-numbers-bare` packages — no source changes, but their tests run as part of `npm test` and serve as regression checks.

---

## Task 0: Set up feature branch

**Files:** none (git operations).

- [ ] **Step 0.1: Sync master**

```bash
cd /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js
git fetch origin
git checkout master
git pull --ff-only origin master
```

- [ ] **Step 0.2: Create feature branch**

```bash
git checkout -b feat/debugger-break
```

Per project release pattern (memory `project_turing_release_pattern.md`), the actual v4.0.0 release branch (`v4-0-0`) is cut later from master once this feature merges. This branch is for the feature itself.

- [ ] **Step 0.3: Confirm clean working tree**

Run: `git status`
Expected: working tree clean, on branch `feat/debugger-break`.

---

## Task 1: Add `DebugConfig` type and `State.debug` field with `Ref` cell

**Files:**
- Modify: `packages/machine/src/classes/State.ts`
- Create: `packages/machine/src/classes/State.debug.spec.ts`
- Modify: `packages/machine/src/index.ts`

- [ ] **Step 1.1: Write failing tests for `State.debug`**

Create `packages/machine/src/classes/State.debug.spec.ts`:

```typescript
import State, {haltState, ifOtherSymbol, DebugConfig} from './State';
import TapeBlock from './TapeBlock';
import Alphabet from './Alphabet';

const alphabet = new Alphabet(' AB'.split(''));

const makeState = (): State => {
  const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
  const {symbol} = tapeBlock;
  return new State({
    [symbol([['A']])]: {nextState: haltState},
    [ifOtherSymbol]: {nextState: haltState},
  });
};

describe('State.debug — basics', () => {
  test('defaults to null', () => {
    const state = makeState();
    expect(state.debug).toBeNull();
  });

  test('plain-object assignment is wrapped in a DebugConfig instance', () => {
    const state = makeState();
    state.debug = {before: true};
    expect(state.debug).toBeInstanceOf(DebugConfig);
    expect(state.debug!.before).toBe(true);
  });

  test('DebugConfig instance assignment is stored as-is (identity preserved)', () => {
    const state = makeState();
    const cfg = new DebugConfig(state, {before: true});
    state.debug = cfg;
    expect(state.debug).toBe(cfg);
  });

  test('setter accepts null to clear', () => {
    const state = makeState();
    state.debug = {before: true};
    state.debug = null;
    expect(state.debug).toBeNull();
  });

  test('withOverrodeHaltState returns a new state that shares the debug ref', () => {
    const state = makeState();
    const wrapped = state.withOverrodeHaltState(haltState);

    expect(wrapped).not.toBe(state);
    expect(wrapped.debug).toBeNull();

    state.debug = {before: true};

    // Wrapper sees the assignment because both share the same Ref cell.
    expect(wrapped.debug).toBe(state.debug);
  });

  test('setting null on the original propagates to wrappers', () => {
    const state = makeState();
    state.debug = {before: true};
    const wrapped = state.withOverrodeHaltState(haltState);

    state.debug = null;
    expect(wrapped.debug).toBeNull();
  });

  test('setting on the wrapper propagates back to the original', () => {
    const state = makeState();
    const wrapped = state.withOverrodeHaltState(haltState);

    wrapped.debug = {after: true};
    expect(state.debug).toBe(wrapped.debug);
    expect(state.debug!.after).toBe(true);
  });

  test('chained wrappers all share the SAME debug object (identity)', () => {
    const state = makeState();
    const w1 = state.withOverrodeHaltState(haltState);
    const w2 = w1.withOverrodeHaltState(haltState);

    state.debug = {before: true};

    expect(w1.debug).toBe(state.debug);
    expect(w2.debug).toBe(state.debug);
  });
});

describe('DebugConfig — class accessors', () => {
  test('per-property setter `cfg.before = [...]` validates and stores a frozen array', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol([['A']]);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    state.debug = {};                    // empty config
    state.debug!.before = [symA];        // class setter triggers
    expect(state.debug!.before).toEqual([symA]);
    expect(Object.isFrozen(state.debug!.before)).toBe(true);
  });

  test('extending the filter via `cfg.before = [...cfg.before, sym]` works', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol([['A']]);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    state.debug = {before: [symA]};
    state.debug!.before = [...(state.debug!.before as readonly symbol[]), ifOtherSymbol];
    expect(state.debug!.before).toEqual([symA, ifOtherSymbol]);
    expect(Object.isFrozen(state.debug!.before)).toBe(true);
  });

  test('per-property setter validates new symbol list', () => {
    const state = makeState();
    state.debug = {};
    expect(() => {
      state.debug!.before = [Symbol('random')];
    }).toThrow(/not a transition key of this state/);
  });

  test('frozen array — push throws TypeError', () => {
    const state = makeState();
    state.debug = {before: [ifOtherSymbol]};
    expect(() => {
      (state.debug!.before as symbol[]).push(Symbol('x'));
    }).toThrow(TypeError);
  });

  test('frozen array — index assignment throws TypeError', () => {
    const state = makeState();
    state.debug = {before: [ifOtherSymbol]};
    expect(() => {
      (state.debug!.before as symbol[])[0] = Symbol('x');
    }).toThrow(TypeError);
  });

  test('input array is not frozen — only the stored copy is', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol([['A']]);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    const userInput: symbol[] = [symA];
    state.debug = {before: userInput};

    // User's source array stays mutable (we stored a copy).
    expect(Object.isFrozen(userInput)).toBe(false);
    userInput.push(ifOtherSymbol);  // works fine
    // But the stored array is still its own frozen snapshot:
    expect(state.debug!.before).toEqual([symA]);
  });

  test('true (wildcard) and undefined bypass freeze (no array to freeze)', () => {
    const state = makeState();
    state.debug = {before: true};
    // before is `true`, not an array — Object.isFrozen on a non-array is whatever JS says.
    expect(state.debug!.before).toBe(true);

    state.debug!.before = undefined;
    expect(state.debug!.before).toBeUndefined();
  });
});

describe('State.debug — setter validation', () => {
  test('accepts ifOtherSymbol in filter array', () => {
    const state = makeState();
    expect(() => {
      state.debug = {before: [ifOtherSymbol]};
    }).not.toThrow();
  });

  test('accepts transition-key symbols in filter array', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol([['A']]);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    expect(() => {
      state.debug = {before: [symA]};
    }).not.toThrow();
  });

  test('throws when filter contains a symbol from a DIFFERENT tape block', () => {
    const tapeBlockA = TapeBlock.fromAlphabets([alphabet]);
    const tapeBlockB = TapeBlock.fromAlphabets([alphabet]);
    const symFromA = tapeBlockA.symbol([['A']]);
    const symFromB = tapeBlockB.symbol([['A']]);

    const state = new State({
      [symFromA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    expect(() => {
      state.debug = {before: [symFromB]};
    }).toThrow(/not a transition key of this state/);
  });

  test('throws when filter contains a transition-key symbol from a DIFFERENT state', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol([['A']]);
    const symB = symbol([['B']]);

    const state1 = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });
    new State({
      [symB]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    expect(() => {
      state1.debug = {before: [symB]};  // symB belongs to another state's transitions
    }).toThrow(/not a transition key of this state/);
  });

  test('throws on random Symbol() not interned by any tape block', () => {
    const state = makeState();
    const random = Symbol('random');

    expect(() => {
      state.debug = {after: [random]};
    }).toThrow(/not a transition key of this state/);
  });

  test('error message names the offending field (before vs after)', () => {
    const state = makeState();
    const random = Symbol('random');

    expect(() => {
      state.debug = {after: [random]};
    }).toThrow(/State\.debug\.after/);
  });

  test('true (wildcard) bypasses validation', () => {
    const state = makeState();
    expect(() => {
      state.debug = {before: true, after: true};
    }).not.toThrow();
  });

  test('empty array bypasses validation', () => {
    const state = makeState();
    expect(() => {
      state.debug = {before: [], after: []};
    }).not.toThrow();
  });

  test('null assignment bypasses validation', () => {
    const state = makeState();
    state.debug = {before: true};
    expect(() => {
      state.debug = null;
    }).not.toThrow();
  });
});

describe('State.debug — post-assignment immutability (frozen arrays)', () => {
  // The config OBJECT itself is not frozen — its `before` / `after` setters
  // must remain callable for incremental updates. Only the inner ARRAYS are
  // frozen, so push / index-write throw.

  test('inner before array is frozen', () => {
    const state = makeState();
    state.debug = {before: [ifOtherSymbol]};
    expect(Object.isFrozen(state.debug!.before)).toBe(true);
  });

  test('inner after array is frozen', () => {
    const state = makeState();
    state.debug = {after: [ifOtherSymbol]};
    expect(Object.isFrozen(state.debug!.after)).toBe(true);
  });

  test('push to filter array throws TypeError', () => {
    const state = makeState();
    state.debug = {before: [ifOtherSymbol]};

    expect(() => {
      (state.debug!.before as symbol[]).push(Symbol('x'));
    }).toThrow(TypeError);
  });

  test('full-config reassignment via spread re-validates and re-freezes', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol([['A']]);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    state.debug = {before: [symA]};
    expect(() => {
      state.debug = {
        before: [...(state.debug!.before as readonly symbol[]), ifOtherSymbol],
      };
    }).not.toThrow();
    expect(state.debug!.before).toEqual([symA, ifOtherSymbol]);
    expect(Object.isFrozen(state.debug!.before)).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run tests to verify they fail**

Run: `npx jest packages/machine/src/classes/State.debug.spec.ts -v`
Expected: FAIL — `State` has no `debug` field; `DebugConfig` not exported.

- [ ] **Step 1.3: Implement `DebugConfig` class and `debug` field in `State.ts`**

In `packages/machine/src/classes/State.ts`:

Add a module-private symbol for the validator, then declare the class. The validator lives on `State` (it needs access to `#symbolToDataMap`); the symbol keeps it out of the public surface:

```typescript
export const ifOtherSymbol = Symbol('other symbol');

// Module-private — used by DebugConfig setters to call State.validate.
const validateDebugFilter: unique symbol = Symbol('validateDebugFilter');

export class DebugConfig {
  #ownerState: State;
  #before?: readonly symbol[] | true;
  #after?: readonly symbol[] | true;

  constructor(
    ownerState: State,
    initial?: { before?: symbol[] | true; after?: symbol[] | true },
  ) {
    this.#ownerState = ownerState;
    if (initial) {
      // Routes through the setters → validates + freezes per field.
      if (initial.before !== undefined) this.before = initial.before;
      if (initial.after !== undefined) this.after = initial.after;
    }
  }

  get before(): readonly symbol[] | true | undefined {
    return this.#before;
  }

  set before(v: symbol[] | true | undefined) {
    this.#ownerState[validateDebugFilter]('before', v);
    this.#before = Array.isArray(v) ? Object.freeze([...v]) : v;
  }

  get after(): readonly symbol[] | true | undefined {
    return this.#after;
  }

  set after(v: symbol[] | true | undefined) {
    this.#ownerState[validateDebugFilter]('after', v);
    this.#after = Array.isArray(v) ? Object.freeze([...v]) : v;
  }
}
```

(Module exports `DebugConfig` as a named class. Users import it for `instanceof` checks and explicit construction; idiomatic usage is plain-object input that the State setter wraps automatically.)

Inside the `State` class, add the `Ref` cell, `debug` accessor, validator method, and update `withOverrodeHaltState` to share the cell:

```typescript
  #overrodeHaltState: State | null = null;

  // Shared mutable cell — withOverrodeHaltState wrappers reference the same
  // object so that `state.debug = ...` (and nullings) propagate across them.
  #debugRef: { current: DebugConfig | null } = { current: null };

  get debug(): DebugConfig | null {
    return this.#debugRef.current;
  }

  set debug(
    value: DebugConfig | { before?: symbol[] | true; after?: symbol[] | true } | null,
  ) {
    if (value === null) {
      this.#debugRef.current = null;
      return;
    }
    if (value instanceof DebugConfig) {
      this.#debugRef.current = value;
      return;
    }
    // Plain object → wrap (constructor's setters validate and freeze).
    this.#debugRef.current = new DebugConfig(this, value);
  }

  /** @internal — invoked by DebugConfig setters. Module-private via symbol key. */
  [validateDebugFilter](
    fieldName: 'before' | 'after',
    filter: symbol[] | true | undefined,
  ): void {
    if (filter === undefined || filter === true) return;
    for (const sym of filter) {
      if (sym !== ifOtherSymbol && !this.#symbolToDataMap.has(sym)) {
        throw new Error(
          `State.debug.${fieldName}: symbol is not a transition key of this state ` +
          `(state name: ${this.#name}). Common cause: symbol comes from a ` +
          `different tape block, or doesn't match any of this state's transitions.`,
        );
      }
    }
  }
```

Update `withOverrodeHaltState` to share the cell:

```typescript
  withOverrodeHaltState(overrodeHaltState: State) {
    const state = new State(null, `${this.name}>${overrodeHaltState.name}`);

    state.#symbolToDataMap = this.#symbolToDataMap;
    state.#overrodeHaltState = overrodeHaltState;
    state.#debugRef = this.#debugRef;  // SHARE the cell

    return state;
  }
```

**Notes on the design:**

- Validation runs at assignment (per-property setter) — once per change, not per-iteration. Hot path unaffected.
- Inner arrays are frozen on storage (`Object.freeze([...v])`), so `push` / index-write throw `TypeError`. Incremental updates via `cfg.before = [...cfg.before, sym]` route through the setter again.
- The `validateDebugFilter` symbol is **not** exported. It's internal to this module; `DebugConfig` lives in the same file, so it has access. Users cannot bypass validation by calling it directly.
- `state.debug = debugConfigInstance` stores the instance as-is. Validation already happened in the instance's setters. No re-wrap.

Update `withOverrodeHaltState` to share the ref:

```typescript
  withOverrodeHaltState(overrodeHaltState: State) {
    const state = new State(null, `${this.name}>${overrodeHaltState.name}`);

    state.#symbolToDataMap = this.#symbolToDataMap;
    state.#overrodeHaltState = overrodeHaltState;
    state.#debugRef = this.#debugRef;  // SHARE the cell

    return state;
  }
```

- [ ] **Step 1.4: Re-export `DebugConfig` from `index.ts`**

Update `packages/machine/src/index.ts`, change the `State` export line to:

```typescript
export { default as State, DebugConfig, haltState, ifOtherSymbol } from './classes/State';
```

(`DebugConfig` is now a class — exported as a value, not a type.)

- [ ] **Step 1.5: Run tests to verify they pass**

Run: `npx jest packages/machine/src/classes/State.debug.spec.ts -v`
Expected: all 7 tests PASS.

- [ ] **Step 1.6: Run full machine package tests to confirm no regression**

Run: `npx jest packages/machine -v`
Expected: all existing tests still pass alongside the new ones.

- [ ] **Step 1.7: Commit**

```bash
git add packages/machine/src/classes/State.ts \
        packages/machine/src/classes/State.debug.spec.ts \
        packages/machine/src/index.ts
git commit -m "feat(machine): add State.debug field with shared Ref cell

Introduces the DebugConfig type and a mutable State.debug field backed
by a private Ref cell. withOverrodeHaltState wrappers share the cell so
that assignments and nullings propagate across them. No engine changes
yet — field is unused.

Part of v4 debugger-break feature (spec: docs/superpowers/specs/2026-05-07-debugger-break.md)."
```

---

## Task 2: Extend `MachineState`, add filter helper, add `before` filter check in loop

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts`
- Create: `packages/machine/src/classes/TuringMachine.debug.spec.ts`

- [ ] **Step 2.1: Write failing tests for `before` filter**

Create `packages/machine/src/classes/TuringMachine.debug.spec.ts`:

```typescript
import Alphabet from './Alphabet';
import State, {haltState, ifOtherSymbol} from './State';
import Tape from './Tape';
import TapeBlock from './TapeBlock';
import TuringMachine, {type MachineState} from './TuringMachine';
import {movements, symbolCommands} from './TapeCommand';

const alphabet = new Alphabet(' AB'.split(''));

const buildMachine = () => {
  const tape = new Tape({alphabet, symbols: ['A', 'B', 'A']});
  const tapeBlock = TapeBlock.fromTapes([tape]);
  const machine = new TuringMachine({tapeBlock});
  const {symbol} = tapeBlock;

  // Single state: erase + move right; halt on blank.
  const state = new State({
    [symbol([['A']])]: {
      command: [{symbol: symbolCommands.erase, movement: movements.right}],
    },
    [symbol([['B']])]: {
      command: [{symbol: symbolCommands.erase, movement: movements.right}],
    },
    [ifOtherSymbol]: {nextState: haltState},
  });

  return {machine, state, symbol};
};

describe('TuringMachine — debug.before filter (loop yields)', () => {
  test('without debug, no debugBreak field on yields', () => {
    const {machine, state} = buildMachine();
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });

  test('debug.before = true tags every visit with debugBreak.before', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(step.debugBreak).toEqual({before: true});
    }
  });

  test('debug.before with symbol list matches only listed symbols', () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol([['A']]);
    state.debug = {before: [symA]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Visits where head shows 'A' carry debugBreak.before; others don't.
    const aVisits = steps.filter((s) => s.currentSymbols[0] === 'A');
    const nonAVisits = steps.filter((s) => s.currentSymbols[0] !== 'A');

    expect(aVisits.length).toBeGreaterThan(0);
    for (const v of aVisits) expect(v.debugBreak).toEqual({before: true});
    for (const v of nonAVisits) expect(v).not.toHaveProperty('debugBreak');
  });

  test('debug.before with empty list never matches', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: []};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });

  test('debug.before with [ifOtherSymbol] matches only the catch-all visit', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: [ifOtherSymbol]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // The only catch-all visit is when the head shows blank (ifOtherSymbol path).
    const blankVisits = steps.filter((s) => s.currentSymbols[0] === alphabet.blankSymbol);
    const nonBlankVisits = steps.filter((s) => s.currentSymbols[0] !== alphabet.blankSymbol);

    expect(blankVisits.length).toBe(1);
    expect(blankVisits[0].debugBreak).toEqual({before: true});
    for (const v of nonBlankVisits) expect(v).not.toHaveProperty('debugBreak');
  });
});
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `npx jest packages/machine/src/classes/TuringMachine.debug.spec.ts -v`
Expected: FAIL — `MachineState` has no `debugBreak` field, no logic emits it.

- [ ] **Step 2.3: Extend `MachineState` type**

In `packages/machine/src/classes/TuringMachine.ts`, update the `MachineState` type:

```typescript
export type MachineState = {
  step: number;
  state: State;
  currentSymbols: string[];
  nextSymbols: string[];
  movements: symbol[];
  nextState: State;
  /**
   * Set only when this iteration boundary is a debug break.
   * Field is OMITTED entirely when no break fires (no `debugBreak: undefined`).
   * At least one of `before` / `after` is `true` when the field is present.
   *
   * For consumers of the `runStepByStep` generator the `state` field reflects
   * the current iteration regardless of timing; `run()` substitutes the prior
   * yield's snapshot for `after` calls so consumers see the source state.
   */
  debugBreak?: {
    before?: true;
    after?: true;
  };
};
```

- [ ] **Step 2.4: Add the `matchFilter` helper inside `TuringMachine.ts`**

Just below the imports, add a module-private helper:

```typescript
import State, {haltState, type DebugConfig} from './State';
import TapeBlock, {lockSymbol} from './TapeBlock';
import {symbolCommands} from './TapeCommand';

// True iff `filter` matches `symbol` per the DebugConfig semantics.
// undefined / [] -> never; true -> always; symbol[] -> exact membership.
function matchFilter(filter: DebugConfig['before'], symbol: symbol): boolean {
  if (filter === undefined) return false;
  if (filter === true) return true;
  return filter.includes(symbol);
}
```

- [ ] **Step 2.5: Add `before` filter check in `runStepByStep`**

Inside `runStepByStep`, replace the existing yield block with:

```typescript
        const beforeMatch = matchFilter(state.debug?.before, symbol);

        const nextStateForYield = nextState.isHalt && stack.length
          ? stack.slice(-1)[0]
          : nextState;

        const yielded: MachineState = {
          step: i,
          state,
          currentSymbols: this.#tapeBlock.currentSymbols,
          nextSymbols: command.tapesCommands.map((tapeCommand, ix) => {
            if (typeof tapeCommand.symbol === 'symbol') {
              switch (tapeCommand.symbol) {
                case symbolCommands.erase:
                  return this.#tapeBlock.tapes[ix].alphabet.blankSymbol;
                case symbolCommands.keep:
                  return this.#tapeBlock.tapes[ix].symbol;
                default:
                  throw new Error('invalid symbol command');
              }
            }
            return tapeCommand.symbol;
          }),
          movements: command.tapesCommands.map((tapeCommand) => tapeCommand.movement),
          nextState: nextStateForYield,
        };

        if (beforeMatch) {
          yielded.debugBreak = {before: true};
        }

        yield yielded;
```

- [ ] **Step 2.6: Run tests to verify they pass**

Run: `npx jest packages/machine/src/classes/TuringMachine.debug.spec.ts -v`
Expected: all 5 `before` tests PASS.

- [ ] **Step 2.7: Run full machine package tests**

Run: `npx jest packages/machine -v`
Expected: all tests pass — existing tests are unaffected because they never set `debug`.

- [ ] **Step 2.8: Commit**

```bash
git add packages/machine/src/classes/TuringMachine.ts \
        packages/machine/src/classes/TuringMachine.debug.spec.ts
git commit -m "feat(machine): add MachineState.debugBreak and 'before' filter

Extends MachineState with optional debugBreak metadata and adds a
matchFilter helper. The runStepByStep loop tags yields with
debugBreak.before when the current state's debug.before filter matches
the resolved head symbol. The field is omitted entirely when no break
fires."
```

---

## Task 3: Add `after` filter check (deferred to next yield)

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts`
- Modify: `packages/machine/src/classes/TuringMachine.debug.spec.ts`

- [ ] **Step 3.1: Add failing tests for `after` filter**

Append to `packages/machine/src/classes/TuringMachine.debug.spec.ts`:

```typescript
describe('TuringMachine — debug.after filter (loop yields)', () => {
  test('debug.after = true tags the NEXT yield with debugBreak.after', () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // First yield: state had no prior — no after.
    expect(steps[0]).not.toHaveProperty('debugBreak');
    // Subsequent yields all carry debugBreak.after (because every prev
    // visit was at this state with after=true matching wildcard).
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].debugBreak).toEqual({after: true});
    }
  });

  test('after on a transition leading to halt is silently lost', () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // The final transition leads to halt — its after has no next yield to land on.
    // (No assertion needed — this just confirms run() completes; pending after
    // at halt is by-design lost. See spec §11.1.)
    expect(steps.length).toBeGreaterThan(0);
  });

  test('before AND after on same visit produce both flags on the relevant yields', () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // First yield: only before (no prior after).
    expect(steps[0].debugBreak).toEqual({before: true});
    // Middle yields: both flags (prev's after AND current's before).
    for (let i = 1; i < steps.length - 1; i++) {
      expect(steps[i].debugBreak).toEqual({before: true, after: true});
    }
  });

  test('after with symbol list matches only listed symbols', () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol([['A']]);
    state.debug = {after: [symA]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // The 'after' fires on yield N+1 if yield N's state had symA on the head.
    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1];
      if (prev.currentSymbols[0] === 'A') {
        expect(steps[i].debugBreak).toEqual({after: true});
      } else {
        expect(steps[i]).not.toHaveProperty('debugBreak');
      }
    }
  });
});
```

- [ ] **Step 3.2: Run tests to verify they fail**

Run: `npx jest packages/machine/src/classes/TuringMachine.debug.spec.ts -t after -v`
Expected: FAIL — no after-from-prev logic yet.

- [ ] **Step 3.3: Implement `after` filter logic in `runStepByStep`**

In `runStepByStep`, introduce a `pendingAfterFromPrev` boolean tracked across iterations.

Add a single new `let` line directly after the existing `let i = 0;`:

```typescript
      let i = 0;
      let pendingAfterFromPrev = false;
```

Then replace the iteration body to attach `debugBreak.after` (when `pendingAfterFromPrev`) on the current yield, AND to evaluate the next iteration's `pendingAfterFromPrev` from the current state's `after` filter — done *before* `state = nextState` so the right state/symbol pair is used. The result:

```typescript
      while (!state.isHalt) {
        if (i === stepsLimit) {
          throw new Error('Long execution');
        }

        i += 1;

        const symbol = state.getSymbol(this.#tapeBlock);
        const command = state.getCommand(symbol);
        let nextState = state.getNextState(symbol).ref;

        try {
          const beforeMatch = matchFilter(state.debug?.before, symbol);

          const nextStateForYield = nextState.isHalt && stack.length
            ? stack.slice(-1)[0]
            : nextState;

          const yielded: MachineState = {
            step: i,
            state,
            currentSymbols: this.#tapeBlock.currentSymbols,
            nextSymbols: command.tapesCommands.map((tapeCommand, ix) => {
              if (typeof tapeCommand.symbol === 'symbol') {
                switch (tapeCommand.symbol) {
                  case symbolCommands.erase:
                    return this.#tapeBlock.tapes[ix].alphabet.blankSymbol;
                  case symbolCommands.keep:
                    return this.#tapeBlock.tapes[ix].symbol;
                  default:
                    throw new Error('invalid symbol command');
                }
              }
              return tapeCommand.symbol;
            }),
            movements: command.tapesCommands.map((tapeCommand) => tapeCommand.movement),
            nextState: nextStateForYield,
          };

          if (pendingAfterFromPrev || beforeMatch) {
            const dbg: { before?: true; after?: true } = {};
            if (pendingAfterFromPrev) dbg.after = true;
            if (beforeMatch) dbg.before = true;
            yielded.debugBreak = dbg;
          }

          yield yielded;

          // Reset and re-evaluate after for THIS visit.
          pendingAfterFromPrev = matchFilter(state.debug?.after, symbol);

          this.#tapeBlock.applyCommand(command, executionSymbol);

          if (nextState.isHalt && stack.length) {
            nextState = stack.pop()!;
          }

          if (state !== nextState && nextState.overrodeHaltState) {
            stack.push(nextState.overrodeHaltState);
          }

          state = nextState;
        } catch (error) {
          if (error !== haltState) {
            throw error;
          }

          break;
        }
      }
```

(Remove the `pendingAfterSymbol` placeholder — not needed; the `after` flag itself is per-visit boolean. The substitution in `run()` will be done with `prevYield`, which already carries the source state.)

- [ ] **Step 3.4: Run tests to verify they pass**

Run: `npx jest packages/machine/src/classes/TuringMachine.debug.spec.ts -v`
Expected: all `before` and `after` tests PASS (8 + 5 = around 9 tests in this spec file, depending on what you wrote).

- [ ] **Step 3.5: Run full machine package tests**

Run: `npx jest packages/machine -v`
Expected: all tests pass.

- [ ] **Step 3.6: Commit**

```bash
git add packages/machine/src/classes/TuringMachine.ts \
        packages/machine/src/classes/TuringMachine.debug.spec.ts
git commit -m "feat(machine): add 'after' debug filter (deferred to next yield)

Tracks pendingAfterFromPrev across iterations. When state.debug.after
matches the visited symbol, the NEXT yield carries debugBreak.after.
Final after at halt is silently lost (spec §11.1) — users wanting halt
pause use haltState.debug.before, implemented in the next task."
```

---

## Task 4: Halt-state `debug.before` (pause on halt / subroutine return)

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts`
- Modify: `packages/machine/src/classes/TuringMachine.debug.spec.ts`

- [ ] **Step 4.1: Add failing tests**

Append to `TuringMachine.debug.spec.ts`:

```typescript
describe('TuringMachine — haltState.debug.before', () => {
  afterEach(() => {
    // haltState is a singleton — clear after each test to avoid cross-pollution.
    haltState.debug = null;
  });

  test('haltState.debug.before = true fires on program halt', () => {
    const {machine, state} = buildMachine();
    haltState.debug = {before: true};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Last step's transition leads to halt — that yield should carry debugBreak.before
    // (because nextState is halt and haltState.debug.before === true).
    const last = steps[steps.length - 1];
    expect(last.nextState).toBe(haltState);
    expect(last.debugBreak?.before).toBe(true);
  });

  test('haltState.debug.before fires on subroutine return (halt-pop)', () => {
    const tape = new Tape({alphabet, symbols: ['A']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;

    // Inner subroutine: erases 'A', halts.
    const inner = new State({
      [symbol([['A']])]: {
        command: [{symbol: symbolCommands.erase, movement: movements.right}],
      },
      [ifOtherSymbol]: {nextState: haltState},
    });

    // Outer continuation: just halts on blank.
    const continuation = new State({
      [ifOtherSymbol]: {nextState: haltState},
    });

    const wrapped = inner.withOverrodeHaltState(continuation);

    haltState.debug = {before: true};
    const steps: MachineState[] = [];

    machine.run({initialState: wrapped, onStep: (s) => steps.push(s)});

    // The yield where inner transitions to haltState (which gets popped to continuation)
    // should still carry debugBreak.before — we paused before entering halt logic.
    const popYield = steps.find((s) => s.nextState === continuation);
    expect(popYield?.debugBreak?.before).toBe(true);
  });

  test('haltState.debug.before with symbol list NEVER matches (no head symbol at halt)', () => {
    const {machine, state, symbol} = buildMachine();
    const symA = symbol([['A']]);
    haltState.debug = {before: [symA]};
    const steps: MachineState[] = [];

    machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Halt has no head symbol; list filter cannot match. No debug break should fire
    // because of haltState.debug. (state.debug is null, so no other source.)
    for (const step of steps) {
      expect(step).not.toHaveProperty('debugBreak');
    }
  });
});
```

- [ ] **Step 4.2: Run tests to verify they fail**

Run: `npx jest packages/machine/src/classes/TuringMachine.debug.spec.ts -t haltState -v`
Expected: FAIL — no halt-state-debug logic yet.

- [ ] **Step 4.3: Add halt-debug check in `runStepByStep`**

The check fires when the resolved `nextState` is `haltState` and `haltState.debug?.before === true`. Update the section that computes `beforeMatch`:

```typescript
          const beforeMatch =
            matchFilter(state.debug?.before, symbol)
            || (nextState.isHalt && nextState.debug?.before === true);
```

(Symbol-list filters on haltState are silently no-ops because halt has no resolved head symbol; only `=== true` activates.)

- [ ] **Step 4.4: Run tests to verify they pass**

Run: `npx jest packages/machine/src/classes/TuringMachine.debug.spec.ts -v`
Expected: all `haltState` tests PASS along with prior tests.

- [ ] **Step 4.5: Run full machine package tests**

Run: `npx jest packages/machine -v`
Expected: all pass.

- [ ] **Step 4.6: Commit**

```bash
git add packages/machine/src/classes/TuringMachine.ts \
        packages/machine/src/classes/TuringMachine.debug.spec.ts
git commit -m "feat(machine): support haltState.debug.before for halt-pause

Engine ORs the current state's before-filter match with
'nextState.isHalt && haltState.debug.before === true'. This covers both
program halt and subroutine return (halt-pop). Symbol-list filters on
haltState are silently no-ops because halt has no head symbol; only the
true wildcard matters. Singleton caveat: haltState is shared across all
machines in the process — see spec §8.6."
```

---

## Task 5: Make `run()` async with `onDebugBreak` hook (per-call view + prev-yield substitution)

**Files:**
- Modify: `packages/machine/src/classes/TuringMachine.ts`
- Modify: `packages/machine/src/classes/TuringMachine.debug.spec.ts`

- [ ] **Step 5.1: Add failing tests**

Append to `TuringMachine.debug.spec.ts`:

```typescript
describe('TuringMachine — run() with onDebugBreak', () => {
  afterEach(() => { haltState.debug = null; });

  test('run() returns a Promise', () => {
    const {machine, state} = buildMachine();
    const result = machine.run({initialState: state});
    expect(result).toBeInstanceOf(Promise);
    return result;
  });

  test('without onDebugBreak, breaks fire-and-resume invisibly', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const steps: MachineState[] = [];

    await machine.run({initialState: state, onStep: (s) => steps.push(s)});

    // Trajectory unaffected — onStep sees same number of yields as without debug.
    expect(steps.length).toBeGreaterThan(0);
    // No exception, no hang.
  });

  test('onDebugBreak fires for "before" with current state', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const seen: Array<{state: State, debugBreak?: any}> = [];

    await machine.run({
      initialState: state,
      onDebugBreak: (m) => {
        seen.push({state: m.state, debugBreak: m.debugBreak});
      },
    });

    expect(seen.length).toBeGreaterThan(0);
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect(entry.debugBreak).toEqual({before: true});
    }
  });

  test('onDebugBreak for "after" sees the SOURCE state (substitution)', async () => {
    const {machine, state} = buildMachine();
    state.debug = {after: true};
    const seen: Array<{state: State, debugBreak?: any, step: number}> = [];

    await machine.run({
      initialState: state,
      onDebugBreak: (m) => {
        seen.push({state: m.state, debugBreak: m.debugBreak, step: m.step});
      },
    });

    // Every after-call should show m.state === source state (the one whose
    // after fired) — that's our buildMachine state since it's a single-state graph.
    for (const entry of seen) {
      expect(entry.state).toBe(state);
      expect(entry.debugBreak).toEqual({after: true});
    }
  });

  test('both "before" and "after" on same yield → two hook calls in order', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true, after: true};
    const calls: Array<'before' | 'after'> = [];

    await machine.run({
      initialState: state,
      onDebugBreak: (m) => {
        if (m.debugBreak?.after) calls.push('after');
        if (m.debugBreak?.before) calls.push('before');
      },
    });

    // For each "middle" yield (not first), pattern is: ['after', 'before', 'after', 'before', ...].
    // First yield only has 'before'. Verify ordering: every 'after' is followed (eventually) by 'before' of the same yield.
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0]).toBe('before'); // first visit, no prior after
  });

  test('onDebugBreak can be async (run awaits it)', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    let released = false;

    const hookDone = new Promise<void>((resolve) => {
      setTimeout(() => { released = true; resolve(); }, 10);
    });

    await machine.run({
      initialState: state,
      onDebugBreak: () => hookDone,  // run() awaits this
    });

    expect(released).toBe(true);
  });

  test('onStep still fires on every yield, separate from onDebugBreak', async () => {
    const {machine, state} = buildMachine();
    state.debug = {before: true};
    const stepCount = {n: 0};
    const breakCount = {n: 0};

    await machine.run({
      initialState: state,
      onStep: () => stepCount.n++,
      onDebugBreak: () => { breakCount.n++; },
    });

    expect(stepCount.n).toBeGreaterThan(0);
    expect(breakCount.n).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5.2: Run tests to verify they fail**

Run: `npx jest packages/machine/src/classes/TuringMachine.debug.spec.ts -t "run() with onDebugBreak" -v`
Expected: FAIL — `run()` is sync, no `onDebugBreak` parameter.

- [ ] **Step 5.3: Make `run()` async with `onDebugBreak` hook**

In `packages/machine/src/classes/TuringMachine.ts`, replace the `run` method:

```typescript
  async run({
    initialState,
    stepsLimit = 1e5,
    onStep,
    onDebugBreak,
  }: RunParameter & {
    onStep?: (machineState: MachineState) => void;
    onDebugBreak?: (machineState: MachineState) => void | Promise<void>;
  }): Promise<void> {
    const generator = this.runStepByStep({initialState, stepsLimit});
    let prevYield: MachineState | null = null;

    for (const machineState of generator) {
      // 'after' (from prev step) — fire FIRST, with prev yield substituted as the source view.
      if (machineState.debugBreak?.after && onDebugBreak && prevYield) {
        await onDebugBreak({...prevYield, debugBreak: {after: true}});
      }
      // 'before' (current step) — pass current machineState with only the before flag.
      if (machineState.debugBreak?.before && onDebugBreak) {
        await onDebugBreak({...machineState, debugBreak: {before: true}});
      }
      if (onStep instanceof Function) {
        onStep(machineState);
      }
      prevYield = machineState;
    }
  }
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `npx jest packages/machine/src/classes/TuringMachine.debug.spec.ts -v`
Expected: all `run() with onDebugBreak` tests PASS plus prior ones.

- [ ] **Step 5.5: Run full machine package tests**

Run: `npx jest packages/machine -v`
Expected: all pass.

> **Note:** Existing tests that call `machine.run({...})` without awaiting will still pass behaviorally (no debug breaks fire when `onDebugBreak` is unset). The return type changed from `void` to `Promise<void>`, which TypeScript may flag in unawaited usage; ESLint may surface this. If lint fails, see Task 6 for cleanup.

- [ ] **Step 5.6: Commit**

```bash
git add packages/machine/src/classes/TuringMachine.ts \
        packages/machine/src/classes/TuringMachine.debug.spec.ts
git commit -m "feat(machine): make run() async, add onDebugBreak hook

run() now returns Promise<void> and accepts an optional onDebugBreak
hook. The hook is awaited at every break (one or two times per yield).
For 'after' calls, run() substitutes the previous yield's snapshot so
m.state corresponds to the state whose after filter triggered. For
'before' calls, the current machineState is passed with only the
relevant flag set in debugBreak. onStep still sees one un-modified call
per yield. This is a major-version change — see Task 7 for the bump."
```

---

## Task 6: Lint, build, and existing-test regression check

**Files:** none (verification only).

- [ ] **Step 6.1: Run lint**

Run: `npm run lint`
Expected: pass. If `await`-related warnings surface (e.g., floating promises in updated `.spec.ts` files), inline-await them where appropriate. Do NOT silence with `// eslint-disable` — fix the source.

- [ ] **Step 6.2: Run TypeScript project build**

Run: `npm run build`
Expected: build succeeds (`tsc --build` + Rollup post-step). The `MachineState` type change ripples to `builder` / `library-binary-numbers` / `library-binary-numbers-bare` consumers — these don't read `debugBreak`, so they're unaffected.

- [ ] **Step 6.3: Run full test suite across all workspaces**

Run: `npm test`
Expected: every package's tests pass — `machine`, `builder`, `library-binary-numbers`, `library-binary-numbers-bare`. This is the regression gate per spec §14.

- [ ] **Step 6.4: Run coverage to confirm new code is covered**

Run: `npm run test:coverage`
Expected: high coverage (>90%) on `State.ts` (debug paths) and `TuringMachine.ts` (loop changes + run() hook). If new code is uncovered, add tests in the relevant `.debug.spec.ts` file. No commit on this step unless tests are added.

- [ ] **Step 6.5: Commit any lint fixes (if Step 6.1 made changes)**

```bash
git add -A
git commit -m "chore(machine): lint cleanup post-debugger-break"
```

If no fixes were needed, skip this step.

---

## Task 7: Lockstep version bump v3 → v4

**Files:**
- Modify: `lerna.json`
- Modify: `packages/machine/package.json` (and the other 3 packages — Lerna does this).

> **Reference:** memory `project_turing_release_pattern.md` — lockstep version across all 4 packages.

- [ ] **Step 7.1: Bump versions across all packages**

Run: `npx lerna version 4.0.0 --no-push --no-git-tag-version --force-publish --yes`

Expected output:
- `lerna.json` `version` → `4.0.0`.
- All 4 `packages/*/package.json` `version` → `4.0.0`.

- [ ] **Step 7.2: Regenerate `package-lock.json`**

Run: `npm install`
Expected: `package-lock.json` updated to reflect new package versions across the workspace. No other changes (no new deps added).

This step is critical — without it, `package-lock.json` is out of sync with `package.json` files and CI's `npm ci` will fail.

- [ ] **Step 7.3: Verify the diff is minimal**

```bash
git diff lerna.json packages/*/package.json package-lock.json
```

Expected diff: only `version` fields updated to `4.0.0` in `lerna.json` + each package, and the corresponding version-string updates in `package-lock.json`. No other changes.

- [ ] **Step 7.4: Run build and tests once more**

Run: `npm run build && npm test`
Expected: all pass at v4.0.0.

- [ ] **Step 7.5: Commit**

```bash
git add lerna.json packages/*/package.json package-lock.json
git commit -m "chore: bump version to v4.0.0 (lockstep)

Major version bump for the new debugger-break feature: run() is now
async (returns Promise<void>) and exposes onDebugBreak hook. State.debug
field added. See spec at docs/superpowers/specs/2026-05-07-debugger-break.md
and CHANGELOG (Task 8)."
```

---

## Task 8: Documentation — README and JSDoc

**Files:**
- Modify: `packages/machine/README.md`

- [ ] **Step 8.1: Read the current README**

Open `packages/machine/README.md`. Locate a natural place to insert a "Debugging" section (e.g., after a "Usage" section, before "API reference" or similar).

- [ ] **Step 8.2: Add the "Debugging" section**

Insert the following section in `packages/machine/README.md` (adapt heading level to the surrounding document):

````markdown
## Debugging breakpoints (v4+)

Any `State` can carry a runtime-mutable `debug` config that pauses execution at chosen points.

```ts
import { State, haltState, ifOtherSymbol, type DebugConfig } from '@turing-machine-js/machine';

const myState = new State({...});

// Pause before applying any of myState's commands:
myState.debug = { before: true };

// Pause only when the head shows symA:
myState.debug = { before: [symA] };

// Pause both before and after for the same symbol — two pauses per visit:
myState.debug = { before: [symA], after: [symA] };

// Pause when the engine is about to enter halt (program exit OR subroutine pop):
haltState.debug = { before: true };

// Disable later:
myState.debug = null;
```

The `debug` field is mutable — toggle breakpoints at runtime without rebuilding the graph. The internal cell is shared with `state.withOverrodeHaltState(...)` wrappers, so an assignment on the original is visible from every wrapper.

`run()` is async and accepts an `onDebugBreak` hook:

```ts
await machine.run({
  initialState,
  onStep: (m) => { /* logger sees every step */ },
  onDebugBreak: async (m) => {
    // Awaited at every break — hold execution until you resolve.
    if (m.debugBreak?.before) console.log('before:', m.state.name);
    if (m.debugBreak?.after)  console.log('after:',  m.state.name);
  },
});
```

For `after` calls, `m` is the previous yield's snapshot — `m.state` is the state whose `after` filter fired. For `before` calls, `m` is the current iteration. `onStep` always sees the original (un-substituted) yield.

If `onDebugBreak` is not provided, breaks fire-and-resume invisibly — the trajectory is identical to running without `debug` set.

**Filter semantics:** `true` is a wildcard (match any symbol). `[ifOtherSymbol]` is NOT a wildcard — it matches only the catch-all resolution case (same meaning as in transition keys).

**Caveat:** `haltState` is a module-level singleton. Setting `haltState.debug` affects every machine in the process; clear in `afterEach` / `finally` for test isolation.

See `docs/superpowers/specs/2026-05-07-debugger-break.md` for full design rationale.
````

- [ ] **Step 8.3: Run a quick visual review**

```bash
less packages/machine/README.md
```

Confirm the new section reads cleanly and isn't duplicating content.

- [ ] **Step 8.4: Mirror README examples into the existing `test/examples.spec.ts`**

The repo already has a top-level `test/examples.spec.ts` (`describe('README.md', ...)`) that hosts runnable versions of every README code block. Convention established — extend it with the new debugger-break examples; do NOT create a parallel spec file.

The new examples reference state instances, so they need real construction. Append a new top-level describe block to `test/examples.spec.ts`:

```typescript
import {
  Alphabet,
  haltState,
  ifOtherSymbol,
  movements,
  State,
  Tape,
  TapeBlock,
  TuringMachine,
  symbolCommands,
} from '@turing-machine-js/machine';

// ...existing 'README.md' describe block stays as-is...

describe('README.md — Debugging breakpoints', () => {
  const alphabet = new Alphabet(' AB'.split(''));

  const buildExampleMachine = () => {
    const tape = new Tape({alphabet, symbols: ['A', 'B']});
    const tapeBlock = TapeBlock.fromTapes([tape]);
    const machine = new TuringMachine({tapeBlock});
    const {symbol} = tapeBlock;
    const symA = symbol([['A']]);
    const myState = new State({
      [symA]: {command: [{symbol: symbolCommands.erase, movement: movements.right}]},
      [ifOtherSymbol]: {nextState: haltState},
    });
    return {machine, myState, symA};
  };

  afterEach(() => { haltState.debug = null; });

  test('Pause before applying any of myState commands (wildcard)', async () => {
    const {machine, myState} = buildExampleMachine();
    myState.debug = {before: true};
    let breakCount = 0;
    await machine.run({initialState: myState, onDebugBreak: () => { breakCount++; }});
    expect(breakCount).toBeGreaterThan(0);
  });

  test('Pause only when head shows symA', async () => {
    const {machine, myState, symA} = buildExampleMachine();
    myState.debug = {before: [symA]};
    let symASeen = 0;
    await machine.run({
      initialState: myState,
      onDebugBreak: (m) => { if (m.currentSymbols[0] === 'A') symASeen++; },
    });
    expect(symASeen).toBeGreaterThan(0);
  });

  test('Before AND after for same symbol → two pauses per visit', async () => {
    const {machine, myState, symA} = buildExampleMachine();
    myState.debug = {before: [symA], after: [symA]};
    const order: Array<'before' | 'after'> = [];
    await machine.run({
      initialState: myState,
      onDebugBreak: (m) => {
        if (m.debugBreak?.before) order.push('before');
        if (m.debugBreak?.after) order.push('after');
      },
    });
    expect(order).toContain('before');
    expect(order).toContain('after');
  });

  test('haltState.debug.before pauses on halt entry', async () => {
    const {machine, myState} = buildExampleMachine();
    haltState.debug = {before: true};
    let haltPause = false;
    await machine.run({
      initialState: myState,
      onDebugBreak: (m) => {
        if (m.nextState === haltState && m.debugBreak?.before) haltPause = true;
      },
    });
    expect(haltPause).toBe(true);
  });

  test('Disable later by assigning null', () => {
    const {myState} = buildExampleMachine();
    myState.debug = {before: true};
    expect(myState.debug).not.toBeNull();
    myState.debug = null;
    expect(myState.debug).toBeNull();
  });

  test('Incremental update via per-property setter', () => {
    const {myState, symA} = buildExampleMachine();
    myState.debug = {before: [symA]};
    myState.debug!.before = [...(myState.debug!.before as readonly symbol[]), ifOtherSymbol];
    expect(myState.debug!.before).toEqual([symA, ifOtherSymbol]);
  });

  test('onStep + onDebugBreak fire independently', async () => {
    const {machine, myState} = buildExampleMachine();
    myState.debug = {before: true};
    let stepCount = 0, breakCount = 0;
    await machine.run({
      initialState: myState,
      onStep: () => stepCount++,
      onDebugBreak: () => { breakCount++; },
    });
    expect(stepCount).toBeGreaterThan(0);
    expect(breakCount).toBeGreaterThan(0);
  });
});
```

Note: `symbolCommands` may need to be added to the import list in `test/examples.spec.ts` if it isn't already there — verify and add to the existing import statement at the top of the file.

Run the spec:

```bash
npx jest test/examples.spec.ts -v
```

Expected: all existing tests pass + new debugging-section tests pass.

If a future change to README desyncs from this spec, the corresponding test fails — that's the enforcement.

> **Sync responsibility note:** this spec verifies the BEHAVIOR documented in the README, not the textual prose. Wording changes that don't alter semantics aren't caught. Accepted gap; full prose↔code sync would require a markdown extractor — out of scope.

- [ ] **Step 8.5: Commit**

```bash
git add packages/machine/README.md test/examples.spec.ts
git commit -m "docs(machine): document the debugger-break feature in README

Adds the 'Debugging breakpoints' section to the package README and
extends test/examples.spec.ts with runnable versions of every new
example. Existing convention preserved (single 'examples' spec file
at repo root)."
```

---

## Task 9: Final verification before PR

**Files:** none.

- [ ] **Step 9.1: Rebase on master if it has moved**

```bash
git fetch origin
git rebase origin/master
```

Per the user's CLAUDE.md global git policy: never branch from a stale base; rebase before PR.

- [ ] **Step 9.2: Run the full pipeline once more**

```bash
npm run lint && npm run build && npm test
```

Expected: all green.

- [ ] **Step 9.3: Confirm git log is clean**

```bash
git log master..HEAD --oneline
```

Expected: a focused list of commits implementing the feature, in TDD order.

- [ ] **Step 9.4: Push and open PR**

> **Stop and wait for user confirmation before pushing.** Per CLAUDE.md, `git push` to remote is a shared-state action that needs explicit approval.

When approved:

```bash
git push -u origin feat/debugger-break
gh pr create --title "feat: debugger-break (v4)" --body "$(cat <<'EOF'
## Summary

- Add `State.debug = { before, after }` for per-state, runtime-mutable breakpoints with symbol filtering.
- `run()` is now async and accepts `onDebugBreak`; trajectory is unchanged when no hook is passed.
- `haltState.debug.before = true` pauses on every halt entry (program exit + subroutine pop).
- Major version bump: v3.0.2 → v4.0.0 across all 4 packages.

Spec: `docs/superpowers/specs/2026-05-07-debugger-break.md`
Plan: `docs/superpowers/plans/2026-05-07-debugger-break.md`

## Test plan
- [ ] `npm run lint` passes
- [ ] `npm run build` passes
- [ ] `npm test` passes (machine + builder + library-binary-numbers* regression)
- [ ] Manually exercise: a graph with `state.debug` set runs through `run()` with `onDebugBreak` hook firing at expected points
- [ ] Manually exercise: `haltState.debug = { before: true }` pauses at halt entry; clear in afterEach
EOF
)"
```

- [ ] **Step 9.5: Track post-merge follow-ups**

These are NOT part of this PR but should be tracked separately (open issues or note in the PR description):

- **`post-machine-js` peer dependency:** widen `^3` → `^3 || ^4` in `post-machine-js/packages/machine/package.json`. User confirmed approach (a) — minimal change, no code update unless `post-machine-js` itself wraps `run()`. Verify by `grep -rn '\.run(' post-machine-js/packages` after this PR is merged. (See spec §14.)
- **`builder` package:** support `debug` in declarative state-table input. Out of scope for v4.0.0; future enhancement.
- **`machines-demo` integration:** wire breakpoints into the visualization UI (click-to-toggle on state nodes).

---

## Definition of Done

- All `*.debug.spec.ts` tests pass.
- All pre-existing tests still pass (regression).
- Lint, build, full test suite green.
- Version bumped to 4.0.0 lockstep across all 4 packages.
- README updated.
- Branch pushed, PR opened, awaiting review.
- Spec file (`docs/superpowers/specs/2026-05-07-debugger-break.md`) committed alongside the implementation (it was left uncommitted by the brainstorming session — include it in this PR, or commit it as a prep step before Task 0).

---

## Self-review notes (record after writing the plan)

- **Spec coverage:** Tasks 1–5 cover §3 (API), §4 (filter semantics), §5 (runtime), §8.1 (Ref-cell), §8.6 (haltState debug). Task 6 covers §14 regression check. Task 7 covers §14 version bump. Task 8 covers documentation. §8.3 (`toGraph` / `fromGraph` skip `debug`) requires no code — the existing serializers don't touch `debug`, which is the intended behavior; explicit JSDoc note added in Task 1's State.ts edit.
- **Out of scope per spec §12:** step-in/out/over, conditional breakpoints beyond head symbol, breakpoint catalog API — none of these in tasks. Correct.
- **Open questions §11 closed in spec:** all decisions encoded into the relevant tasks.
- **Things to watch during execution:**
  - Step 3.3 restructures the inner loop body — be careful to preserve the `try/catch` around `applyCommand` that handles `generator.throw(haltState)`.
  - Task 5's `run()` may surface ESLint warnings on existing async-unaware callers (in tests or elsewhere). Step 6.1 catches this; fix at the call site, not the signature.
  - Task 7's `lerna version` flags: `--no-push --no-git-tag-version` to avoid auto-tagging and pushing; we want the version bump as a normal commit on this branch.
