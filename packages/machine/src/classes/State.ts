import Alphabet from './Alphabet';
import Command from './Command';
import Reference from './Reference';
import TapeBlock from './TapeBlock';
import TapeCommand from './TapeCommand';
import {id} from '../utilities/functions';
import {
  type Graph,
  type GraphNode,
  decodeMovement,
  decodePatternDescription,
  decodeWriteSymbol,
  parseMovementLabel,
  parsePatternString,
  parseWriteSymbolLabel,
} from '../utilities/graph';

export const ifOtherSymbol = Symbol('other symbol');

// Module-private symbol used by DebugConfig setters to call State's validator
// without exposing the validator on the public surface.
const validateDebugFilter = Symbol('validateDebugFilter');

export class DebugConfig {
  readonly #ownerState: State;

  #before?: readonly symbol[] | true;

  #after?: readonly symbol[] | true;

  constructor(
    ownerState: State,
    initial?: { before?: symbol[] | readonly symbol[] | true; after?: symbol[] | readonly symbol[] | true },
  ) {
    this.#ownerState = ownerState;

    if (initial) {
      if (initial.before !== undefined) {
        this.before = initial.before as symbol[] | true;
      }

      if (initial.after !== undefined) {
        this.after = initial.after as symbol[] | true;
      }
    }

    // Seal the instance so typos like `cfg.bofore = true` throw at write
    // time (in strict mode, which TS-emitted modules use) instead of
    // silently creating a useless own property. The class's `before`/`after`
    // setters still work — they resolve through the prototype chain and
    // write to private fields, neither of which Object.seal restricts.
    Object.seal(this);
  }

  get before(): readonly symbol[] | true | undefined {
    return this.#before;
  }

  set before(v: symbol[] | readonly symbol[] | true | undefined) {
    this.#ownerState[validateDebugFilter]('before', v);
    this.#before = Array.isArray(v) ? Object.freeze([...v]) : v as true | undefined;
  }

  get after(): readonly symbol[] | true | undefined {
    return this.#after;
  }

  set after(v: symbol[] | readonly symbol[] | true | undefined) {
    this.#ownerState[validateDebugFilter]('after', v);
    this.#after = Array.isArray(v) ? Object.freeze([...v]) : v as true | undefined;
  }
}

export default class State {
  // Memoization cache for `withOverriddenHaltState`. Keyed by
  // (bare, override) — same args return the same wrapper instance (#175).
  // Two-level WeakMap so the outer entry is GC'd when the bare is collected;
  // WeakRef values let wrappers themselves be GC'd when nothing else holds
  // them, with cache misses simply reconstructing fresh wrappers.
  static #wrapperCache = new WeakMap<State, WeakMap<State, WeakRef<State>>>();

  readonly #id: number = id(this);

  // Not `readonly` because `withOverriddenHaltState` and `fromGraph` set the
  // composed name on a no-arg `new State()` to bypass the constructor's
  // user-facing name validation (composite names contain `(` and `)`).
  #name: string;

  #overriddenHaltState: State | null = null;

  // For wrapper states (produced by `withOverriddenHaltState`), points at the
  // State whose transition map was wrapped. `null` on bare/atomic states.
  // Used by `toGraph` to collapse the wrapper-and-its-bare pair into a single
  // "wrapped bare" graph node — see the v7 emit redesign for #138.
  #bareState: State | null = null;

  #symbolToDataMap = new Map<symbol, { command: Command, nextState: State | Reference }>();

  // Shared mutable cell — withOverriddenHaltState wrappers reference the same
  // object so that `state.debug = ...` (and nullings) propagate across them.
  // Note: toGraph / fromGraph deliberately do not serialize debug — debug is
  // a runtime concern, not part of the structural graph.
  #debugRef: { current: DebugConfig | null } = {current: null};

  // Out-of-band tags applied to this State (#186). Tags are visualization
  // and debugger-tooling metadata — they don't affect runtime transition
  // lookup or `equivalentOn` comparisons. Stored as a Set for de-duplication;
  // exposed via the `tags` getter as a frozen array snapshot. Lives on the
  // State INSTANCE so wrappers (from `withOverriddenHaltState`) carry tags
  // independently of their bare's tag set — see the #175 sharing test in
  // State.spec.ts.
  #tags: Set<string> = new Set();

  constructor(stateDefinition: Record<string | symbol, {
    command?: Command | ConstructorParameters<typeof TapeCommand>[0] | ConstructorParameters<typeof TapeCommand>[0][],
    nextState?: State | Reference,
  }> | null = null, name?: string) {
    if (stateDefinition) {
      const keys = Object.getOwnPropertyNames(stateDefinition);

      if (keys.length) {
        throw new Error(`invalid state definition while constructing state #${this.#id}`);
      }

      const symbols = Object.getOwnPropertySymbols(stateDefinition);

      if (symbols.length === 0) {
        throw new Error(`invalid state definition while constructing state #${this.#id}`);
      }

      symbols.forEach((symbol) => {
        const {nextState} = stateDefinition[symbol];
        const nextStateLocal = nextState ?? this;

        if (!(nextStateLocal instanceof State) && !(nextStateLocal instanceof Reference)) {
          throw new Error('invalid nextState');
        }

        let {command} = stateDefinition[symbol];

        if (command == null) {
          command = new Command([
            new TapeCommand({}),
          ]);
        }

        if (!(command instanceof Command) && !Array.isArray(command)) {
          command = [command];
        }

        let commandLocal = command;

        if (Array.isArray(command)) {
          try {
            commandLocal = new Command(command);
          } catch (error) {
            void error;
          }
        }

        if (!(commandLocal instanceof Command)) {
          throw new Error('invalid command');
        }

        this.#symbolToDataMap.set(symbol, {
          command: commandLocal,
          nextState: nextStateLocal,
        });
      });
    }

    if (name !== undefined && /[()]/.test(name)) {
      throw new Error(`invalid state name "${name}": must not contain '(' or ')' (reserved as wrapper-composition delimiters in withOverriddenHaltState)`);
    }

    this.#name = name ?? `id:${this.#id}`;
  }

  get id() {
    return this.#id;
  }

  get name() {
    return this.#name;
  }

  get isHalt() {
    return this.#id === 0;
  }

  get overriddenHaltState() {
    return this.#overriddenHaltState;
  }

  get ref() {
    return this;
  }

  get debug(): DebugConfig {
    // Lazy-init: `state.debug` is never null at read time, so chained writes
    // like `state.debug.before = true` work on a fresh state without a prior
    // whole-object assignment. The setter still accepts `null` to reset the
    // filters; the next read recreates a fresh empty `DebugConfig` on demand.
    // See #150.
    if (this.#debugRef.current === null) {
      this.#debugRef.current = new DebugConfig(this);
    }

    return this.#debugRef.current;
  }

  set debug(
    value: DebugConfig | { before?: symbol[] | readonly symbol[] | true; after?: symbol[] | readonly symbol[] | true } | null,
  ) {
    if (value === null) {
      this.#debugRef.current = null;
      return;
    }

    if (value instanceof DebugConfig) {
      this.#debugRef.current = value;
      return;
    }

    this.#debugRef.current = new DebugConfig(this, value);
  }

  /**
   * Add one or more tags to this State (#186). Tags are out-of-band metadata
   * used by visualization (`toMermaid` emits `classDef`/`class` lines) and
   * debugger tooling — they don't affect runtime transition lookup,
   * `equivalentOn` comparisons, or any structural identity. Chainable.
   */
  tag(...tags: string[]): this {
    for (const t of tags) {
      this.#tags.add(t);
    }

    return this;
  }

  /**
   * Remove one or more tags from this State (#186). Untagging a tag the
   * State doesn't carry is a no-op. Chainable.
   */
  untag(...tags: string[]): this {
    for (const t of tags) {
      this.#tags.delete(t);
    }

    return this;
  }

  /**
   * Frozen snapshot of this State's current tags (#186). The returned array
   * is `Object.freeze`d — mutating it throws in strict mode (which TS-emitted
   * code uses). Order matches insertion order of the underlying Set.
   */
  get tags(): readonly string[] {
    return Object.freeze([...this.#tags]);
  }

  /** @internal — invoked by DebugConfig setters via module-private symbol. */
  [validateDebugFilter](
    fieldName: 'before' | 'after',
    filter: readonly symbol[] | true | undefined,
  ): void {
    if (filter === undefined) return;

    // #108 part 2: `.after` on haltState has no semantic anchor — halt is
    // terminal, so there is no iteration-after-halt for an after-fire to
    // attach to. Reject any truthy assignment (true OR list) at write time
    // so misuse surfaces immediately rather than silently no-op'ing.
    if (this.isHalt && fieldName === 'after') {
      throw new Error(
        'haltState.debug.after is not supported: halt is terminal, so there is '
        + 'no iteration-after-halt for an after-fire to anchor on. Use '
        + '{ before: true } to pause on halt entry.',
      );
    }

    if (filter === true) return;

    // haltState has no own transitions; symbol-list filters on `before` are
    // silent no-ops at the engine level (spec §8.6), so accept any list shape.
    if (this.isHalt) return;

    for (const sym of filter) {
      if (sym !== ifOtherSymbol && !this.#symbolToDataMap.has(sym)) {
        throw new Error(
          `State.debug.${fieldName}: symbol is not a transition key of this state `
          + `(state name: ${this.#name}). Common cause: symbol comes from a `
          + 'different tape block, or doesn\'t match any of this state\'s transitions.',
        );
      }
    }
  }

  getSymbol(tapeBlock: TapeBlock) {
    const symbol = [...this.#symbolToDataMap.keys()].find((currentSymbol) => tapeBlock.isMatched({
      symbol: currentSymbol,
    }));

    if (symbol) {
      return symbol;
    }

    return ifOtherSymbol;
  }

  getCommand(symbol: symbol) {
    if (this.#symbolToDataMap.has(symbol)) {
      return this.#symbolToDataMap.get(symbol)!.command;
    }

    throw new Error(`No command for symbol at state named ${this.#name}`);
  }

  getNextState(symbol: symbol) {
    if (this.#symbolToDataMap.has(symbol)) {
      return this.#symbolToDataMap.get(symbol)!.nextState;
    }

    throw new Error(`No nextState for symbol at state named ${this.#id}`);
  }

  withOverriddenHaltState(overriddenHaltState: State) {
    // Unwrap `this` if it's itself a wrapper — the chain's inner overrides
    // are dead at runtime anyway (only the outermost `.wohs()`'s override is
    // pushed onto the halt-stack on entry; verified empirically). Composite
    // name reflects runtime behavior, not construction history. See #176.
    const bare = this.#bareState ?? this;

    // Memoize by (bare, override) so identical args return the same instance
    // (#175). The cache uses WeakMaps + WeakRefs so cached wrappers can be
    // GC'd when nothing else holds them. Compounds with the chain-collapse
    // above: `A.wohs(t1).wohs(t2)` keys as (A, t2) after the unwrap, hitting
    // the same cache slot as a direct `A.wohs(t2)`.
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

    // Cache miss — construct with no name, then overwrite #name directly
    // (composed names contain `(` and `)` which the constructor's user-facing
    // validation would reject; private-field access bypasses that).
    const state = new State();

    state.#name = `${bare.name}(${overriddenHaltState.name})`;
    state.#symbolToDataMap = bare.#symbolToDataMap;
    state.#overriddenHaltState = overriddenHaltState;
    state.#debugRef = bare.#debugRef;
    state.#bareState = bare;

    innerCache.set(overriddenHaltState, new WeakRef(state));

    return state;
  }

  // Single-state introspection — no traversal, no tapeBlock required.
  // Returns id, name, halt-status, override-halt target, and the list of
  // transitions out of this state with decoded write/movement labels.
  // Symbol patterns are returned as the raw description string from the
  // interned JS Symbol (decode via decodePatternDescription if needed).
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
    const transitions: Array<{
      rawPatternDescription: string | undefined;
      command: Array<{ symbol: string; movement: string }>;
      nextState: { id: number; name: string } | null;
    }> = [];

    for (const [sym, {command, nextState}] of state.#symbolToDataMap) {
      let target: State | null = null;

      try {
        target = nextState instanceof State ? nextState : nextState.ref;
      } catch {
        target = null; // unbound Reference
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

    return {
      id: state.#id,
      name: state.#name,
      isHalt: state.isHalt,
      overriddenHaltState: state.#overriddenHaltState
        ? {id: state.#overriddenHaltState.id, name: state.#overriddenHaltState.name}
        : null,
      transitions,
    };
  }

  // Walks the State graph and emits a `Graph` data structure. v7 callable-
  // subtree emit shape (#174):
  //
  // Each `withOverriddenHaltState` wrapper produces TWO graph nodes:
  //   - A wrapper node (`isWrapper: true`, `[[composite-name]]` shape) — the
  //     call site. No transitions of its own. `bareStateId` points to the
  //     bare's GraphNode; `overriddenHaltStateId` points to the override
  //     target's GraphNode.
  //   - A bare node (`isWrapper: false`, regular shape) — the callable body.
  //     Has the bare's transitions. Shared across all wrappers that wrap
  //     this bare (no per-context duplication).
  //
  // Frames are computed via union-find on bare reachability: two bares whose
  // forward-reachable sets overlap merge into one frame. Each frame contains
  // its bares + body states + a single halt marker (id = `-frameId`). The
  // canonical `frameId` is the smallest bare-id in the component.
  //
  // Halt-bound transitions of any in-frame state are retargeted to the
  // frame's halt marker. The frame's `subtree -. return .-> wrapper` and
  // `subtree -. halt .-> s0` arrows are demand-emitted by `toMermaid` from
  // the frame structure; they're not stored as graph edges.
  static toGraph(initialState: State, tapeBlock: TapeBlock): Graph {
    const nodes: Record<number, GraphNode> = {};
    const alphabets = tapeBlock.alphabets.map((alphabet) => alphabet.symbols);

    // Pass 1: BFS-discover all reachable States; emit one GraphNode per State
    // (wrapper or bare/regular). Wrappers and bares are separate nodes.
    const visited = new Set<number>();
    const queue: State[] = [initialState];
    const bareIds = new Set<number>(); // ids referenced as a wrapper's bareStateId

    while (queue.length > 0) {
      const state = queue.shift()!;

      if (visited.has(state.#id)) {
        continue;
      }

      visited.add(state.#id);

      if (state.isHalt) {
        if (!(0 in nodes)) {
          nodes[0] = {
            id: 0,
            name: state.#name,
            isHalt: true,
            isHaltMarker: false,
            isWrapper: false,
            bareStateId: null,
            frameId: null,
            transitions: [],
            overriddenHaltStateId: null,
            tags: [...state.#tags],
          };
        }

        continue;
      }

      // Wrapper? Emit wrapper node + queue bare and override target.
      if (state.#overriddenHaltState !== null && state.#bareState !== null) {
        const bareState = state.#bareState;
        const overrideTarget = state.#overriddenHaltState;

        nodes[state.#id] = {
          id: state.#id,
          name: state.#name, // composite name like "A(target)"
          isHalt: false,
          isHaltMarker: false,
          isWrapper: true,
          bareStateId: bareState.#id,
          frameId: null,
          transitions: [],
          overriddenHaltStateId: overrideTarget.#id,
          tags: [...state.#tags],
        };

        bareIds.add(bareState.#id);
        queue.push(bareState);
        queue.push(overrideTarget);

        continue;
      }

      // Regular (or bare) state — build node with transitions.
      const node: GraphNode = {
        id: state.#id,
        name: state.#name,
        isHalt: false,
        isHaltMarker: false,
        isWrapper: false,
        bareStateId: null,
        frameId: null,
        transitions: [],
        overriddenHaltStateId: null,
        tags: [...state.#tags],
      };

      nodes[state.#id] = node;

      let patternIx = 0;

      for (const [sym, {command, nextState}] of state.#symbolToDataMap) {
        let target: State;

        try {
          target = nextState instanceof State ? nextState : nextState.ref;
        } catch {
          patternIx += 1;
          continue;
        }

        node.transitions.push({
          pattern: decodePatternDescription(sym.description, alphabets),
          command: command.tapesCommands.map((tc) => ({
            symbol: decodeWriteSymbol(tc.symbol),
            movement: decodeMovement((tc.movement as symbol).description),
          })),
          nextStateId: target.#id,
          id: `${state.#id}-${patternIx}`,
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
        isHaltMarker: false,
        isWrapper: false,
        bareStateId: null,
        frameId: null,
        transitions: [],
        overriddenHaltStateId: null,
        tags: [...haltState.#tags],
      };
    }

    // Pass 2: For each bare, compute its forward-reachable set (following
    // transitions; stopping at halt and at wrappers — both are frame
    // boundaries).
    const computeReach = (startId: number): Set<number> => {
      const reach = new Set<number>();
      const stack = [startId];

      while (stack.length > 0) {
        const id = stack.pop()!;

        if (reach.has(id)) {
          continue;
        }

        const node = nodes[id];

        if (!node || node.isHalt || node.isWrapper) {
          continue;
        }

        reach.add(id);

        for (const t of node.transitions) {
          const target = nodes[t.nextStateId];

          if (!target || target.isHalt || target.isWrapper) {
            continue;
          }

          stack.push(t.nextStateId);
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

    const ufFind = (id: number): number => {
      if (!ufParent.has(id)) {
        ufParent.set(id, id);
      }

      let root = id;

      while (ufParent.get(root) !== root) {
        root = ufParent.get(root)!;
      }

      // Path compression
      let cur = id;

      while (ufParent.get(cur) !== root) {
        const next = ufParent.get(cur)!;

        ufParent.set(cur, root);
        cur = next;
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

      const haltMarkerId = -node.frameId;

      for (const t of node.transitions) {
        const target = nodes[t.nextStateId];

        if (target && target.isHalt && !target.isHaltMarker) {
          t.nextStateId = haltMarkerId;
        }
      }
    }

    // Pass 5: Emit one halt marker per frame.
    for (const frameId of frameIds) {
      const haltMarkerId = -frameId;

      nodes[haltMarkerId] = {
        id: haltMarkerId,
        name: 'halt',
        isHalt: true,
        isHaltMarker: true,
        isWrapper: false,
        bareStateId: null,
        frameId,
        transitions: [],
        overriddenHaltStateId: null,
        tags: [],
      };
    }

    return {initialId: initialState.#id, alphabets, nodes};
  }

  // Inverse of toGraph: rebuilds a State graph (and a fresh TapeBlock with the
  // graph's alphabets) from a serialized Graph. Round-trips with toGraph in
  // the sense that running the rebuilt machine on the same input gives the
  // same output, but the rebuilt State instances have *new* internal IDs.
  //
  // Under the v7 callable-subtree model (#174), graph nodes split into:
  //   - Wrapper nodes (`isWrapper: true`, no transitions) — reconstructed via
  //     `bareStates[bareStateId].withOverriddenHaltState(finalStates[overriddenHaltStateId])`.
  //   - Bare/regular nodes — constructed as normal States with transitions.
  //   - Halt + halt-marker nodes — collapse to the singleton `haltState`.
  static fromGraph(graph: Graph): {
    start: State;
    tapeBlock: TapeBlock;
    states: Record<number, State>;
  } {
    const alphabetObjs = graph.alphabets.map((syms) => new Alphabet(syms));
    const tapeBlock = TapeBlock.fromAlphabets(alphabetObjs);
    const ids = Object.keys(graph.nodes).map(Number);

    // Pass 1: pre-create a Reference for each non-halt non-halt-marker node
    // (both wrappers and regulars). Halt and halt-marker nodes collapse to the
    // singleton `haltState` and need no ref.
    const refs: Record<number, Reference> = {};

    for (const nodeId of ids) {
      const node = graph.nodes[nodeId];

      if (!node.isHalt) {
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
    // node. Transitions point at refs so cycles work; haltState (and halt
    // markers, which collapse to haltState) are used directly.
    const bareStates: Record<number, State> = {};

    for (const nodeId of ids) {
      const node = graph.nodes[nodeId];

      if (node.isHalt || node.isWrapper) {
        continue;
      }

      const stateDefinition: ConstructorParameters<typeof State>[0] = {};

      for (const t of node.transitions) {
        const key = patternToKey(parsePatternString(t.pattern, graph.alphabets));
        const target = graph.nodes[t.nextStateId];
        const nextState: State | Reference = !target || target.isHalt
          ? haltState
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
      // and assign `#name` directly to skip user-facing name validation.
      const bare = new State(stateDefinition);

      bare.#name = node.name;

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

      if (inProgress.has(nodeId)) {
        throw new Error(`override-halt cycle at state #${nodeId}`);
      }

      inProgress.add(nodeId);

      let state: State;

      if (node.isWrapper) {
        const bare = getFinal(node.bareStateId!);
        const override = getFinal(node.overriddenHaltStateId!);

        state = bare.withOverriddenHaltState(override);

        // Apply wrapper-scoped tags (#186). Tags don't leak across wrappers
        // sharing a bare — the wrapper instance owns its own tag set, and
        // engine #175 memoization returns the same instance for the same
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
      if (!graph.nodes[nodeId].isHalt) {
        refs[nodeId].bind(finalStates[nodeId]);
      }
    }

    return {
      start: finalStates[graph.initialId],
      tapeBlock,
      states: finalStates,
    };
  }
}

export const haltState = new State(null);
