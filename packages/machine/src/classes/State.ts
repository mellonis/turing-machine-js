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

    state.#name = `${this.name}(${overriddenHaltState.name})`;
    state.#symbolToDataMap = this.#symbolToDataMap;
    state.#overriddenHaltState = overriddenHaltState;
    state.#debugRef = this.#debugRef;

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

  static toGraph(initialState: State, tapeBlock: TapeBlock): Graph {
    const nodes: Record<number, GraphNode> = {};
    const queue: State[] = [initialState];
    const alphabets = tapeBlock.alphabets.map((alphabet) => alphabet.symbols);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.#id in nodes) {
        continue;
      }

      const node: GraphNode = {
        id: current.#id,
        name: current.#name,
        isHalt: current.isHalt,
        transitions: [],
        overriddenHaltStateId: current.#overriddenHaltState?.id ?? null,
      };

      nodes[current.#id] = node;

      if (current.#overriddenHaltState) {
        queue.push(current.#overriddenHaltState);
      }

      for (const [sym, {command, nextState}] of current.#symbolToDataMap) {
        let target: State;

        try {
          target = nextState instanceof State ? nextState : nextState.ref;
        } catch {
          continue;
        }

        node.transitions.push({
          pattern: decodePatternDescription(sym.description, alphabets),
          command: command.tapesCommands.map((tc) => ({
            symbol: decodeWriteSymbol(tc.symbol),
            movement: decodeMovement((tc.movement as symbol).description),
          })),
          nextStateId: target.id,
        });

        queue.push(target);
      }
    }

    return {initialId: initialState.#id, alphabets, nodes};
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
