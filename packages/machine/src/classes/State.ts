import Command from './Command';
import Reference from './Reference';
import TapeBlock from './TapeBlock';
import TapeCommand from './TapeCommand';
import {id} from '../utilities/functions';
import {
  type Graph,
  decodeMovement,
  decodeWriteSymbol,
} from '../utilities/graph';
// Delegate targets for `State.toGraph` / `State.fromGraph` (#180). The
// import cycle with stateGraph.ts is resolved by ESM live bindings — see
// the bottom-of-file note in that module. Aliased so the delegating
// static methods can keep their canonical names without clashing.
import {
  type StateMap,
  collectStates as collectStatesImpl,
  fromGraph as fromGraphImpl,
  toGraph as toGraphImpl,
} from '../utilities/stateGraph';

export const ifOtherSymbol = Symbol('other symbol');

// Module-private symbol used by DebugConfig setters to call State's validator
// without exposing the validator on the public surface.
const validateDebugFilter = Symbol('validateDebugFilter');

/**
 * @internal
 *
 * Package-private accessor key for sibling modules in
 * `packages/machine/src` (e.g. `utilities/stateGraph.ts`, and the planned
 * `utilities/stateCollect.ts` for #195). Re-exported from this module so
 * sibling files can import it; intentionally NOT re-exported from the
 * package's public `index.ts`, so downstream consumers don't see it on
 * the supported surface.
 *
 * Calling `state[STATE_INTERNAL]()` returns a getter/setter view onto the
 * State's private fields. Reads are live (they close over `this`), so the
 * view stays in sync with subsequent mutations on the State. There's one
 * mutating setter on the view — `name` — used exclusively by
 * `fromGraph` to assign graph-sourced composite names (e.g. `A(target)`)
 * that the public name validator would reject; see the JSDoc on the
 * accessor itself.
 *
 * Designed in #180 with #195 in mind so its surface doesn't need to grow
 * when `collectStates` lands.
 */
export const STATE_INTERNAL = Symbol('State.internal');

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

  // Single lookup + throw site shared by `getCommand`, `getNextState`, and
  // `getMatchedTransition`. Returns the symbol's entry `{command, nextState}`
  // (one map-get, no `.has()` pre-check); throws a unified message when no
  // entry exists. Before #206, each public method did its own `.has() + .get()!`
  // double-lookup with a slightly different error string — same root cause
  // ("no transition for this symbol"), so the message is unified.
  #getEntry(symbol: symbol) {
    const entry = this.#symbolToDataMap.get(symbol);

    if (entry === undefined) {
      throw new Error(`No transition for symbol at state named ${this.#name}`);
    }

    return entry;
  }

  getCommand(symbol: symbol) {
    return this.#getEntry(symbol).command;
  }

  getNextState(symbol: symbol) {
    return this.#getEntry(symbol).nextState;
  }

  /**
   * Like `getNextState`, but also returns the matched Symbol and its index
   * in this State's transition declaration order (= the `K` in `toGraph`'s
   * `${stateId}.${K}` transition ids). Used by `TuringMachine.runStepByStep`
   * to populate `MachineState.matchedTransition` for #205 — exposes which
   * transition fired so consumers (UIs, log tools, coverage maps) can
   * resolve the firing edge without re-deriving from `(source, nextState)`,
   * which is ambiguous when multiple transitions on the same source go to
   * the same destination.
   *
   * Throws (matching `getNextState` / `getCommand`) when no entry exists for
   * the symbol. For wrappers (states produced by `withOverriddenHaltState`):
   * the symbol-to-data map is shared with the bare via `bareState`, so the
   * returned `ix` is a valid position into BOTH the wrapper's and the
   * bare's transition iteration order — they're the same map.
   */
  getMatchedTransition(symbol: symbol): {
    nextState: State | Reference,
    matchedSymbol: symbol,
    ix: number,
  } {
    const entry = this.#getEntry(symbol);

    // Iteration order on a Map is insertion order; index lookup is O(N),
    // acceptable since this fires at most once per iter and N (transitions
    // per state) is typically tiny. If hot-path measurement ever flags it,
    // cache as `#symbolToIxMap` mirror.
    let ix = 0;

    for (const key of this.#symbolToDataMap.keys()) {
      if (key === symbol) break;
      ix += 1;
    }

    return {nextState: entry.nextState, matchedSymbol: symbol, ix};
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

  /**
   * @internal
   *
   * Package-private getter/setter view onto this State's private fields,
   * for sibling modules in `packages/machine/src` (currently `stateGraph.ts`
   * for `toGraph` / `fromGraph`, and the planned `stateCollect.ts` for
   * #195's `collectStates`).
   *
   * Read access is live — the getters close over `this`, so the view
   * stays in sync with subsequent mutations on this State. There's a
   * single mutating setter on the view, `name`, which exists to let
   * `fromGraph` assign graph-sourced composite names (e.g. `A(target)`)
   * to freshly-constructed bare States. The constructor's name validator
   * rejects parens (reserved as wrapper-composition delimiters in
   * `withOverriddenHaltState`); the setter intentionally bypasses that
   * check because the same delimiters appear in legitimate wrapper-bare
   * names round-tripped through the graph.
   *
   * Returns a fresh view object on every call — cheap enough for the
   * BFS-once-per-build callers, and avoids holding a reference object on
   * every State instance. Keep this surface tight: callers should only
   * read what they need. Adding fields here is a deliberate decision —
   * each adds to the implicit contract sibling modules can rely on.
   */
  [STATE_INTERNAL]() {
    // Aliasing `this` so the nested object-literal getters/setters below
    // can read/write the enclosing State's private fields — getters in an
    // object literal can't be arrow functions, so the standard arrow-
    // captures-`this` trick doesn't apply here.
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return {
      get id(): number { return self.#id; },
      get name(): string { return self.#name; },
      set name(v: string) { self.#name = v; },
      get bareState(): State | null { return self.#bareState; },
      get overriddenHaltState(): State | null { return self.#overriddenHaltState; },
      get symbolToDataMap() { return self.#symbolToDataMap; },
      get tags(): ReadonlySet<string> { return self.#tags; },
    };
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


  /**
   * Walks the reachable State graph from `initialState` and returns a
   * serializable `Graph`. Thin delegate to `utilities/stateGraph.ts`'s
   * `toGraph` (extracted in #180); see that module for the BFS shape and
   * v7 callable-subtree emit semantics.
   */
  static toGraph(initialState: State, tapeBlock: TapeBlock): Graph {
    return toGraphImpl(initialState, tapeBlock);
  }

  /**
   * Inverse of `toGraph`: rebuilds a State graph and a fresh TapeBlock
   * from a serialized `Graph`. Thin delegate to `utilities/stateGraph.ts`'s
   * `fromGraph` (extracted in #180); see that module for the
   * reconstruction pass shape (Reference pre-create, bare build, wrapper
   * resolution via `withOverriddenHaltState`, ref binding).
   */
  static fromGraph(graph: Graph): {
    start: State;
    tapeBlock: TapeBlock;
    states: Record<number, State>;
  } {
    return fromGraphImpl(graph);
  }

  /**
   * Returns a `Map<number, {state, transitionSymbols}>` keyed by engine
   * `GraphNode.id`, exposing the live `State` instance + per-pattern
   * Symbol references for each node so downstream tooling can mutate
   * `state.debug` by numeric id and set per-pattern breakpoints by
   * `GraphTransition.id` (#195). Thin delegate to
   * `utilities/stateGraph.ts`'s `collectStates`; see that module for
   * the alignment contract, coverage rules, and halt-singleton warning.
   */
  static collectStates(initialState: State, tapeBlock: TapeBlock): StateMap {
    return collectStatesImpl(initialState, tapeBlock);
  }
}

export const haltState = new State(null);
