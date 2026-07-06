import Alphabet from '../classes/Alphabet';
import Reference from '../classes/Reference';
import State, {STATE_INTERNAL, abortState, haltState, ifOtherSymbol} from '../classes/State';
import TapeBlock from '../classes/TapeBlock';
import type TapeCommand from '../classes/TapeCommand';
import {
  type Graph,
  type GraphNode,
  decodeMovement,
  decodePatternDescription,
  decodeWriteSymbol,
  parseMovementLabel,
  parsePatternString,
  parseWriteSymbolLabel,
} from './graph';

// Graph serialization/reconstruction + state collection for State graphs.
// Sibling-module access to State's internals uses the `STATE_INTERNAL`
// Symbol re-exported from State.ts — see the @internal JSDoc there.
// `State.toGraph` / `.fromGraph` / `.collectStates` static methods on
// State are thin delegates to functions in this module.

/**
 * Walks the reachable graph from `initialState` and returns a serializable
 * `Graph`. The walk is a BFS that visits each State exactly once (keyed by
 * the State's internal id) and emits one `GraphNode` per State plus
 * synthetic halt-marker nodes per callable-subtree frame.
 *
 * Round-trips losslessly with `fromGraph` in the sense that running the
 * rebuilt machine on the same input produces the same output — but State
 * instance identities are NOT preserved across the cycle.
 *
 * See `classes/State.ts` for the runtime model these graph nodes describe;
 * see `utilities/graphFormats.ts` for the Mermaid-flavored serialization
 * built on top of `Graph`.
 */
export function toGraph(initialState: State, tapeBlock: TapeBlock): Graph {
  const nodes: Record<number, GraphNode> = {};
  const alphabets = tapeBlock.alphabets.map((alphabet) => alphabet.symbols);

  // Pass 1: BFS-discover all reachable States; emit one GraphNode per State
  // (wrapper or bare/regular). Wrappers and bares are separate nodes.
  const visited = new Set<number>();
  const queue: State[] = [initialState];
  const bareIds = new Set<number>(); // ids referenced as a wrapper's bareStateId

  while (queue.length > 0) {
    const state = queue.shift()!;
    const stateInternal = state[STATE_INTERNAL]();

    if (visited.has(stateInternal.id)) {
      continue;
    }

    visited.add(stateInternal.id);

    if (state.isHalt) {
      if (!(0 in nodes)) {
        nodes[0] = {
          id: 0,
          name: stateInternal.name,
          isHalt: true,
          isAbort: state.isAbort,
          isHaltMarker: false,
          isWrapper: false,
          bareStateId: null,
          frameId: null,
          transitions: [],
          overriddenHaltStateId: null,
          tags: [...stateInternal.tags],
        };
      }

      continue;
    }

    // Wrapper? Emit wrapper node + queue bare and override target.
    if (stateInternal.overriddenHaltState !== null && stateInternal.bareState !== null) {
      const bareState = stateInternal.bareState;
      const overrideTarget = stateInternal.overriddenHaltState;
      const bareInternal = bareState[STATE_INTERNAL]();
      const overrideInternal = overrideTarget[STATE_INTERNAL]();

      nodes[stateInternal.id] = {
        id: stateInternal.id,
        name: stateInternal.name, // composite name like "A(target)"
        isHalt: false,
        isAbort: state.isAbort,
        isHaltMarker: false,
        isWrapper: true,
        bareStateId: bareInternal.id,
        frameId: null,
        transitions: [],
        overriddenHaltStateId: overrideInternal.id,
        tags: [...stateInternal.tags],
      };

      bareIds.add(bareInternal.id);
      queue.push(bareState);
      queue.push(overrideTarget);

      continue;
    }

    // Regular (or bare) state — build node with transitions.
    const node: GraphNode = {
      id: stateInternal.id,
      name: stateInternal.name,
      isHalt: false,
      isAbort: state.isAbort,
      isHaltMarker: false,
      isWrapper: false,
      bareStateId: null,
      frameId: null,
      transitions: [],
      overriddenHaltStateId: null,
      tags: [...stateInternal.tags],
    };

    nodes[stateInternal.id] = node;

    let patternIx = 0;

    for (const [sym, {command, nextState}] of stateInternal.symbolToDataMap) {
      let target: State;

      try {
        target = nextState instanceof State ? nextState : nextState.ref;
      } catch {
        patternIx += 1;
        continue;
      }

      const targetInternal = target[STATE_INTERNAL]();

      node.transitions.push({
        pattern: decodePatternDescription(sym.description, alphabets),
        command: command.tapesCommands.map((tc) => ({
          symbol: decodeWriteSymbol(tc.symbol),
          movement: decodeMovement((tc.movement as symbol).description),
        })),
        nextStateId: targetInternal.id,
        // `${stateId}.${transitionIx}` — matches
        // `MachineState.matchedTransition.id` so consumers can do
        // `graph.nodes[stateId].transitions.find(t => t.id === id)`.
        // `.` separator (vs `-`) avoids collision with negative
        // halt-marker ids.
        id: `${stateInternal.id}.${patternIx}`,
      });

      queue.push(target);
      patternIx += 1;
    }
  }

  // Always emit real halt as a sentinel, even if no transition targets it.
  // It anchors the `subtree -. halt .-> s0` frame-level arrow whenever a
  // frame demand-emits one, and it's the canonical machine-halt singleton.
  if (!(0 in nodes)) {
    nodes[0] = {
      id: 0,
      name: 'halt',
      isHalt: true,
      isAbort: haltState.isAbort,
      isHaltMarker: false,
      isWrapper: false,
      bareStateId: null,
      frameId: null,
      transitions: [],
      overriddenHaltStateId: null,
      tags: [...haltState[STATE_INTERNAL]().tags],
    };
  }

  // Pass 2: For each bare, compute its forward-reachable set (following
  // transitions; stopping at halt; including wrappers AND tunneling through
  // them to their `overriddenHaltStateId` continuation).
  //
  // Wrappers are call-site markers — semantically owned by the CALLER (the
  // bare whose body invokes the sub-call). Both the wrapper itself and its
  // continuation (its `--> override` arrow in the rendered diagram, sourced
  // from `overriddenHaltStateId`) belong to the caller's frame: the wrapper
  // visually anchors the call site inside the caller's subgraph; the
  // continuation is the state the caller's body resumes at AFTER the inner
  // sub-call returns. So when reach traversal hits a wrapper, we PUSH the
  // wrapper (joining the caller's reach-set) AND tunnel through to its
  // continuation (also joining). Wrappers carry no `transitions` of their
  // own (Pass 1 emits `transitions: []` on wrapper nodes), so the main loop
  // pops them and adds them to `reach` without further traversal — but the
  // continuation already entered via the wrapper-tunnel chain in
  // `resolveAndPush`.
  //
  // Halt-bound retargeting + union-find then "just work": continuation
  // states' halt-bound transitions get retargeted to the caller's halt
  // marker (so an in-subroutine halt returns to the caller, not the
  // program's terminal halt); when two bares both reach the same
  // continuation through different wrapper chains, union-find merges their
  // frames as it already does for non-wrapper overlap.
  //
  // Wrapper chains (continuation IS another wrapper, e.g., nested
  // compositions) are walked transitively by the inner while-loop in
  // `resolveAndPush` — each tunnel hop pushes the intermediate wrapper.
  const computeReach = (startId: number): Set<number> => {
    const reach = new Set<number>();
    const stack: number[] = [];

    const resolveAndPush = (id: number) => {
      let current = id;

      while (true) {
        const target = nodes[current];

        // Sentinels (real halt AND abort) are terminal — neither ever
        // joins a callable-subtree frame. Only halt-bound transitions
        // retarget to a frame's halt marker (Pass 4 below stays
        // halt-only); abort-bound transitions must reach here and stop
        // without being added to any bare's reach set, so `frameId`
        // stays `null` on the abort node and abort never gets a marker.
        if (!target || target.isHalt || target.isAbort) {
          return;
        }

        if (!target.isWrapper) {
          stack.push(current);
          return;
        }

        // Wrapper: push it (so it joins the caller's frame) AND tunnel to
        // its continuation. Both belong to the caller's frame.
        stack.push(current);

        /* c8 ignore next 3 — every wrapper emitted by Pass 1 has a
           non-null overriddenHaltStateId (lines 76-101); this branch
           only guards against future wrapper variants that might not. */
        if (target.overriddenHaltStateId === null) {
          return;
        }

        current = target.overriddenHaltStateId;
      }
    };

    resolveAndPush(startId);

    while (stack.length > 0) {
      const id = stack.pop()!;

      if (reach.has(id)) {
        continue;
      }

      reach.add(id);

      // Wrappers have empty transitions arrays — the for-loop runs zero
      // iterations and we proceed to the next stack entry.
      for (const t of nodes[id].transitions) {
        resolveAndPush(t.nextStateId);
      }
    }

    return reach;
  };

  const reachByBare = new Map<number, Set<number>>();

  for (const bareId of bareIds) {
    reachByBare.set(bareId, computeReach(bareId));
  }

  // Pass 3: Union-find on bare overlaps. Two bares merge if their reach
  // sets share any state. Canonical representative = smallest bare-id in
  // the component.
  const ufParent = new Map<number, number>();

  // Note: no path compression. The union policy below ("smaller id always
  // becomes root") keeps the tree flat — every union targets bares[0] as
  // the root, so any node's parent IS the root. Walking up never exceeds
  // one step. Path compression would be dead code under this invariant.
  const ufFind = (id: number): number => {
    if (!ufParent.has(id)) {
      ufParent.set(id, id);
    }

    let root = id;

    while (ufParent.get(root) !== root) {
      root = ufParent.get(root)!;
    }

    return root;
  };

  const ufUnion = (a: number, b: number) => {
    const ra = ufFind(a);
    const rb = ufFind(b);

    if (ra === rb) return;

    if (ra < rb) {
      ufParent.set(rb, ra);
    } else {
      ufParent.set(ra, rb);
    }
  };

  for (const bareId of bareIds) {
    ufFind(bareId);
  }

  // For each state, collect the bares that reach it; union all bares that
  // share a state.
  const stateToReachingBares = new Map<number, number[]>();

  for (const [bareId, reachSet] of reachByBare) {
    for (const stateId of reachSet) {
      let bares = stateToReachingBares.get(stateId);

      if (!bares) {
        bares = [];
        stateToReachingBares.set(stateId, bares);
      }

      bares.push(bareId);
    }
  }

  for (const bares of stateToReachingBares.values()) {
    for (let i = 1; i < bares.length; i += 1) {
      ufUnion(bares[0], bares[i]);
    }
  }

  // Assign frameId to each in-reach state.
  const frameIds = new Set<number>();

  for (const [stateId, bares] of stateToReachingBares) {
    const frameId = ufFind(bares[0]);

    nodes[stateId].frameId = frameId;
    frameIds.add(frameId);
  }

  // Pass 4: Retarget halt-bound transitions for in-frame states to the
  // frame's halt marker. Out-of-frame states (top-level dispatcher, override
  // targets, etc.) keep their halt-bound transitions pointing at real halt.
  for (const node of Object.values(nodes)) {
    if (node.frameId === null) {
      continue;
    }

    // Even negative id — disjoint from the odd-negative sentinel
    // ids (`abortState` at `-1`, any future sentinel at further odd
    // negatives) so marker ids and sentinel ids never collide.
    const haltMarkerId = -2 * node.frameId;

    for (const t of node.transitions) {
      const target = nodes[t.nextStateId];

      if (target && target.isHalt && !target.isHaltMarker) {
        t.nextStateId = haltMarkerId;
      }
    }
  }

  // Pass 5: Emit one halt marker per frame.
  for (const frameId of frameIds) {
    // Even negative id — see the Pass 4 comment above.
    const haltMarkerId = -2 * frameId;

    nodes[haltMarkerId] = {
      id: haltMarkerId,
      name: 'halt',
      isHalt: true,
      isAbort: false,
      isHaltMarker: true,
      isWrapper: false,
      bareStateId: null,
      frameId,
      transitions: [],
      overriddenHaltStateId: null,
      tags: [],
    };
  }

  return {initialId: initialState[STATE_INTERNAL]().id, alphabets, nodes};
}

/**
 * Inverse of `toGraph`: rebuilds a State graph (and a fresh TapeBlock with
 * the graph's alphabets) from a serialized Graph. Round-trips with `toGraph`
 * in the sense that running the rebuilt machine on the same input gives the
 * same output, but the rebuilt State instances have *new* internal IDs.
 *
 * Under the v7 callable-subtree model, graph nodes split into:
 *   - Wrapper nodes (`isWrapper: true`, no transitions) — reconstructed via
 *     `bareStates[bareStateId].withOverriddenHaltState(finalStates[overriddenHaltStateId])`.
 *   - Bare/regular nodes — constructed as normal States with transitions.
 *   - Halt + halt-marker nodes — collapse to the singleton `haltState`.
 *   - The abort node (`isAbort: true`, id `-1`), when present —
 *     collapses to the singleton `abortState`. Never a bare or an
 *     override target, so it never appears as a wrapper node.
 */
export function fromGraph(graph: Graph): {
  start: State;
  tapeBlock: TapeBlock;
  states: Record<number, State>;
} {
  const alphabetObjs = graph.alphabets.map((syms) => new Alphabet(syms));
  const tapeBlock = TapeBlock.fromAlphabets(alphabetObjs);
  const ids = Object.keys(graph.nodes).map(Number);

  // Pass 1: pre-create a Reference for each non-sentinel non-halt-marker
  // node (both wrappers and regulars). Halt and halt-marker nodes collapse
  // to the singleton `haltState`, and the abort node (if present) collapses
  // to the singleton `abortState` — neither needs a ref.
  const refs: Record<number, Reference> = {};

  for (const nodeId of ids) {
    const node = graph.nodes[nodeId];

    if (!node.isHalt && !node.isAbort) {
      refs[nodeId] = new Reference();
    }
  }

  // Convert a parsed pattern back to the symbol key the State expects.
  const patternToKey = (parsed: ReturnType<typeof parsePatternString>): symbol => {
    if (parsed === null) {
      return ifOtherSymbol;
    }

    const flat: (string | symbol)[] = [];

    for (const row of parsed) {
      for (const cell of row) {
        flat.push(cell === null ? ifOtherSymbol : cell);
      }
    }

    return tapeBlock.symbol(flat);
  };

  // Pass 2: build a State for each non-wrapper non-halt non-halt-marker
  // non-abort node. Transitions point at refs so cycles work; haltState
  // (and halt markers, which collapse to haltState) and abortState
  // are used directly.
  const bareStates: Record<number, State> = {};

  for (const nodeId of ids) {
    const node = graph.nodes[nodeId];

    if (node.isHalt || node.isAbort || node.isWrapper) {
      continue;
    }

    const stateDefinition: ConstructorParameters<typeof State>[0] = {};

    for (const t of node.transitions) {
      const key = patternToKey(parsePatternString(t.pattern, graph.alphabets));
      const target = graph.nodes[t.nextStateId];
      const nextState: State | Reference = !target || target.isHalt
        ? haltState
        : target.isAbort
          ? abortState
          : refs[t.nextStateId];

      stateDefinition![key] = {
        command: t.command.map((c) => ({
          symbol: parseWriteSymbolLabel(c.symbol),
          movement: parseMovementLabel(c.movement),
        })) as ConstructorParameters<typeof TapeCommand>[0][],
        nextState,
      };
    }

    // Graph-sourced names may contain `(` and `)` (composite wrapper names —
    // although wrappers go through a separate path below, defensive
    // construction here keeps the bypass uniform). Construct without a name
    // and assign `name` directly through the internal accessor's setter to
    // skip the constructor's user-facing name validation.
    const bare = new State(stateDefinition);

    bare[STATE_INTERNAL]().name = node.name;

    if (node.tags.length > 0) {
      bare.tag(...node.tags);
    }

    bareStates[nodeId] = bare;
  }

  // Pass 3: resolve every node to its final State (memoized + cycle-safe).
  // Wrappers compose lazily via `withOverriddenHaltState` once their bare
  // and override are resolved.
  const finalStates: Record<number, State> = {};
  const inProgress = new Set<number>();

  const getFinal = (nodeId: number): State => {
    if (finalStates[nodeId]) {
      return finalStates[nodeId];
    }

    const node = graph.nodes[nodeId];

    if (!node || node.isHalt) {
      finalStates[nodeId] = haltState;

      return haltState;
    }

    if (node.isAbort) {
      finalStates[nodeId] = abortState;

      return abortState;
    }

    if (inProgress.has(nodeId)) {
      throw new Error(`override-halt cycle at state #${nodeId}`);
    }

    inProgress.add(nodeId);

    let state: State;

    if (node.isWrapper) {
      const bare = getFinal(node.bareStateId!);
      const override = getFinal(node.overriddenHaltStateId!);

      state = bare.withOverriddenHaltState(override);

      // Apply wrapper-scoped tags. Tags don't leak across wrappers
      // sharing a bare — the wrapper instance owns its own tag set, and
      // wrapper memoization returns the same instance for the same
      // (bare, override) pair, so this is idempotent across rebuilds.
      if (node.tags.length > 0) {
        state.tag(...node.tags);
      }
    } else {
      state = bareStates[nodeId];
    }

    inProgress.delete(nodeId);
    finalStates[nodeId] = state;

    return state;
  };

  for (const nodeId of ids) {
    getFinal(nodeId);
  }

  // Pass 4: bind each ref to the resolved final State so cross-node
  // transitions land on the right instance.
  for (const nodeId of ids) {
    if (!graph.nodes[nodeId].isHalt && !graph.nodes[nodeId].isAbort) {
      refs[nodeId].bind(finalStates[nodeId]);
    }
  }

  return {
    start: finalStates[graph.initialId],
    tapeBlock,
    states: finalStates,
  };
}

/**
 * One entry in the `StateMap` returned by `collectStates`.
 *
 * - `state`: the live `State` instance for this Graph node. For the halt
 *   singleton at id `0`, this is the engine-wide `haltState`; for the abort
 *   singleton at id `-1`, this is the engine-wide `abortState` —
 *   toggling `state.debug` on either entry affects every machine in the
 *   process.
 * - `transitionSymbols`: per-pattern Symbols in `#symbolToDataMap` insertion
 *   order, aligned positionally with `GraphTransition.id` patternIx. For
 *   wrappers and the halt/abort singletons this is `[]` (no own
 *   transitions).
 */
export type StateMapEntry = {
  state: State;
  transitionSymbols: symbol[];
};

/**
 * Numeric `GraphNode.id` → `StateMapEntry`. Returned by `collectStates`.
 * Halt markers (synthetic nodes with `id = -2 * frameId`, even
 * negatives) are NOT included — they're visualization-only and all
 * collapse to the `haltState` singleton already exposed at id `0`.
 */
export type StateMap = Map<number, StateMapEntry>;

/**
 * Returns a `Map<number, {state, transitionSymbols}>` keyed by engine
 * `GraphNode.id`, giving downstream tooling direct access to the `State`
 * instance + per-pattern Symbol references for breakpoint setup.
 *
 * **Positional alignment contract.** For any `GraphTransition` whose id
 * is `${N}.${K}` (the separator changed from `-` to `.` in v7),
 * `result.get(N)!.transitionSymbols[K]` is the Symbol
 * the transition fires on (reference equality, not structural). The K-th
 * entry is the K-th key from the source State's `#symbolToDataMap` in
 * insertion order, including `ifOtherSymbol` when the user wrote one.
 * Consumers filtering the catch-all path identity-compare against the
 * engine-exported `ifOtherSymbol`.
 *
 * **Unbound-`Reference` slots.** `toGraph` increments `patternIx` even
 * when a transition's `nextState` is an unresolved `Reference` (it
 * `continue`s without pushing the GraphTransition). In that case
 * `transitionSymbols[K]` is still set to the K-th Map key, but no
 * `Graph.nodes[N].transitions` entry exists with id `${N}.${K}`. Sparse
 * on the Graph side, dense on the `transitionSymbols` side — same
 * indexing.
 *
 * **Coverage.** Map keys are the State-backed subset of `graph.nodes`:
 * regulars + bares + wrappers + the halt singleton (id `0`) + the abort
 * singleton (id `-1`) when the graph references it. Synthetic halt
 * markers (id `-2 * frameId`, even negatives) are excluded — they all reach
 * the same `haltState` object at runtime, and the primary consumer
 * (the machines-demo debugger UI)
 * surfaces halt-pause via a separate UI control, not via clicks on
 * halt glyphs. If a future consumer needs uniform-by-id lookup, the
 * helper can be extended additively.
 *
 * **Sentinel-singleton warning.** `result.get(0)!.state === haltState` and
 * `result.get(-1)!.state === abortState` — both the engine-wide, process-
 * wide sentinels. Toggling `.debug` on either entry affects every machine
 * in the runtime, not just the one this map was built from.
 */
export function collectStates(initialState: State, tapeBlock: TapeBlock): StateMap {
  // Anchor on toGraph's authoritative id set — it knows the canonical
  // ordering of wrapper/bare/regular emission and which nodes are
  // synthetic halt markers we have to skip. Building our own BFS would
  // duplicate that logic; reusing the Graph guarantees collectStates'
  // id keys never drift from toGraph's GraphTransition ids.
  const graph = toGraph(initialState, tapeBlock);

  // Walk the State graph to associate each State instance with its
  // engine id. The shape mirrors toGraph's Pass 1 — visit by id, branch
  // on halt / wrapper / regular — but only collects the (id → State)
  // mapping. Lighter than re-running the union-find passes; no
  // GraphNode construction.
  const stateById = new Map<number, State>();
  const visited = new Set<number>();
  const queue: State[] = [initialState];

  while (queue.length > 0) {
    const state = queue.shift()!;
    const internal = state[STATE_INTERNAL]();

    if (visited.has(internal.id)) continue;
    visited.add(internal.id);

    stateById.set(internal.id, state);

    if (state.isHalt) continue;

    if (internal.bareState !== null && internal.overriddenHaltState !== null) {
      queue.push(internal.bareState);
      queue.push(internal.overriddenHaltState);
      continue;
    }

    for (const {nextState} of internal.symbolToDataMap.values()) {
      let target: State;

      try {
        target = nextState instanceof State ? nextState : nextState.ref;
      } catch {
        continue; // unbound Reference — skip silently, matches toGraph
      }

      queue.push(target);
    }
  }

  // Build the result by iterating graph.nodes — the authoritative id set
  // minus halt markers — and dispatching on node kind. The halt singleton
  // entry's `state` reads from `stateById` (the BFS visited haltState if
  // any path reached it) but falls back to the module-level singleton
  // for graphs whose only halt presence is the always-emitted sentinel.
  const result: StateMap = new Map();

  for (const idStr of Object.keys(graph.nodes)) {
    const id = Number(idStr);
    const node = graph.nodes[id];

    if (node.isHaltMarker) continue; // synthetic; collapses to haltState at id 0

    if (node.isHalt) {
      // The real halt — always the engine-wide singleton. Prefer the
      // BFS-visited instance for identity-equality with whatever the
      // caller has; fall back to the module singleton when the BFS
      // didn't reach haltState (toGraph emits id 0 unconditionally).
      result.set(id, {
        state: stateById.get(0) ?? haltState,
        transitionSymbols: [],
      });
      continue;
    }

    if (node.isAbort) {
      // The abort singleton — mirrors the real-halt branch above.
      // Unlike halt, abort is never unconditionally emitted, so when this
      // branch runs the BFS above is guaranteed to have visited it (same
      // reachability walk `toGraph` used to discover the node); the
      // fallback to the module singleton is defensive symmetry with the
      // halt branch, not a load-bearing path.
      result.set(id, {
        state: stateById.get(id) ?? abortState,
        transitionSymbols: [],
      });
      continue;
    }

    if (node.isWrapper) {
      result.set(id, {
        state: stateById.get(id)!,
        transitionSymbols: [],
      });
      continue;
    }

    // Regular or bare State — enumerate `#symbolToDataMap.keys()` for
    // the patternIx alignment. The K-th key is the Symbol that
    // `${id}.${K}` GraphTransition fires on (positional contract).
    const state = stateById.get(id)!;
    const transitionSymbols = [...state[STATE_INTERNAL]().symbolToDataMap.keys()];
    result.set(id, {state, transitionSymbols});
  }

  return result;
}

// Note on the import cycle with `State.ts`: stateGraph.ts value-imports
// `State`, `STATE_INTERNAL`, `haltState`, and `ifOtherSymbol`; State.ts
// value-imports `toGraph` and `fromGraph` for its static-method delegates.
// ESM resolves cycles via live bindings — both modules see each other's
// exports as long as nothing at module-load reads a binding before its
// source module finishes evaluating. All references here live inside
// function bodies, so the cycle is safe.
