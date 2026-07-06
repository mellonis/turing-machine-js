# Graph highlight and breakpoint rules

> Canonical reference for every CSS class the demo applies to the rendered state-graph SVG, when each class fires, and how the breakpoint engine-side / UI-side state stays consistent. Companion to [`execution-model.md`](./execution-model.md) (modes + transitions) and [`machine-graph-palette.md`](./machine-graph-palette.md) (color tokens). Source files: `src/components/MachineGraph.svelte` (the apply-highlight + cache-build + indicator effects), `src/components/MachineView.svelte` (derives `graphHighlight`, owns the `breakpoints` set), `src/lib/machineWorker.ts` (`onPauseFn` + `toggleBreakpoint`), `src/lib/graphUtils.ts` (canonicalization helpers).

## 1. Node-id conventions

The engine's `Graph.nodes` keys are positive integer ids assigned at graph-build time. The demo also recognizes three synthetic ids:

| Id range | Kind | Where it comes from | Click target? |
|---|---|---|---|
| `> 0` | Regular state, wrapper, or bare | `State.toGraph` walks reachable States | yes |
| `0` | Halt singleton (`haltState`) | Engine sentinel, process-wide | no — global, not per-machine |
| even `< 0` | Halt marker (`isHaltMarker: true`, id = `-2 * frameId`) | `toGraph` rewrites in-frame halts so they land inside the subgraph cluster instead of the global singleton | no — collapses to `haltState` at runtime |
| odd `< 0` | Engine sentinel (e.g. `abortState` at id `-1`) | Reserved id space, disjoint from halt markers so the two never collide (#239) | its own breakpoint class (`bareIdOf` returns sentinels unchanged — never folded into halt's class); highlight targets it directly (`toId: -1` lights `s1`) |
| `'idle'` | Synthetic entry sentinel | `toGraph` always emits a stadium-shape `idle` node with `idle -. enter .-> sN` | no |

Click handlers are attached only to nodes whose key is `typeof === 'number' && > 0` — see `MachineGraph.svelte`'s cache-build `$effect`.

**Mermaid string ids (#239):** `applyHighlight`'s edge keys (the `HighlightOps.highlightEdge` `fromKey`/`toKey` arguments) are the mermaid *string* id, built via `mermaidIdFor(id)` / inverted via `parseMermaidId(s)` from `@turing-machine-js/machine` — not hand-built string literals. Namespacing: positive `N` → `uN`; `0` → `s0`; even negative `-2f` → `s0-f`; odd negative → `s{(1-id)/2}` (sentinel). The `w_${frameId}` callable-subtree subgraph key is a visuals-local convention, untouched by this namespacing.

## 2. Wrapper / bare equivalence

A `State.withOverriddenHaltState(continuation)` produces a *wrapper* State that shares its `#debugRef` cell with the bare engine-side (`State.ts:391`: `state.#debugRef = bare.#debugRef`). Setting `wrapper.debug.before = true` and `bare.debug.before = true` mutate the SAME cell.

The demo collapses this into a single breakpoint *equivalence class*:

- The **canonical id** for a class is the bare's id. `bareIdOf(id, graph)` returns the bare id for a wrapper, self otherwise.
- The `breakpoints: SvelteMap<number, { before: boolean; after: boolean }>` (in `MachineView`) holds canonical bare ids → per-kind state. Entries with both kinds off are pruned. `breakpointIndicatorSet` is the `$derived` set of "any kind set" canonical ids, passed to the indicator effect.
- The **indicator effect** (in `MachineGraph`) renders the `mg-breakpoint` mark on every class member (bare + every wrapper sharing that bare via `bareStateId`): for each cached node, it normalizes the node's id via `bareIdOf` and checks the indicator set. The set is kind-agnostic — the future per-kind dots (Layer N) will use the Map directly.
- The **highlight effect** uses an **asymmetric** expansion via `highlightExpand`:

  | Source side | Returns | Why |
  |---|---|---|
  | Wrapper | `[wrapper, bare]` | wrapper-entry pause is the visually joined pair — light up both |
  | Bare | `[bare]` only | when the engine is genuinely on the bare (loop iter), the wrapper isn't active |
  | Regular state | `[self]` | no class membership |

This means right-clicking a wrapper or a bare opens the menu over the same engine breakpoint class, both nodes show the indicator, but the strong-highlight only "leaks" wrapper → bare, never bare → wrappers.

**Halt class.** The halt singleton (`id 0`) and every halt marker (`id < 0`, one per frame; see §1) form an additional equivalence class — they all collapse to the engine-wide `haltState` at runtime. `bareIdOf` maps any negative id to `0`; `equivalentIds(0, g)` returns `[0, ...all halt markers]`. The breakpoint Map stores canonical `0`; the indicator therefore lights up the singleton AND every halt marker simultaneously. `MachineView`'s `onToggleBreakpoint` also normalizes negative ids to `0` before forwarding to the worker, so the worker (which only has `id 0` in `collectStates`) sees a single canonical toggle regardless of which halt-class node the user right-clicked.

**Class membership in the menu.** The context menu (§12) shows a "Shared with: …" info line listing other class members' names — so the user can see at a glance that flipping the BP also flips the sibling. For the halt class it instead shows "Global — affects all halts in the runtime", since `haltState` is a process-wide singleton rather than a per-graph state. Singleton classes (regular states, no wrappers / no sharing) omit the info line.

## 3. CSS classes applied to SVG elements

All classes are added imperatively by the apply-highlight or indicator `$effect`s in `MachineGraph.svelte`. Styling lives in the same component's `<style>` block; tokens in `app.css`.

| Class | Target | When | Cleared by |
|---|---|---|---|
| `mg-breakpoint` | `g.node` | Set on every member of an equivalence class whose canonical id is in `breakpoints` | Indicator effect re-runs on `breakpoints` change |
| `mg-highlight-from` | `g.node` (+ `'idle'` sentinel) | Source side of the just-fired or about-to-fire transition | Cleared at the top of every apply-highlight run |
| `mg-highlight-to` | `g.node` | Destination side of same | Same |
| `mg-highlight-strong` | `g.node` | The "focal" node of the highlight triple (set on the side matching `h.strong`, plus any class member via `highlightExpand` if source is wrapper) | Same |
| `mg-highlight-edge` | `path` + `g.label` of edge | The edge connecting from→to in graph data-id space (`L_${from}_${to}_*`); also wrapper→bare "call" edge when `toEqIds` expanded the pair | Same |
| `mg-frame-active` | `g.cluster` of a callable-subtree subgraph | The strong node (via canonical id) lives inside the frame — or the destination return chain detected a post-pop arrival from that frame | Same |
| `mg-hl-arrow-shape` | inside cloned `<marker>` | Materialized once per render at cache-build time; switched in via `marker-end` swap on highlighted paths (browsers without `context-stroke`) | Marker swap reverts via `data-mg-orig-marker-end` on clear |

## 4. `graphHighlight` shape (the input to the effect)

Derived in `MachineView.svelte` from `(executionMode, currentStateId, nextStateId, prevStateId, pauseBefore, graph)`:

```ts
type GraphHighlight = {
  fromId: number | 'idle';   // source-side node
  toId: number | null;       // destination-side node; null = no destination
  strong: 'from' | 'to' | null;
  paused: boolean;           // true → eligible for pulse + revisit logic
};
```

| Mode | `fromId` | `toId` | `strong` | `paused` |
|---|---|---|---|---|
| `RUNNING_AUTO` | `currentStateId` | `nextStateId` | `'from'` | `false` |
| `RUNNING_PAUSED`, `pauseBefore = true` (debug.before fired) | `prevStateId ?? 'idle'` | `currentStateId` | `'to'` | `true` |
| `RUNNING_PAUSED`, `pauseBefore = false` (Step / pause-after / click-pause) | `currentStateId` | `nextStateId` | `'from'` | `true` |
| Anything else | `null` (no highlight) |

`currentStateId` / `nextStateId` come from the worker's `paused` / `idle` / `stepped` responses (worker uses `m.state.id` for current, `nextStateIdFromYield` for next).

## 5. Halt-target retargeting

`toGraph` rewrites halt-bound transitions of in-frame states so they land on the **frame's halt marker** (id `= -2 * F`), not the real `haltState` (id `0`). The engine's runtime, however, reports `nextState.id === 0` for any halt. The apply-highlight effect bridges:

```
if toId === 0 AND fromId is in some frame F → toId := -2 * F
```

This makes the visible edge (`L_uX_s0-F_*`) the one that lights up. If `fromId` isn't in any frame (e.g. `writeMarker → halt` in the callable-subtree example), `toId` stays `0` and falls into the halt-singleton branch (§7).

## 6. Source return chain (engine just halted into a frame)

Fires when `toId < 0` (an in-frame halt marker). The engine will pop the stack and resume at the wrapper's override. To visualize the post-pop trajectory **before** the next iter relocates the strong node:

- Highlight the return arrow `L_w_${F}_u${wrapperId}` (dotted).
- Mark each wrapper of frame F with `mg-highlight-to`.
- Highlight each wrapper's call-target-replacement edge `L_u${wrapperId}_u${overrideId}` and the override node.

When multiple wrappers share the bare, the demo highlights all of them — the engine's runtime choice depends on stack state, which the demo doesn't track.

## 7. Destination return chain (engine just resumed at an override-target)

Mirror of §6, fires when `toId > 0` AND `fromId` is in some frame F AND any wrapper of F has `overriddenHaltStateId === toId`. The engine *just popped* and is paused/running at the override. The straight `bare → override` edge doesn't exist in the graph — light up the actual visible path:

- bare (`fromId`, gets `mg-highlight-from` from the standard pass)
- bare → halt-marker edge `L_u${fromId}_s0-${F}`
- halt-marker `s0-${F}` with `mg-highlight-to`
- return arrow `L_w_${F}_u${wrapperId}` (dotted)
- wrapper with `mg-highlight-to`
- wrapper → override edge `L_u${wrapperId}_u${toId}`
- override (= `toId`, gets `mg-highlight-to` + strong from standard pass)
- frame F's cluster gets `mg-frame-active` (strong node lives outside the frame, so the frame-highlight pass otherwise wouldn't fire)

## 8. Halt singleton (`toId === 0` with no retarget)

If §5's retarget didn't fire (because `fromId` isn't in a frame), `toId` stays `0`. The halt-singleton node is then highlighted via a direct lookup `nodeCache.get(0)` instead of the normal `highlightExpand` path (which skips `id <= 0`). Without this branch the leading edge would light up while the singleton stays grey — visually orphaned.

## 9. Frame-active rule

`mg-frame-active` lights the cluster border of a callable-subtree subgraph. Fires when **either**:

- the strong node's canonical id (`bareIdOf(strongId)`) lives inside the frame (`nodeFrameMap.get`), OR
- the destination return chain (§7) detected a post-pop arrival from that frame.

The first case handles "we're executing inside the subroutine"; the second handles "we just left the subroutine but the return-chain is still visualized."

## 10. Wrapper-entry call-edge highlight

When the to-side expansion via `highlightExpand` produced `[wrapper, bare]` (length 2), the connector between them is the wrapper→bare **call edge** `L_u${wrapperId}_u${bareId}`. The standard `highlightEdgeByDataId(fromKey, toKey)` call uses `toKey = u${wrapper}` so it wouldn't pick up this edge. An explicit follow-up call highlights it so the joined visual pair has a visible connector.

## 11. Pause-revisit pulse

A short opacity pulse fires on the strong element when the current paused event lands on the same state as the **immediately previous** paused event. Implementation:

- `lastPausedStrongId: number | 'idle' | null` stored at module scope.
- After applying highlight, if `h.paused && strongId === lastPausedStrongId`, call `strongEl.animate(...)`.
- If `h.paused`, write `strongId` to `lastPausedStrongId`.

**Important: use the raw `strongId`, NOT the canonical bare-id.** Wrapper-pause and bare-pause are visually distinct events even though they share `#debugRef`; pausing at the wrapper then continuing into the bare must NOT pulse (the engine moved between two different nodes). The frame-highlight pass uses the canonical for its lookup, but the pulse comparison uses the raw id.

Idle events (`h.paused === false`) never update `lastPausedStrongId`, so an `idle` that happens to report the same state doesn't poison the next paused-event comparison.

## 12. Right-click handling + listener lifecycle

The cache-build `$effect` walks the rendered SVG and attaches a `contextmenu` listener to every `g.node` whose key is a number (positive state, halt singleton `0`, or negative halt marker — only the synthetic `'idle'` string sentinel is skipped). Left-click stays native (text selection, focus, scroll-tap) — only right-click opens the BP menu, matching IDE convention. Halt nodes participate so the user can set / clear the global haltState breakpoint from any halt-class node (see §2's halt-class paragraph); the per-kind menu items dispatch through `MachineView.onToggleBreakpoint`, which canonicalizes negative ids → `0` before the runner sees them. Because mermaid's `lastSource` cache can skip a re-render when the source is byte-identical (so the SAME DOM persists across builds), the effect must NOT just re-attach — that stacks listeners and a single right-click would trigger N menu opens.

Pattern:

1. Module-scope `clickListenersController: AbortController | null = null`.
2. At the top of each cache-build pass: `clickListenersController?.abort()` (removes ALL listeners attached with that signal), then `new AbortController()`.
3. Pass `{ signal }` to every `addEventListener`.
4. Component unmount aborts in `onMount`'s cleanup.

The right-click handler `preventDefault`s the native context menu, then sets `menuStateId`, `menuX`, `menuY` to render a custom menu at the cursor.

### Menu state + lifecycle

The menu is two `<button role="menuitem">` items inside a `<div role="menu">`, positioned `fixed` at clamped viewport coordinates. Items show `☑`/`☐` based on the current `before` / `after` bits in `breakpointKinds.get(bareIdOf(stateId))`. Picking an item calls `runner.toggleBreakpoint(stateId, kind)` and closes the menu. The worker echoes `breakpointToggled` with the same `kind`, which updates the `breakpoints` Map via `runner.onBreakpointToggled`.

Closing happens via:
- Picking a menu item (fires `onclick`, then `closeMenu`).
- ESC keydown (global handler installed while menu open).
- Outside `mousedown` (global handler; `mousedown` not `click` so item picks land first).

A separate `AbortController` (`menuOutsideController`) gates the global handlers so they detach cleanly when the menu closes or the component unmounts.

### Edge-clamped positioning

After the menu mounts, a `$effect` measures `menuEl.getBoundingClientRect()` and shifts the position so the menu fits in the viewport (8px margin from each edge). The raw `menuX/menuY` are the right-click coordinates; the clamped `menuClampedX/menuClampedY` are what feed the inline `left`/`top` style. Re-runs when the raw coords change (subsequent right-click on a different node).

## 13. Breakpoint replay across builds

Building a new worker creates fresh State instances — any `debug.before`/`debug.after` set on the previous instances is gone. The `breakpoints` Map in `MachineView` is **user intent**, not run state, and survives:

```ts
async function reloadWorker(source = code) {
  // ... await runner.build(source) ...
  // Prune ids that don't exist in the new graph (user edited code).
  for (const id of [...breakpoints.keys()]) {
    if (!res.graph.nodes[id]) breakpoints.delete(id);
  }
  // Replay surviving kinds via toggleBreakpoint. Fresh States have no
  // debug set, so each toggle flips off→on. One call per stored kind per
  // class — the canonical-id keying prevents double-flips of the shared
  // #debugRef.
  for (const [id, kinds] of breakpoints) {
    if (kinds.before) runner.toggleBreakpoint(id, 'before');
    if (kinds.after) runner.toggleBreakpoint(id, 'after');
  }
}
```

On build **failure** the Map IS cleared — there's no graph to prune against.

The runner's echo `onBreakpointToggled` normalizes the echoed `stateId` via `bareIdOf(graph)` and updates only the matching `kind` bit, so the Map always holds canonical ids regardless of which class member the user actually right-clicked.

## 13a. After-fire + Step: synthetic-pause suppression

The engine's `onIter` fires at end-of-iter — functionally the same execution point as an `onPause(after, K)` fire (both happen after the iter's transition has executed and `onStep` has run). When a user clicks Step from inside an after-fire BP pause, the worker's `onIterFn` would otherwise dispatch a SECOND synthetic pause at the same effective point, producing a duplicate log entry.

Suppression: `onPauseFn` sets `dispatchedAfterThisIter = true` whenever the engine pause is after-side (`m.pause?.side === 'after'`). `onIterFn` reads the flag (and resets it) at iter boundary; when set AND `stepRequested` is true, it skips the synthetic dispatch **but keeps `stepRequested`** so the NEXT iter's `onIter` pauses naturally. Net effect: Step from an after-fire BP advances one iter (the right semantic for "next pause point"), instead of bouncing twice at the same point.

`before`-fires don't set the flag — they fire mid-iter, distinct from end-of-iter, so the synthetic at end-of-iter is a genuinely different pause point and isn't suppressed.

## 14. Worker-side wrapper handling (`onPauseFn`)

The engine fires `onPause` on BOTH the wrapper entry (iter K) and the immediately following bare entry (iter K+1) when the shared `#debugRef.before === true`. The worker pauses at the wrapper (the user-facing call site) and suppresses ONE following bare entry via `pendingJoinedBareId: number | null`:

```
1. onPause(wrapper):  if node.isWrapper && node.bareStateId !== null:
                        pendingJoinedBareId := bareStateId; dispatchPause
2. onPause(bare):     if state.id === pendingJoinedBareId:
                        clear flag; skip dispatch
3. onPause(bare K+2): pendingJoinedBareId === null; dispatch normally
```

Subsequent bare→bare loop iters pause normally — that's a real iteration, not a joined entry.

Also: when pausing at a wrapper, the worker swaps the dispatched `state` field to the bare's `name` (looked up via `currentGraph.nodes[bareStateId].name`). The log reads `paused at state walkToBlank ...` instead of `paused at state walkToBlank(writeMarker) ...` — the composite is engine implementation.

`currentGraph` is the engine-v7 `Graph` snapshot captured at build time and retained worker-side specifically so `onPauseFn` can ask `isWrapper?` and look up names. Cleared in `reset()`.

## 15. Post-machine differences

`@post-machine-js/machine` installs an `Object.defineProperty` lockdown on every non-halt PostMachine-constructed State's `debug` property that funnels DIRECT writes through Post's registry (`pm.setBreakpoint` for un-shared, throw for shared). `haltState` is NOT locked — direct `turing.haltState.debug = boolean` writes go straight to the engine setter (post dropped the module-load halt lockdown alongside engine #207). Post wraps `run`'s `onPause` to filter via that registry — pauses fire only when the registered breakpoint matches.

**Direct mutation of the engine's `DebugConfig` (e.g. `state.debug.before = true`) bypasses Post's lockdown** because the getter passes through; Post's wrapper then filters the engine's onPause out entirely. The worker's `toggleBreakpoint` therefore uses the SETTER form, reading both kinds and writing the merged shape so toggling one doesn't lose the other:

```ts
const debug = entry.state.debug;
const currentBefore = debug.before === true;
const currentAfter = debug.after === true;
const newBefore = req.kind === 'before' ? !currentBefore : currentBefore;
const newAfter = req.kind === 'after' ? !currentAfter : currentAfter;
entry.state.debug = null;  // clear first — see below
if (newBefore || newAfter) {
  entry.state.debug = {
    ...(newBefore ? { before: true } : {}),
    ...(newAfter ? { after: true } : {}),
  };
}
```

The intermediate `state.debug = null` is **required for Post**: Post's lockdown's setter PUSHES onto the `#breakpoints` array rather than replacing, so without the clear, repeated toggles accumulate stale entries. Turing's setter just creates a fresh DebugConfig either way — the null assignment is a no-op for Turing but essential for Post.

- Turing: setter creates/clears the engine's `DebugConfig` normally.
- Post: setter is intercepted, routed to `pm.setBreakpoint(path, filter)` or `pm.clearBreakpoint(path)` — registry updated, lockdown's internal write via `withLockdownEscape` then updates the engine ref.

Branchless form works for both engines.

## 16. Quick rules summary

A condensed cheat-sheet for the apply-highlight effect's decisions:

```
expand from-side via highlightExpand(fromId)            # asymmetric: wrapper → [wrapper, bare]
expand to-side via highlightExpand(toId) if toId > 0    # bare stays alone

mark fromEqIds as highlight-from (+ strong if h.strong === 'from')
mark toEqIds as highlight-to    (+ strong if h.strong === 'to')

mark halt-marker  (toId < 0) directly with highlight-to (+ strong if matching)
mark halt-singleton (toId === 0) directly with highlight-to (+ strong if matching)

highlight edge L_{fromKey}_{toKey}   # fromKey/toKey via mermaidIdFor (#239)
if toEqIds had wrapper+bare: also highlight L_u{wrapper}_u{bare}  (call edge)

if toId < 0:    source return chain    (halt-marker entry → wrappers → overrides)
if toId > 0 AND fromFrame matches some wrapper.overrideId:
                destination return chain  (bare → halt-marker → wrapper → override; frame active)

mark frame active for canonical(strongId)

if h.paused AND strongId === lastPausedStrongId: pulse strongEl
if h.paused: lastPausedStrongId := strongId           # raw, not canonical
```
