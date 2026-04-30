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

export default class State {
  readonly #id: number = id(this);

  readonly #name: string;

  #overrodeHaltState: State | null = null;

  #symbolToDataMap = new Map<symbol, { command: Command, nextState: State | Reference }>();

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

  get overrodeHaltState() {
    return this.#overrodeHaltState;
  }

  get ref() {
    return this;
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

  withOverrodeHaltState(overrodeHaltState: State) {
    const state = new State(null, `${this.name}>${overrodeHaltState.name}`);

    state.#symbolToDataMap = this.#symbolToDataMap;
    state.#overrodeHaltState = overrodeHaltState;

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
    overrodeHaltState: { id: number; name: string } | null;
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
      overrodeHaltState: state.#overrodeHaltState
        ? {id: state.#overrodeHaltState.id, name: state.#overrodeHaltState.name}
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
        overrodeHaltStateId: current.#overrodeHaltState?.id ?? null,
      };

      nodes[current.#id] = node;

      if (current.#overrodeHaltState) {
        queue.push(current.#overrodeHaltState);
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

      bareStates[nodeId] = new State(stateDefinition, node.name);
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

      if (node.overrodeHaltStateId !== null) {
        state = bareStates[nodeId].withOverrodeHaltState(getFinal(node.overrodeHaltStateId));
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
