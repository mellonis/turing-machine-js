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
    // Construct with no name, then overwrite #name directly — the composed
    // name contains `(` and `)` by design, which the constructor's user-facing
    // validation would reject. Internal composition bypasses validation via
    // private-field access (legal within the same class).
    const state = new State();

    // Unwrap `this` if it's itself a wrapper — the chain's inner overrides
    // are dead at runtime anyway (only the outermost `.wohs()`'s override is
    // pushed onto the halt-stack on entry; verified empirically). Composite
    // name reflects runtime behavior, not construction history. See #176.
    const bare = this.#bareState ?? this;

    state.#name = `${bare.name}(${overriddenHaltState.name})`;
    state.#symbolToDataMap = bare.#symbolToDataMap;
    state.#overriddenHaltState = overriddenHaltState;
    state.#debugRef = bare.#debugRef;
    state.#bareState = bare;

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

  // Walks the State graph and emits a `Graph` data structure. v7 emit shape:
  // wrapper-States (those with `#overriddenHaltState !== null`) are collapsed
  // onto their bare's representation in the graph, with the wrapper's own `#id`
  // used as the graph node id, `isWrapped: true`, and `overriddenHaltStateId`
  // set to the override's collapsed id. A per-wrapper "halt marker" graph node
  // (id = negative-of-the-wrapper-id, `isHalt: true, isHaltMarker: true`) is
  // synthesized; the bare's halt-bound transitions are rewritten to target the
  // halt marker instead of the real one.
  //
  // Halt-marker node ids use the negation of the wrapper's id so they sit in a
  // disjoint integer range from real ids (which are always non-negative). Real
  // halt is always id 0.
  static toGraph(initialState: State, tapeBlock: TapeBlock): Graph {
    const nodes: Record<number, GraphNode> = {};
    const alphabets = tapeBlock.alphabets.map((alphabet) => alphabet.symbols);

    // Map from a wrapper-State to the "collapsed" graph node id used to refer
    // to it in transitions. Same as the wrapper's `#id`, recorded for clarity
    // when rewriting transition targets.
    const wrapperGraphId = (s: State): number => s.#id;
    const haltMarkerIdFor = (wrapper: State): number => -wrapper.#id;

    // The `initialId` is the user-passed start. If it's a wrapper, the
    // collapsed graph node uses its `#id`; otherwise its own `#id`.
    const initialId = initialState.#id;

    type QueueItem = {
      // The State instance to process at this slot.
      state: State;
      // When non-null, the State is being processed AS the bare of this wrapper.
      // The collapsed graph node uses `wrapperGraphId(wrapperContext)`,
      // halt-bound transitions retarget to `haltMarkerIdFor(wrapperContext)`,
      // self-loop transitions to the bare retarget to the wrapper-id.
      wrapperContext: State | null;
    };

    const queue: QueueItem[] = [];

    // Decide how to enqueue the start: if it's a wrapper, enqueue its bare with
    // the wrapper as context; otherwise enqueue the state itself.
    if (initialState.#overriddenHaltState && initialState.#bareState) {
      queue.push({state: initialState.#bareState, wrapperContext: initialState});
    } else {
      queue.push({state: initialState, wrapperContext: null});
    }

    while (queue.length > 0) {
      const {state, wrapperContext} = queue.shift()!;

      if (state.isHalt) {
        // Real halt — always id 0, single node.
        if (!(0 in nodes)) {
          nodes[0] = {
            id: 0,
            name: state.#name,
            isHalt: true,
            isHaltMarker: false,
            isWrapped: false,
            transitions: [],
            overriddenHaltStateId: null,
          };
        }

        continue;
      }

      if (wrapperContext !== null) {
        // Process `state` (the bare) collapsed under `wrapperContext` (the
        // wrapper). Graph node id = wrapper's id.
        const collapsedId = wrapperGraphId(wrapperContext);

        if (collapsedId in nodes) {
          continue;
        }

        const haltMarkerId = haltMarkerIdFor(wrapperContext);
        const overrideTarget = wrapperContext.#overriddenHaltState!;

        // The override target's collapsed id: if the override is itself a
        // wrapper, its graph node id is `overrideTarget.#id` (its own wrapper
        // id); otherwise its own bare id.
        const overrideGraphId = overrideTarget.#overriddenHaltState
          ? wrapperGraphId(overrideTarget)
          : overrideTarget.#id;

        // Emit the halt-marker node if not already present (one per wrapper).
        if (!(haltMarkerId in nodes)) {
          nodes[haltMarkerId] = {
            id: haltMarkerId,
            name: 'halt',
            isHalt: true,
            isHaltMarker: true,
            isWrapped: false,
            transitions: [],
            overriddenHaltStateId: null,
          };
        }

        // Build the collapsed node.
        const collapsedNode: GraphNode = {
          id: collapsedId,
          name: state.#name,
          isHalt: false,
          isHaltMarker: false,
          isWrapped: true,
          transitions: [],
          overriddenHaltStateId: overrideGraphId,
        };

        nodes[collapsedId] = collapsedNode;

        let patternIx = 0;

        for (const [sym, {command, nextState}] of state.#symbolToDataMap) {
          let target: State;

          try {
            target = nextState instanceof State ? nextState : nextState.ref;
          } catch {
            patternIx += 1;
            continue;
          }

          // Retarget transitions per Variant X conventions:
          // - target == haltState → halt marker (stays inside the subgraph)
          // - target == bare (self-loop) → the collapsed wrapper id
          // - target is itself a wrapper → that wrapper's collapsed id
          // - else → target's own id
          let nextStateId: number;

          if (target.isHalt) {
            nextStateId = haltMarkerId;
          } else if (target === state) {
            nextStateId = collapsedId;
          } else if (target.#overriddenHaltState && target.#bareState) {
            nextStateId = wrapperGraphId(target);
            queue.push({state: target.#bareState, wrapperContext: target});
          } else {
            nextStateId = target.#id;
            queue.push({state: target, wrapperContext: null});
          }

          collapsedNode.transitions.push({
            pattern: decodePatternDescription(sym.description, alphabets),
            command: command.tapesCommands.map((tc) => ({
              symbol: decodeWriteSymbol(tc.symbol),
              movement: decodeMovement((tc.movement as symbol).description),
            })),
            nextStateId,
            id: `${collapsedId}-${patternIx}`,
          });

          patternIx += 1;
        }

        // Enqueue the override target so its own node is emitted.
        if (overrideTarget.#overriddenHaltState && overrideTarget.#bareState) {
          queue.push({state: overrideTarget.#bareState, wrapperContext: overrideTarget});
        } else {
          queue.push({state: overrideTarget, wrapperContext: null});
        }

        continue;
      }

      // Non-wrapper context: emit `state` as a regular node.
      if (state.#id in nodes) {
        continue;
      }

      const node: GraphNode = {
        id: state.#id,
        name: state.#name,
        isHalt: false,
        isHaltMarker: false,
        isWrapped: false,
        transitions: [],
        overriddenHaltStateId: null,
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

        let nextStateId: number;

        if (target.#overriddenHaltState && target.#bareState) {
          // Transition into a wrapper — use its collapsed id.
          nextStateId = wrapperGraphId(target);
          queue.push({state: target.#bareState, wrapperContext: target});
        } else {
          nextStateId = target.#id;
          queue.push({state: target, wrapperContext: null});
        }

        node.transitions.push({
          pattern: decodePatternDescription(sym.description, alphabets),
          command: command.tapesCommands.map((tc) => ({
            symbol: decodeWriteSymbol(tc.symbol),
            movement: decodeMovement((tc.movement as symbol).description),
          })),
          nextStateId,
          id: `${state.#id}-${patternIx}`,
        });

        patternIx += 1;
      }
    }

    return {initialId, alphabets, nodes};
  }

  // Inverse of toGraph: rebuilds a State graph (and a fresh TapeBlock with the
  // graph's alphabets) from a serialized Graph. Round-trips with toGraph in
  // the sense that running the rebuilt machine on the same input gives the
  // same output, but the rebuilt State instances have *new* internal IDs.
  static fromGraph(graph: Graph): {
    start: State;
    tapeBlock: TapeBlock;
    states: Record<number, State>;
  } {
    const alphabetObjs = graph.alphabets.map((syms) => new Alphabet(syms));
    const tapeBlock = TapeBlock.fromAlphabets(alphabetObjs);
    const ids = Object.keys(graph.nodes).map(Number);

    // Pass 1: pre-create a Reference for each non-halt node so transitions can
    // forward-declare their targets.
    const refs: Record<number, Reference> = {};

    for (const nodeId of ids) {
      if (!graph.nodes[nodeId].isHalt) {
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

    // Pass 2: build a "bare" State for each non-halt node (no override yet).
    // nextState entries point at refs so cycles work; haltState is used directly.
    const bareStates: Record<number, State> = {};

    for (const nodeId of ids) {
      const node = graph.nodes[nodeId];

      if (node.isHalt) {
        continue;
      }

      const stateDefinition: ConstructorParameters<typeof State>[0] = {};

      for (const t of node.transitions) {
        const key = patternToKey(parsePatternString(t.pattern, graph.alphabets));
        const target = graph.nodes[t.nextStateId];
        const nextState: State | Reference = target.isHalt ? haltState : refs[t.nextStateId];

        stateDefinition![key] = {
          command: t.command.map((c) => ({
            symbol: parseWriteSymbolLabel(c.symbol),
            movement: parseMovementLabel(c.movement),
          })) as ConstructorParameters<typeof TapeCommand>[0][],
          nextState,
        };
      }

      // Graph-sourced names may contain `(` and `)` (composite wrapper names
      // emitted by toGraph). Bypass the constructor's user-facing name
      // validation by constructing without a name and assigning #name directly.
      const bare = new State(stateDefinition);

      bare.#name = node.name;
      bareStates[nodeId] = bare;
    }

    // Pass 3: apply overrideHaltStates transitively.
    const finalStates: Record<number, State> = {};
    const inProgress = new Set<number>();

    const getFinal = (nodeId: number): State => {
      if (finalStates[nodeId]) {
        return finalStates[nodeId];
      }

      const node = graph.nodes[nodeId];

      if (node.isHalt) {
        finalStates[nodeId] = haltState;

        return haltState;
      }

      if (inProgress.has(nodeId)) {
        throw new Error(`override-halt cycle at state #${nodeId}`);
      }

      inProgress.add(nodeId);

      let state = bareStates[nodeId];

      if (node.overriddenHaltStateId !== null) {
        state = bareStates[nodeId].withOverriddenHaltState(getFinal(node.overriddenHaltStateId));
      }

      inProgress.delete(nodeId);
      finalStates[nodeId] = state;

      return state;
    };

    for (const nodeId of ids) {
      getFinal(nodeId);
    }

    // Pass 4: bind each ref to the FINAL (possibly wrapped) state so transitions
    // resolve to the version that has its override-halt set.
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
