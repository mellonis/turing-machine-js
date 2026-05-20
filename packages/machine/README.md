# @turing-machine-js/machine

[![build](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml/badge.svg)](https://github.com/mellonis/turing-machine-js/actions/workflows/main.yml)
![npm (tag)](https://img.shields.io/npm/v/@turing-machine-js/machine)

A composable Turing-machine engine for JavaScript: multi-tape, subroutine composition via `withOverriddenHaltState`, Mermaid round-trip, and runtime breakpoints.

<details>
<summary>Table of contents</summary>

- [Install](#install)
- [Quick start](#quick-start)
- [Building from a state table](#building-from-a-state-table)
- [Classes](#classes) — [`Alphabet`](#alphabet) · [`Tape`](#tape) · [`TapeBlock`](#tapeblock) · [`TapeCommand`](#tapecommand) · [`Command`](#command) · [`State`](#state) · [`Reference`](#reference) · [`TuringMachine`](#turingmachine)
- [Subroutine composition with `withOverriddenHaltState`](#subroutine-composition-with-withoverriddenhaltstate)
- [Debugging breakpoints](#debugging-breakpoints)
- [Special objects](#special-objects) — [`haltState`](#haltstate) · [`ifOtherSymbol`](#ifothersymbol) · [`movements`](#movements) · [`symbolCommands`](#symbolcommands)
- [Introspection and testing](#introspection-and-testing)
- [Diagram conventions](#diagram-conventions)
- [Versioning notes](#versioning-notes)
- [Libraries](#libraries)
- [Links](#links)

</details>


## Install

Using npm:

```sh
npm install @turing-machine-js/machine
```

## Quick start

Replace every `b` on the tape with `*`:

```javascript
import {
  Alphabet,
  State,
  Tape,
  TapeBlock,
  TuringMachine,
  haltState,
  ifOtherSymbol,
  movements,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet([' ', 'a', 'b', 'c', '*']);
const tape = new Tape({ alphabet, symbols: ['a', 'b', 'c', 'b', 'a'] });
const tapeBlock = TapeBlock.fromTapes([tape]);
const machine = new TuringMachine({ tapeBlock });

await machine.run({
  initialState: new State({
    [tapeBlock.symbol(['b'])]: {
      command: [{ symbol: '*', movement: movements.right }],
    },
    [tapeBlock.symbol([alphabet.blankSymbol])]: {
      command: [{ movement: movements.left }],
      nextState: haltState,
    },
    [ifOtherSymbol]: {
      command: [{ movement: movements.right }],
    },
  }, 'replaceB'),
});

console.log(tape.symbols.join('').trim()); // a*c*a
```

The state graph for the example above (`toMermaid(toGraph(replaceB, tapeBlock))`):

```mermaid
flowchart TD
%% alphabets: [[" ","a","b","c","*"]]
  s0(((halt)))
  s1["replaceB"]
  idle([idle])
  idle -. enter .-> s1
  s1 -- "['b'] → ['*']/[R]" --> s1
  s1 -- "[B] → [K]/[L]" --> s0
  s1 -- "[*] → [K]/[R]" --> s1
```

Reading this specific diagram: `replaceB` (the rectangle) is the start state, marked by the dotted `enter` arrow from the `idle` sentinel. Three self-or-halt transitions: read `'b'` → write `'*'` and step right; read anything else (`*`) → keep, step right; read blank (`B`) → keep, step left, halt. Full notation reference — shapes, edge styles, label vocabulary — in [§Diagram conventions](#diagram-conventions).

A `State` is keyed by JS `Symbol`s returned from `tapeBlock.symbol(pattern)` — the pattern lists the expected symbol under each tape's head. Sentinels and constants used throughout: [`ifOtherSymbol`](#ifothersymbol) is the fallback key when nothing else matches; transitioning into [`haltState`](#haltstate) stops the run; [`movements`](#movements)`.{left,right,stay}` direct head moves; [`symbolCommands`](#symbolcommands)`.{keep,erase}` are write shortcuts. Full definitions in [§Special objects](#special-objects).

For multi-tape machines, pass one element per tape: `tapeBlock.symbol(['0', 'a'])` matches only when tape 1 is at `'0'` and tape 2 is at `'a'`. See the multi-tape example in [§Diagram conventions](#diagram-conventions) for what the rendered graph looks like.

## Building from a state table

If you prefer a textbook-style declarative API where every transition is one row of `(state, currentSymbol) → (nextState, nextSymbol, movement)`, you can build a small helper on top of the raw API. The whole thing fits in ~30 lines:

```javascript
import {
  Alphabet,
  Reference,
  State,
  TapeBlock,
  TuringMachine,
  haltState,
  ifOtherSymbol,
  movements,
  symbolCommands,
} from '@turing-machine-js/machine';

function buildFromTable({ alphabetString, initialState, finalStates, table }) {
  const alphabet = new Alphabet(alphabetString.split(''));
  const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
  const movementOf = { L: movements.left, R: movements.right, S: movements.stay };

  // Pre-create a Reference per state name so transitions can point forward.
  const refs = Object.fromEntries(Object.keys(table).map((name) => [name, new Reference()]));
  const states = {};

  for (const [name, row] of Object.entries(table)) {
    const def = {};
    for (const [read, action] of Object.entries(row)) {
      const key = read === '*' ? ifOtherSymbol : tapeBlock.symbol([read]);
      def[key] = {
        command: {
          symbol: action.write ?? symbolCommands.keep,
          movement: movementOf[action.move ?? 'S'],
        },
        nextState: finalStates.includes(action.goto) ? haltState : refs[action.goto],
      };
    }
    states[name] = new State(def, name);
    refs[name].bind(states[name]);
  }

  return { tapeBlock, machine: new TuringMachine({ tapeBlock }), initialState: states[initialState] };
}

// Same "replace b with *" example as above, written declaratively:
const { tapeBlock, machine, initialState } = buildFromTable({
  alphabetString: ' abc*',
  initialState: 'scan',
  finalStates: ['HALT'],
  table: {
    scan: {
      'b': { write: '*', move: 'R', goto: 'scan' },
      ' ': {              move: 'L', goto: 'HALT' },
      '*': {              move: 'R', goto: 'scan' },  // '*' = ifOtherSymbol
    },
  },
});
```

This is what [`@turing-machine-js/builder`](../builder) provides as a separate package. Inline lets you tweak the format (multi-tape, OR-patterns, custom action shapes) freely; the builder package is more opinionated and limited to single-tape, single-symbol-per-row transitions.

## Classes

### Alphabet

The set of single-character symbols a tape can hold. The **first** symbol passed to the constructor is the blank — it fills any tape cell the head reaches before that cell has been written. At least two unique single-character symbols are required.

```javascript
const alphabet = new Alphabet([' ', '0', '1']);
alphabet.blankSymbol;   // ' '
alphabet.symbols;       // [' ', '0', '1']
alphabet.has('0');      // true
alphabet.index('1');    // 2
```

### Tape

An infinite-in-both-directions sequence of cells over an `Alphabet`, plus a head position. Cells the head moves into that haven't been written are blank.

```javascript
const tape = new Tape({ alphabet, symbols: ['a', 'b', 'c'], position: 0 });
tape.symbol;        // 'a' (cell under head)
tape.right();       // move head right; auto-extends with blanks at the edge
tape.symbol = 'X';  // write the cell under head
```

For visualization-friendly UIs, `Tape` exposes a fixed-width viewport centered on the head:

```javascript
const tape = new Tape({ alphabet, symbols: ['a', 'b', 'c'], viewportWidth: 7 });
tape.viewport;       // 7-cell snapshot centered on the head, padded with blanks
tape.viewportWidth;  // 7 (the constructor bumps even values to the next odd)
```

`viewportWidth` defaults to `1` and must be ≥ 1; `tape.viewport` always has exactly `viewportWidth` cells regardless of how many symbols the tape actually holds. Useful for rendering a sliding window in a UI; ignore if you only need `tape.symbols` / `tape.position`.

### TapeBlock

A bundle of one or more `Tape`s that the machine reads/writes together in lock-step. Construct via either factory:

```javascript
TapeBlock.fromAlphabets([alphabetA, alphabetB]);  // creates fresh blank tapes
TapeBlock.fromTapes([tape1, tape2]);              // reuses existing tapes
```

The key method is **`tapeBlock.symbol(pattern)`**: it returns an interned JS `Symbol` that simultaneously serves as a `State`'s transition key *and* matches the current configuration across all tapes. The pattern is one alphabet character per tape; pass several patterns by concatenating to express alternatives.

```javascript
tapeBlock.symbol(['^']);                  // single tape: matches '^'
tapeBlock.symbol(['^', '0', '1', '$']);   // single tape: matches any of '^', '0', '1', '$'
tapeBlock.symbol(['0', 'a']);             // 2 tapes: matches when tape 1 is '0' AND tape 2 is 'a'
```

### TapeCommand

A single-tape instruction the machine applies in one step: optionally write a symbol, optionally move the head. Defaults to *keep current symbol, do not move*.

```javascript
const cmds = [
  { symbol: '0', movement: movements.right },     // write '0' and move right
  { movement: movements.left },                   // keep current symbol, move left
  { symbol: symbolCommands.erase },               // write the blank, stay
  {},                                             // no-op
];
```

You'll rarely construct `TapeCommand` instances yourself — pass plain objects in your `State` definitions and they're wrapped automatically.

### Command

A bundle of `TapeCommand`s, one per tape in the `TapeBlock`. Like `TapeCommand`, you usually pass a plain array in the `State` definition rather than constructing `Command` directly.

### State

A node in the transition graph. Construct with a definition object whose keys are JS `Symbol`s from `tapeBlock.symbol(...)` (or `ifOtherSymbol` for the catch-all). Each value is `{ command, nextState }`.

```javascript
const s = new State({
  [tapeBlock.symbol(['1'])]: { command: { symbol: '0', movement: movements.right } },
  [tapeBlock.symbol(['$'])]: { command: { movement: movements.left }, nextState: haltState },
}, 'name');
```

Notable members and statics:

- **`state.id`**, **`state.name`** — identity (`isHalt` is `id === 0`).
- **`state.withOverriddenHaltState(other)`** — returns a copy whose would-be halt transitions fall through to `other`. The subroutine-call composition mechanism (see `library-binary-numbers/src/index.ts` for examples).
- **`State.toGraph(state, tapeBlock)`** — walks the reachable graph from `state` and returns a serializable `Graph` (states, transitions, alphabets).
- **`State.fromGraph(graph)`** — inverse of `toGraph`: rebuilds `State` instances + a fresh `TapeBlock` from a `Graph`. Round-trips together with `toMermaid` / `fromMermaid`.

For visualization, pair `State.toGraph` with `toMermaid` to render the graph in any Mermaid-aware viewer (GitHub, VS Code, mermaid.live):

```javascript
import { State, toMermaid } from '@turing-machine-js/machine';

const graph = State.toGraph(s, tapeBlock);
console.log(toMermaid(graph));
```

The string `toMermaid` produces is a real Mermaid flowchart that renders in-place anywhere Mermaid is supported:

```mermaid
flowchart TD
%% alphabets: [[" ","0","1","$"]]
  s0(((halt)))
  s1["name"]
  idle([idle])
  idle -. enter .-> s1
  s1 -- "['1'] → ['0']/[R]" --> s1
  s1 -- "['$'] → [K]/[L]" --> s0
```

*Edge labels are `read → write/move`. Write commands: `K` = keep (no write), `E` = erase (write the blank). Literal alphabet symbols are quoted (`'1'`, `'$'`). Movements: `L` (left), `R` (right), `S` (stay).*

> 💡 **Mermaid renders at most one edge per source/target pair.** If a state has two distinct transitions back to itself (or two parallel transitions to the same target), only one shows in the diagram. The string output is correct — this is a viewer-side limitation. For graphs with multiple parallel edges, paste the `toMermaid` output into [mermaid.live](https://mermaid.live) and switch to the `stateDiagram-v2` renderer, or post-process the output to your preferred format.

`fromMermaid` parses the same format back into a `Graph`. The round-trip is **behaviorally** lossless — the rebuilt graph runs to the same outputs on the same inputs (tested in `test/round-trip.spec.ts` for the binary-numbers libraries). It is *not* bytewise lossless: state IDs auto-reassign on each rebuild, and for `withOverriddenHaltState` wrappers the composite name gains an extra `(${override.name})` wrapping on each pass (e.g., `scanToX(eraseHere)` becomes `scanToX(eraseHere)(eraseHere)` on a second round-trip — tracked in [#138](https://github.com/mellonis/turing-machine-js/issues/138)).

### Reference

A forward-declaration handle, used when a `State` needs to point at another `State` that doesn't exist yet (cyclic graphs). Construct unbound, pass as `nextState`, call `.bind(actualState)` once that state has been built.

```javascript
const ref = new Reference();
const a = new State({ [symbol(['x'])]: { nextState: ref } }, 'a');
const b = new State({ [symbol(['y'])]: { nextState: a  } }, 'b');
ref.bind(b);   // a's transition now resolves to b at run time
```

The resulting cycle (`toMermaid(toGraph(a, tapeBlock))`):

```mermaid
flowchart TD
%% alphabets: [[" ","x","y"]]
  s1["a"]
  s2["b"]
  idle([idle])
  idle -. enter .-> s1
  s1 -- "['x'] → [K]/[S]" --> s2
  s2 -- "['y'] → [K]/[S]" --> s1
```

`idle -. enter .->` points at the initial state passed to `toGraph` (`a` here); `b` is reachable from `a` via the bound `Reference`.

`reference.ref` returns the bound state and throws if the reference is still unbound when the machine runs. `bind()` is sticky — the first call wins; subsequent calls are silent no-ops that return the existing binding.

### TuringMachine

The runtime. Owns one `TapeBlock` and drives a state graph until it reaches `haltState`.

```javascript
const machine = new TuringMachine({ tapeBlock });

// Run to halt — `run()` returns a Promise<void>:
await machine.run({ initialState, stepsLimit: 1e5 });

// Or step-by-step (useful for visualization / debugging):
for (const step of machine.runStepByStep({ initialState })) {
  console.log(step.state.name, step.currentSymbols, '→', step.nextSymbols, step.movements);
}
```

Each yielded `step` (`MachineState`) has these fields:

| Field | Type | Meaning |
|---|---|---|
| `step` | `number` | 1-indexed iteration number |
| `state` | `State` | the state about to execute |
| `currentSymbols` | `string[]` | per-tape head symbols, before the command applies |
| `nextSymbols` | `string[]` | per-tape symbols that will be written |
| `movements` | `symbol[]` | per-tape head moves (`movements.left/right/stay`) |
| `nextState` | `State` | the state that will execute next |
| `debugBreak?` | `{ before?: true, after?: true }` | only set when `state.debug` matched on this iter — see *Debugging breakpoints* below |

`stepsLimit` (default `1e5`) guards against runaway loops — exceeding it throws.

#### Choosing between `run()` and `runStepByStep()`

Both APIs are first-class — `run()` is built on top of `runStepByStep()` (see [TuringMachine.ts](src/classes/TuringMachine.ts)), and both stay supported. They model different consumer needs:

| | `run()` | `runStepByStep()` |
|---|---|---|
| Shape | async, returns `Promise<void>` | synchronous generator |
| Iteration timing | owned by the engine | owned by the consumer (`.next()` per step) |
| Lifecycle hooks | dispatches `onStep`, `onPause` (gated by the `debug` master switch) | none — yields raw `MachineState` |
| How `state.debug` reaches the consumer | the `onPause` callback (when `debug: true`) | the optional `debugBreak` field on each yield (always populated; consumer decides what to do) |
| Best for | run-to-halt with optional breakpoint UI; anything wanting the v6 per-iter `before → step → after` callbacks | synchronous test harnesses, visualizers that need tight control over step timing, custom batching |

**Rule of thumb.** If your consumer reads `state.debug` and expects the engine to act on it (pause, fire callbacks), use `run()`. If you want pull-based iteration with full control over timing, use `runStepByStep()` — the `debugBreak` field is still on every yield, so you can inspect breakpoint metadata yourself.

**Don't split one logical flow across both APIs.** A consumer that wants stepwise UI *and* hook-driven breakpoints should use `run({ onStep, onPause, debug })` exclusively. Routing some operations through `runStepByStep()` and others through `run()` means `state.debug` only flows through one of the two paths — a subtle footgun where breakpoints silently disappear on whichever code path uses the generator directly. For per-iter throttle / "wait between steps" UIs, see [Throttle pattern](#throttle-pattern).

## Subroutine composition with `withOverriddenHaltState`

`state.withOverriddenHaltState(other)` returns a copy of `state` whose would-be halt transitions fall through to `other` at run time. The original is left untouched. This is the engine's only composition primitive — bigger machines are built by stacking smaller halt-on-completion subroutines.

```javascript
import { Alphabet, State, TapeBlock, TuringMachine, Tape, haltState, ifOtherSymbol, movements, symbolCommands } from '@turing-machine-js/machine';

const alphabet = new Alphabet([' ', 'a', 'b', 'X']);
const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
const { symbol } = tapeBlock;

// Reusable subroutine 1: walk right until 'X', halt on it.
const scanToX = new State({
  [symbol(['X'])]: { nextState: haltState },
  [ifOtherSymbol]: { command: { movement: movements.right } },
}, 'scanToX');

// Reusable subroutine 2: erase the head cell, halt.
const eraseHere = new State({
  [ifOtherSymbol]: { command: { symbol: symbolCommands.erase }, nextState: haltState },
}, 'eraseHere');

// Compose: scan to X, then ERASE it. scanToX is unmodified.
const scanThenErase = scanToX.withOverriddenHaltState(eraseHere);

const tape = new Tape({ alphabet, symbols: ['a', 'b', 'X', 'b', 'a'] });
tapeBlock.replaceTape(tape);
await new TuringMachine({ tapeBlock }).run({ initialState: scanThenErase });

console.log(tape.symbols.join('')); // "ab ba" — the X at index 2 is gone, head landed there.
```

What changes between *running `scanToX` standalone* and *running the composed wrapper*:

`toMermaid(toGraph(scanToX, tapeBlock))` — the standalone subroutine:

```mermaid
flowchart TD
%% alphabets: [[" ","a","b","X"]]
  s0(((halt)))
  s1["scanToX"]
  idle([idle])
  idle -. enter .-> s1
  s1 -- "['X'] → [K]/[S]" --> s0
  s1 -- "[*] → [K]/[R]" --> s1
```

`toMermaid(toGraph(scanThenErase, tapeBlock))` — the wrapped composition:

```mermaid
flowchart TD
%% alphabets: [[" ","a","b","X"]]
  s0(((halt)))
  s2["eraseHere"]
  idle([idle])
  subgraph w_3["halt frame"]
    s3[["scanToX"]]
    c3(((halt)))
  end
  idle -. enter .-> s3
  s2 -- "[*] → [E]/[S]" --> s0
  s3 -- "['X'] → [K]/[S]" --> c3
  s3 -- "[*] → [K]/[R]" --> s3
  s3 -. onHalt .-> s2
```

**Reading guide** — the v7 emit (introduced in [#138](https://github.com/mellonis/turing-machine-js/issues/138)) makes the wrapper's runtime stack-frame semantics visible:

1. **The subgraph rectangle labeled `"halt frame"`** is the wrapper's runtime scope — while execution is "inside" this rectangle, the override target (`eraseHere`) sits on the runtime stack waiting to catch a halt. Visual-only; it does not mutate any edges.
2. **`[[scanToX]]` (Mermaid subroutine / double-walled-rectangle shape)** is the wrapper node. It's both the runtime entry point (execution starts here when entering the wrapper) AND the source of the dotted `onHalt` redirect. The wrapper's composite name (`scanToX(eraseHere)`) is computed at runtime via `state.name` but does not appear as a graph node label — only the bare's name is in the graph.
3. **The halt-marker `(((halt)))` inside the subgraph** (`c3` here) is where the bare's halt-bound transitions land *inside* the wrapper's scope. `haltState` is a runtime singleton; the halt marker is a teaching aid showing "halt is caught here, not at the real terminus." Solid arrows from the bare to the halt marker all stay inside the rectangle.
4. **The dotted `onHalt` arrow from `[[scanToX]]` to `eraseHere`** is the wrapper's catch-and-redirect. Originates from the wrapper-node since the wrapper *is* the catcher. Solid arrows from `[[scanToX]]` to other states can also cross the subgraph border — those are just regular runtime transitions whose target happens to be drawn outside this rectangle (only the dotted `onHalt` carries wrapper-machinery meaning). In larger compositions (`library-binary-numbers`'s `minusOne`), solid transitions whose target is *itself* a wrapped state render as a **thick `==>` arrow** instead of `-->` — that's the visual signal for "this transition enters a halt frame, pushing the override onto the runtime stack." Stack-growth structure is then scannable from the diagram: count thick arrows along an execution path to see how deep the stack gets.
5. **Real `(((halt)))` outside any subgraph** (`s0`) is the actual run terminus. Reached only by states that are *not* inside a wrapper's halt-frame — here, by `eraseHere` after it erases the cell.

**Reading runtime sequence on tape `['a','b','X','b','a']`:** enter the `halt frame` at `[[scanToX]]` (with `eraseHere` on the stack); `[*] → [K]/[R]` self-loops until the head sees `X`; the `['X'] → [K]/[S]` solid edge would normally halt — it lands on the halt marker `c3`, the wrapper's catch-and-redirect kicks in, pop the stack → `eraseHere`; `eraseHere` runs `[*] → [E]/[S]` and halts at real `s0`. Run terminates.

> 💡 **Round-trip caveat.** `toMermaid → fromMermaid → toGraph → toMermaid` is bytewise stable for simple wrappers like this one ([#139](https://github.com/mellonis/turing-machine-js/issues/139) regression). For shared-bare cases (same `State` instance used as the bare in multiple wrappers — e.g., `library-binary-numbers`'s `minusOne`), per-context duplication produces wrapper-id-dependent ordering that doesn't byte-match across rebuilds — equivalent runtime behavior, different emit-line order.

Wrappers nest: `inner.withOverriddenHaltState(middle).withOverriddenHaltState(outer)` chains halt-redirects through `middle → outer → halt`. `library-binary-numbers/src/index.ts`'s `minusOne` (the `~(~x + 1)` composition) uses a 4-deep nest of wrappers.

## Debugging breakpoints

Any `State` can carry a runtime-mutable `debug` config that pauses execution at chosen points.

```ts
import { State, haltState, ifOtherSymbol } from '@turing-machine-js/machine';

const myState = new State({...});

// state.debug is always a DebugConfig instance — chained writes work
// without prior whole-object assignment:
myState.debug.before = true;
myState.debug.after = [symA];

// Whole-object assignment also works for one-shot setup:
myState.debug = { before: true };
myState.debug = { before: [symA] };
myState.debug = { before: [symA], after: [symA] };

// Pause when the engine is about to enter halt (program exit OR subroutine pop):
haltState.debug = { before: true };

// Reset filters later — next read returns a fresh empty DebugConfig:
myState.debug = null;
```

> ⚠️ **`haltState.debug.after` throws.** Halt is terminal — there is no iteration-after-halt for an after-fire to anchor on. Assigning a truthy `.after` to `haltState.debug` (including `{ before: true, after: true }`) throws at write time. Symbol-list filters on `haltState.debug.before` are silent no-ops, since halt has no head symbol; only the wildcard `true` activates.

The `debug` field is mutable — toggle breakpoints at runtime without rebuilding the graph. The internal cell is shared with `state.withOverriddenHaltState(...)` wrappers, so an assignment on the original is visible from every wrapper. `state.debug` is always a `DebugConfig` instance (lazy-initialized on first read); plain-object input (`state.debug = { before: true }`) is wrapped in a fresh `DebugConfig` automatically. The instance itself is `Object.seal`-ed — typos like `state.debug.bofore = true` throw `TypeError` instead of silently creating a useless property. Per-property setters validate and freeze the stored array, so `state.debug.before.push(...)` also throws `TypeError`.

`run()` is async and accepts an `onPause` hook:

```ts
await machine.run({
  initialState,
  onStep: (m) => { /* logger sees every step */ },
  onPause: async (m) => {
    // Awaited at every break — hold execution until you resolve.
    if (m.debugBreak?.before) console.log('before:', m.state.name);
    if (m.debugBreak?.after)  console.log('after:',  m.state.name);
  },
});
```

Both `before` and `after` for the same iteration fire on the iteration's own yield, in the order **before → step → after**. `m.state` is always the iteration's own state; the `m.debugBreak` flag (`{before: true}` or `{after: true}`) tells the consumer which timing fired.

If `onPause` is not provided, breaks fire-and-resume invisibly — the trajectory is identical to running without `debug` set.

**Filter semantics:** `true` is a wildcard (match any symbol). `[ifOtherSymbol]` is NOT a wildcard — it matches only the catch-all resolution case (same meaning as in transition keys).

**Caveat:** `haltState` is a module-level singleton. Setting `haltState.debug` affects every machine in the process; clear in `afterEach` / `finally` for test isolation.

### Throttle pattern

For per-iter throttle / animation / "wait between steps" UIs, use the **`onIter`** hook — an awaited callback that fires once at the end of every iter, after both `onPause` dispatches on the same yield. It's the engine-native shape for per-iter coordination:

```ts
await machine.run({
  initialState,
  onIter: async (m) => {
    // Fires after before(m.state) / step / after(m.state) on iter m.step.
    await new Promise((r) => setTimeout(r, intervalMs));
  },
});
```

`onIter` is unaffected by the `debug` master switch and unrelated to `state.debug` — it fires on every iter regardless of whether any breakpoints are armed. It coexists cleanly with user-authored `state.debug` breakpoints: on an iter with both `.before` and `.after` armed, the consumer sees `onPause(before)` → `onStep` → `onPause(after)` → `onIter`, in that order, on the same yield.

A few details:

- **Halting iter**: `onIter` still fires on the iter whose `m.nextState === haltState`, after any halt-time `onPause` dispatches. Engine returns cleanly after that. Use this to land "halted" UI state in interactive consumers.
- **Click-pause / external interruption**: keep a flag set from the outside; check it inside `onIter` and `await` a resolvable Promise the UI controls (instead of the bare `setTimeout`). The engine just sees a longer awaited `onIter` — no engine surface needed for the pause.
- **Sync consumers should keep using `onStep`**: it's microtask-free; `onIter` adds one awaited boundary per iter. Use the right hook for the right verb (logging/tracing → `onStep`, throttle/coordination → `onIter`, user breakpoints → `onPause`).

(History: v6.2.0 briefly widened `onStep` to `void | Promise<void>` and added an inline `await`, motivated by this same throttle use case. That was a mistake — restored to sync in v6.3.0. v6.3.0 documented a workaround using `onPause` self-rearm on `state.debug.after = true`; that workaround is superseded by `onIter` in v6.4.0+.)

## Special objects

### haltState

A singleton `State` (`id === 0`). Transitioning into it stops the run. Imported as a named export from `@turing-machine-js/machine`; do not construct your own — `state.isHalt` checks identity against this single instance.

### ifOtherSymbol

A sentinel `Symbol` used as a key in a `State` definition to mean *match any symbol not handled by the other keys* (the fallback transition).

### movements

Per-tape head movement directives passed in `TapeCommand.movement`:

* `movements.left` — move the head one cell left
* `movements.right` — move the head one cell right
* `movements.stay` — leave the head where it is

### symbolCommands

Special values for `TapeCommand.symbol`:

* `symbolCommands.keep` — leave the current cell unchanged (default)
* `symbolCommands.erase` — write the alphabet's blank symbol

## Introspection and testing

`@turing-machine-js/machine` ships two complementary runtime utilities:

**`summarize` / `summarizeGraph`** — *structural* analysis. Looks at the state graph without running it.

```javascript
import { summarize } from '@turing-machine-js/machine';

const stats = summarize(myState, myTapeBlock);
// {
//   stateCount, transitionCount,
//   compositionEdgeCount, maxCompositionDepth,
//   selfLoopCount, hasCycles,
//   tapeCount, alphabetCardinalities,
// }
```

`State.inspect(state)` returns the same kind of data for a single state (transitions, override-halt target, etc.) without traversing the graph.

**`equivalentOn`** — *behavioral* comparison. Runs two machines on a list of test inputs and reports whether their outputs agree, where they first diverge, and how many steps each took.

```javascript
import { equivalentOn } from '@turing-machine-js/machine';

const report = equivalentOn(
  { state: referenceState, getTapeBlock: () => referenceTapeBlock.clone() },
  { state: candidateState, getTapeBlock: () => candidateTapeBlock.clone() },
  ['^1$', '^10$', '^11$', '^111$'],   // test cases
);
// report.allAgree → true | false
// report.results[i] → { agree, referenceOutput, candidateOutput,
//                       referenceSteps, candidateSteps, firstDivergenceStep }
```

For different alphabets, pass `{ reference, candidate }` paired cases plus a custom output comparator. See [`packages/machine/src/utilities/equivalence.spec.ts`](src/utilities/equivalence.spec.ts) for worked examples.

Together: use `summarize` to ask "is this machine the right shape?" (size, composition, cycles), and `equivalentOn` to ask "does this machine compute the right thing?" (correctness against a reference). Useful when comparing two implementations of the same algorithm — e.g., the marker-based and bare binary libraries — or when grading student-written machines against a reference.

For visualization and round-tripping, see `State.toGraph` / `State.fromGraph` and `toMermaid` / `fromMermaid`.

## Diagram conventions

The full reference for reading `toMermaid` output — shapes, edge styles, and the bracketed edge-label vocabulary. All shapes and arrows are standard [Mermaid flowchart syntax](https://mermaid.js.org/syntax/flowchart.html); any Mermaid renderer (GitHub preview, IDE plugins, [mermaid-js](https://github.com/mermaid-js/mermaid) client-side) paints these diagrams the same way.

### Node shapes

| Shape | Meaning |
|---|---|
| `s0(((halt)))` | the halt state |
| `sN["name"]` | a regular state |
| `sN[["name"]]` | a `withOverriddenHaltState` wrapper-bare (subroutine shape) — see [§Subroutine composition](#subroutine-composition-with-withoverriddenhaltstate) |
| `cN(((halt)))` inside a subgraph | halt marker (visualization aid; maps back to the singleton `haltState` at runtime) |
| `idle([idle])` | pre-execution sentinel (not a real state) |

### Edge styles

| Style | Where | Meaning |
|---|---|---|
| `-->` regular solid | between states | plain transition |
| `==>` thick solid | between states | transition INTO a wrapped state — stack-push happens at runtime |
| `-. onHalt .->` dotted | from `[[bare]]` to override | wrapper's catch-and-redirect |
| `-. enter .->` dotted | from `idle` to initial state | execution-start marker |

### Groupings

`subgraph w_N["halt frame"] … end` wraps a `[[bare]]` + its halt marker — visual grouping of the wrapper's runtime halt-handling scope.

### Edge label format

`[reads] → [writes]/[moves]`. Each bracketed list is a tape-block reading — one entry per tape; brackets always present, even single-tape.

| Glyph | Where | Meaning |
|---|---|---|
| `'X'` | read, write | literal alphabet symbol (single-quoted) |
| `*` | read only | `ifOtherSymbol` catch-all (ASCII `*`; a literal `*` in the alphabet renders as the quoted `'*'`, so the marker stays unambiguous) |
| `B` | read only | the tape's blank symbol (a literal `B` in the alphabet appears as `'B'`, so the marker stays unambiguous) |
| `K` | write only | keep (no write) |
| `E` | write only | erase (write the tape's blank) |
| `L` / `R` / `S` | move only | left / right / stay |

### Alternation rule

Alternative read patterns are always per-pattern-bracket:

- Single-tape: `['^']|['1']|['0']`
- Multi-tape: `['0','a']|['1','b']` — "(tape 1=`'0'` AND tape 2=`'a'`) OR (tape 1=`'1'` AND tape 2=`'b'`)"

The compact in-bracket form `['^'|'1']` is **rejected** by `fromMermaid` — and never emitted by `toMermaid`. The reason is pedagogical: each alternative is its own drawn transition, and the compact form would read as cross-product semantics in multi-tape (`['0'|'1','a'|'b']` could mean 4 combinations rather than 2 paired alternatives). One consistent rule across tape counts: each alternative is a full bracketed pattern.

### Multi-tape example

A 2-tape "copier" machine — as long as tape 1 reads a non-blank, write the same symbol to tape 2 and step both right; halt when tape 1 reads blank:

```mermaid
flowchart TD
%% alphabets: [[" ","0","1"],[" ","0","1"]]
  s0(((halt)))
  s1["copy"]
  idle([idle])
  idle -. enter .-> s1
  s1 -- "['0',*] → [K,'0']/[R,R]" --> s1
  s1 -- "['1',*] → [K,'1']/[R,R]" --> s1
  s1 -- "[B,*] → [K]/[S]" --> s0
```

Reading `['0',*] → [K,'0']/[R,R]`:

- **Read** `['0',*]` — tape 1 must be literal `'0'`; tape 2 is `ifOtherSymbol` (any).
- **Write** `[K,'0']` — tape 1: keep; tape 2: write literal `'0'`.
- **Move** `[R,R]` — both tapes step right.

## Versioning notes

API surface changes since v3, in past tense so the timing of each piece is explicit:

- **v4** — `run()` became async (`Promise<void>`). Per-state runtime breakpoints landed (`state.debug.before` / `state.debug.after`); `run()` accepted an `onDebugBreak` hook. `MachineState` exposed on each yield.
- **v5** — `onDebugBreak` renamed to `onPause`. New `run({ debug: boolean })` master switch suppresses all `onPause` dispatches without unsetting `state.debug` assignments. Assigning a truthy `.after` to `haltState.debug` now throws at write time (halt is terminal — no iteration-after-halt to anchor on).
- **v6** — Per-iter lifecycle reordered to `before → step → after`, all firing on the same yield. Previously `after` fired on iter K+1's tick with a `prevYield` substitution dance; that substitution is gone. The `MachineState.debugBreak` field shape is unchanged across all three versions.
- **v6.1** — `state.debug` ergonomics: the field is now always a non-null `DebugConfig` instance (lazy-initialized on first read), so chained field writes like `state.debug.before = true` work on a fresh state without a prior whole-object assignment. The `DebugConfig` instance is `Object.seal`-ed, so typos like `state.debug.bofore = true` throw `TypeError` at write time instead of silently creating a useless property. `state.debug = null` continues to work but semantically means "reset filters" — the next read returns a fresh empty `DebugConfig` (#150).
- **v6.2** *(superseded by v6.3.0)* — widened `onStep`'s signature to `(m) => void | Promise<void>` and added an inline `await onStep(...)` in the run loop, enabling throttle-in-`onStep` patterns. This overturned the docstring-stated contract that `onStep` is sync (microtask-free); the right place for per-iter throttling is `onPause` with self-rearm (see [Throttle pattern](#throttle-pattern)). Restored in v6.3.0.
- **v6.3** — `onStep` reverted to its v6.0–v6.1 sync contract — `(m) => void`, called synchronously inside the run loop. The Throttle pattern section documents the engine-native shape for per-iter throttle / "wait between iters" UIs. No other API changes.
- **v6.4** — New **`onIter`** hook on `run()`: awaited, fires once at the end of every iter (after both `onPause` dispatches on the same yield), unaffected by the `debug` master switch. Use for per-iter throttle / animation / coordination needing a suspend point; complements the existing sync `onStep` (tracing) and conditional `onPause` (user breakpoints). Three-hook contract is now `onStep` (sync, mid-iter) / `onPause` (awaited, on `state.debug` match) / `onIter` (awaited, end-of-iter). Additive — peer-deps unchanged. The v6.3.0 README's `onPause`-rearm throttle workaround is superseded.
- **v7** *(alpha 1, 2026-05-21)* — Composition-representation overhaul. **First pre-release on the `next` dist-tag:** `npm install @turing-machine-js/machine@next` (or pin `@7.0.0-alpha.1`). Stable v7.0.0 still pending [#102](https://github.com/mellonis/turing-machine-js/issues/102) (debugger step-in/over/out primitives). Landed in alpha.1:
  - **`withOverrodeHaltState` → `withOverriddenHaltState`** ([#149](https://github.com/mellonis/turing-machine-js/issues/149)). Grammar fix on a name introduced in 2019: the past-participle `overridden` fits the "with a halt-state that has been ___" naming idiom; `overrode` (simple past) didn't. Hard cutover — no deprecated alias. The getter (`state.overrodeHaltState` → `state.overriddenHaltState`) and the serialized `Graph` data field (`node.overrodeHaltStateId` → `node.overriddenHaltStateId`) rename in lockstep. Consumer migration: global find/replace `OverrodeHaltState` → `OverriddenHaltState` and `overrodeHaltState` → `overriddenHaltState`. Persisted `State.toGraph` JSON dumps would need the same field-rename treatment, but persistence isn't a known consumer pattern.
  - **Paren-based wrapped-state naming** ([#148](https://github.com/mellonis/turing-machine-js/issues/148)). `withOverriddenHaltState`'s composite name format changed from flat `bare>override` to nested `bare(override)`. Same nesting depth reads as `A(B(A))` (bare = `A`, override = `B(A)`) versus `A(B)(A)` (bare = `A(B)`, override = `A`) — two structurally-different wrap-trees that the old `>`-flat notation collided into the single string `A>B>A`. As a consequence, **user-provided state names must not contain `(` or `)`** — `State` now throws at construction time if a user passes such a name. The `>` character stays valid in user names (no longer reserved). The `inspect()` / `toGraph` / `toMermaid` outputs carry the new format. `states.md` files in `library-binary-numbers` regenerate accordingly.
  - **`toMermaid` wrapped-state emit overhaul** ([#138](https://github.com/mellonis/turing-machine-js/issues/138) / [#139](https://github.com/mellonis/turing-machine-js/issues/139)). The wrapper-and-its-bare pair collapses into a single graph node (`isWrapped: true`); the wrapper's composite name no longer appears as a node label (only the bare's name does). Each wrapper gets a Mermaid `subgraph w_${bareId}["halt frame"] … end` block containing the `[[bare]]` (subroutine shape) plus a halt-marker `(((halt)))` (visualization aid showing where halt-bound transitions land inside the scope). The dotted `onHalt` edge originates from the `[[bare]]` and crosses the subgraph border to the override target — exactly one per wrapper. `Graph` data shape gains `isWrapped` and `isHaltMarker` flags on `GraphNode` and a stable `id` on `GraphTransition` (deterministic per-edge identifier — supports downstream tooling like the `machines-demo` interactive viewer at [machines-demo#10](https://github.com/mellonis/machines-demo/issues/10)). Halt-marker graph nodes use negative ids and round-trip back to the singleton `haltState` via `fromGraph`. Bytewise round-trip stability falls out for simple wrappers (no composite name in the graph means `fromGraph(toGraph(state))` recomputes names fresh — no accumulation). Shared-bare cases (e.g. `minusOne`'s repeated `invertNumber`) use per-context duplication in the graph emit.

For the full release history, see the [GitHub releases page](https://github.com/mellonis/turing-machine-js/releases).

## Libraries

- [@turing-machine-js/library-binary-numbers](https://github.com/mellonis/turing-machine-js/tree/master/packages/library-binary-numbers) — binary arithmetic with `^…$` markers, multi-number-per-tape support
- [@turing-machine-js/library-binary-numbers-bare](https://github.com/mellonis/turing-machine-js/tree/master/packages/library-binary-numbers-bare) — same operations on a 3-symbol alphabet, single-number-per-tape, much smaller state graphs

## Links

- [Turing Machine](https://en.wikipedia.org/wiki/Turing_machine) on Wikipedia
