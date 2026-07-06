import Command from './Command';
import Reference from './Reference';
import TapeBlock from './TapeBlock';
import TapeCommand from './TapeCommand';
import {id, reserveSentinelId} from '../utilities/functions';
import {
  type Graph,
  decodeMovement,
  decodeWriteSymbol,
} from '../utilities/graph';
// Aliased so the delegating static methods can keep their canonical names
// without clashing. The import cycle with stateGraph.ts is resolved by
// ESM live bindings — see the bottom-of-file note in that module.
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
 * `utilities/stateCollect.ts` for `collectStates`). Re-exported from this module so
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
 * Designed with `collectStates` in mind so its surface doesn't need to grow
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
  // (bare, override) — same args return the same wrapper instance.
  // Two-level WeakMap so the outer entry is GC'd when the bare is collected;
  // WeakRef values let wrappers themselves be GC'd when nothing else holds
  // them, with cache misses simply reconstructing fresh wrappers.
  static #wrapperCache = new WeakMap<State, WeakMap<State, WeakRef<CallFrame>>>();

  readonly #id: number = id(this);

  // Not `readonly` because `withOverriddenHaltState` and `fromGraph` set the
  // composed name on a no-arg `new State()` to bypass the constructor's
  // user-facing name validation (composite names contain `(` and `)`).
  #name: string;

  #symbolToDataMap = new Map<symbol, { command: Command, nextState: State | Reference }>();

  // Shared mutable cell — withOverriddenHaltState wrappers reference the same
  // object so that `state.debug = ...` (and nullings) propagate across them.
  // Note: toGraph / fromGraph deliberately do not serialize debug — debug is
  // a runtime concern, not part of the structural graph.
  #debugRef: { current: DebugConfig | null } = {current: null};

  // Storage for `haltState.debug` and `abortState.debug`.
  // Sentinels (haltState / abortState) are terminal states — they have no iter
  // of their own, so the per-side `{ before, after }` DebugConfig shape doesn't
  // model anything meaningful for them. Instead the breakpoint is a single
  // boolean ("enabled / disabled"). The pause anchors on the iter whose
  // transition LEADS to the sentinel, fired at end-of-iter (after that iter's
  // own after-pause if armed). Only used when `isSentinel`; ignored on every
  // other State (whose `#debugRef` flow is unchanged).
  #sentinelDebug: boolean = false;

  // Out-of-band tags applied to this State. Tags are visualization
  // and debugger-tooling metadata — they don't affect runtime transition
  // lookup or `equivalentOn` comparisons. Stored as a Set for de-duplication;
  // exposed via the `tags` getter as a frozen array snapshot. Lives on the
  // State INSTANCE so wrappers (from `withOverriddenHaltState`) carry tags
  // independently of their bare's tag set — see the memoization sharing test in
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

  get isAbort() {
    return this.#id === -1;
  }

  // Sentinels occupy id <= 0: halt at 0, then odd negatives in creation
  // order (abort = -1, a hypothetical third sentinel = -3, the k-th = -(2k-3)). Even
  // negatives are NOT sentinels — they're toGraph's synthetic per-frame
  // halt markers, which never exist as State instances.
  get isSentinel() {
    return this.#id <= 0;
  }

  // Plain States never override the halt state — only a `CallFrame` (produced
  // by `withOverriddenHaltState`) carries an override, via its own getter.
  get overriddenHaltState(): State | null {
    return null;
  }

  get ref() {
    return this;
  }

  get debug(): DebugConfig {
    // Sentinels: the canonical access path is via the singleton
    // exports (`haltState` / `abortState`), which are typed `HaltState` /
    // `AbortState` — their `debug` getters are narrowed to `boolean`. Generic
    // `State` references statically see `DebugConfig` and (in practice) never
    // refer to sentinels — the run loop's `state` is never a sentinel because
    // they are terminal. The cast below makes the runtime boolean return
    // type-compatible with the declared `DebugConfig` for any rare caller that
    // holds a State reference happening to be a sentinel.
    if (this.isSentinel) {
      return this.#sentinelDebug as unknown as DebugConfig;
    }

    // Lazy-init: `state.debug` is never null at read time, so chained writes
    // like `state.debug.before = true` work on a fresh state without a prior
    // whole-object assignment. The setter still accepts `null` to reset the
    // filters; the next read recreates a fresh empty `DebugConfig` on demand.
    if (this.#debugRef.current === null) {
      this.#debugRef.current = new DebugConfig(this);
    }

    return this.#debugRef.current;
  }

  // TS signature: non-sentinel callers (generic `State` reference) get the
  // `DebugConfig | object | null` surface; boolean is rejected statically.
  // The `HaltState` / `AbortState` typed aliases on the singleton exports
  // override this to `boolean | null` for the canonical sentinel access paths.
  // Runtime checks below are defensive against type-bypass / mixed-source callers.
  set debug(
    value: DebugConfig | { before?: symbol[] | readonly symbol[] | true; after?: symbol[] | readonly symbol[] | true } | null,
  ) {
    // Defensive runtime cast: TS signature excludes boolean for the generic
    // State surface, but sentinels (via the HaltState / AbortState aliases)
    // DO accept boolean, and the runtime needs to handle it for the
    // singleton paths.
    const v = value as DebugConfig | { before?: unknown; after?: unknown } | boolean | null;
    // Sentinels: only `boolean | null` is accepted. `null` aliases
    // to `false` (reset). Any object-shaped write throws at write-time so
    // misuse surfaces immediately rather than silently no-op'ing — the
    // `{before, after}` shape doesn't model anything meaningful for sentinels
    // (no own iter to anchor on; sentinels are terminal).
    if (this.isSentinel) {
      if (v === null || typeof v === 'boolean') {
        this.#sentinelDebug = v === true;
        return;
      }

      const label = this.isHalt ? 'haltState' : this.isAbort ? 'abortState' : this.name;

      throw new Error(
        `${label}.debug only accepts boolean (or null to reset). Use `
        + `\`${label}.debug = true\` to enable the ${label} breakpoint, false to `
        + 'disable it.',
      );
    }

    // Non-sentinel states: boolean writes are rejected — the per-side
    // `{before, after}` granularity is the contract. A boolean shortcut
    // would hide the asymmetry between before / after.
    if (typeof v === 'boolean') {
      throw new Error(
        'Boolean assignment is reserved for sentinel states (haltState / abortState).',
      );
    }

    if (v === null) {
      this.#debugRef.current = null;
      return;
    }

    if (v instanceof DebugConfig) {
      this.#debugRef.current = v;
      return;
    }

    this.#debugRef.current = new DebugConfig(this, v as { before?: symbol[] | readonly symbol[] | true; after?: symbol[] | readonly symbol[] | true });
  }

  /**
   * Add one or more tags to this State. Tags are out-of-band metadata
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
   * Remove one or more tags from this State. Untagging a tag the
   * State doesn't carry is a no-op. Chainable.
   */
  untag(...tags: string[]): this {
    for (const t of tags) {
      this.#tags.delete(t);
    }

    return this;
  }

  /**
   * Frozen snapshot of this State's current tags. The returned array
   * is `Object.freeze`d — mutating it throws in strict mode (which TS-emitted
   * code uses). Order matches insertion order of the underlying Set.
   */
  get tags(): readonly string[] {
    return Object.freeze([...this.#tags]);
  }

  /** @internal — invoked by DebugConfig setters via module-private symbol.
   *  haltState's `debug` setter rejects object writes before reaching
   *  DebugConfig, so this validator only sees non-halt states. */
  [validateDebugFilter](
    fieldName: 'before' | 'after',
    filter: readonly symbol[] | true | undefined,
  ): void {
    if (filter === undefined) return;

    if (filter === true) return;

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
  // entry exists.
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
   * to populate `MachineState.matchedTransition` — exposes which
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

  withOverriddenHaltState(overriddenHaltState: State): CallFrame {
    if (this.isAbort) {
      throw new Error(
        'abortState cannot be overridden — it is non-composable by definition; '
        + 'it punches through the call stack and terminates the run',
      );
    }

    if (overriddenHaltState instanceof State && overriddenHaltState.isAbort) {
      throw new Error(
        'abortState cannot be used as a withOverriddenHaltState continuation — '
        + 'abort never sits on the subroutine stack; transition to abortState directly',
      );
    }

    // Unwrap `this` if it's itself a CallFrame — the chain's inner overrides
    // are dead at runtime anyway (only the outermost `.wohs()`'s override is
    // pushed onto the halt-stack on entry; verified empirically). Composite
    // name reflects runtime behavior, not construction history.
    const bare = this instanceof CallFrame ? this.bare : this;

    // Memoize by (bare, override) so identical args return the same
    // instance. The cache uses WeakMaps + WeakRefs so cached frames can be
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

    const frame = new CallFrame(bare, overriddenHaltState);

    innerCache.set(overriddenHaltState, new WeakRef(frame));

    return frame;
  }

  /**
   * @internal
   *
   * Package-private getter/setter view onto this State's private fields,
   * for sibling modules in `packages/machine/src` (currently `stateGraph.ts`
   * for `toGraph` / `fromGraph`, and the planned `stateCollect.ts` for
   * `collectStates`).
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
      get bareState(): State | null { return null; },
      get overriddenHaltState(): State | null { return null; },
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
    // Route through the STATE_INTERNAL view so a CallFrame reports its bare's
    // transitions and its own override — the view delegates those to the bare
    // / the frame's #override, whereas the raw private fields on a CallFrame
    // are empty/null.
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


  /**
   * Walks the reachable State graph from `initialState` and returns a
   * serializable `Graph`. Thin delegate to `utilities/stateGraph.ts`'s
   * `toGraph` (extracted out of this class); see that module for the BFS
   * shape and v7 callable-subtree emit semantics.
   */
  static toGraph(initialState: State, tapeBlock: TapeBlock): Graph {
    return toGraphImpl(initialState, tapeBlock);
  }

  /**
   * Inverse of `toGraph`: rebuilds a State graph and a fresh TapeBlock
   * from a serialized `Graph`. Thin delegate to `utilities/stateGraph.ts`'s
   * `fromGraph` (extracted out of this class); see that module for the
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
   * `GraphTransition.id`. Thin delegate to
   * `utilities/stateGraph.ts`'s `collectStates`; see that module for
   * the alignment contract, coverage rules, and halt-singleton warning.
   */
  static collectStates(initialState: State, tapeBlock: TapeBlock): StateMap {
    return collectStatesImpl(initialState, tapeBlock);
  }
}

/**
 * Typed alias for the haltState singleton. Narrows `debug` from
 * the generic-State `DebugConfig | boolean` union to plain `boolean`,
 * giving compile-time type-safety at the singleton's call sites:
 *
 * ```ts
 * haltState.debug = true;            // ok
 * haltState.debug = false;           // ok
 * haltState.debug = { before: true } // TS error
 * const isOn = haltState.debug;      // typed `boolean`
 * ```
 *
 * Anyone holding a `State` reference that happens to BE the singleton (e.g.
 * via `state.getNextState(sym).ref === haltState`) sees the wider `State`
 * type; runtime throws guide them to the right shape. The singleton export
 * is the canonical access path.
 */
export type HaltState = State & {
  get debug(): boolean;
  set debug(value: boolean | null);
};

export const haltState: HaltState = new State(null) as HaltState;

/**
 * Typed alias for the abortState singleton. Same narrowing rationale
 * as `HaltState`: sentinel debug is a single boolean.
 */
export type AbortState = State & {
  get debug(): boolean;
  set debug(value: boolean | null);
};

reserveSentinelId(-1);
export const abortState: AbortState = new State(null, 'abort') as AbortState;

/**
 * A first-class call frame produced by `State.withOverriddenHaltState`.
 * A `CallFrame` is a `State` — `instanceof State` holds, so it flows
 * anywhere a `State` does (as a `nextState`, through `toGraph`/`fromGraph`,
 * etc.) — but it carries its own `bare` (the wrapped State) and `override`
 * (the continuation pushed onto the run-stack on entry). `instanceof
 * CallFrame` is the explicit wrapper discriminator.
 *
 * It owns no transitions of its own: lookups (`getSymbol`/`getCommand`/
 * `getNextState`/`getMatchedTransition`) and `debug` DELEGATE to the bare,
 * replacing the v6 field-aliasing (where a wrapper was a plain `State` whose
 * private `#symbolToDataMap`/`#debugRef` were physically shared with the
 * bare). `id`, `name` (composite `bare(override)`), and `tags` are its own
 * (inherited State fields) — so memoized frames sharing a bare keep
 * independent tags, and the frame is never the halt singleton
 * (fresh nonzero `#id` → `isHalt === false`).
 */
export class CallFrame extends State {
  readonly #bare: State;

  readonly #override: State;

  constructor(bare: State, override: State) {
    super(null);
    this.#bare = bare;
    this.#override = override;
    // Composite name contains `(` / `)`, which the constructor's user-facing
    // name validator rejects; the STATE_INTERNAL name setter bypasses it
    // (writes the inherited #name). `super[...]` reaches State's own view so
    // we don't recurse through this subclass's override below.
    super[STATE_INTERNAL]().name = `${bare.name}(${override.name})`;
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
    // Own id / name / tags come from the inherited State fields (via super's
    // view); bareState / overriddenHaltState / the transition map delegate to
    // #bare / #override so sibling modules (stateGraph, inspect) see the
    // frame's true shape.
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
