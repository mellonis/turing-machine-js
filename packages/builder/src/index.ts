import {
  Alphabet,
  haltState,
  movements,
  Reference,
  State,
  symbolCommands,
  TapeBlock,
  TuringMachine,
} from '@turing-machine-js/machine';

const movementsMap: Record<'L' | 'R' | 'S', symbol> = {
  L: movements.left,
  R: movements.right,
  S: movements.stay,
};

const referenceKey = Symbol('reference');
const stateKey = Symbol('state');

export type States = Record<string, Record<string, {
  symbol: string,
  movement: keyof typeof movementsMap,
  state: string,
}>>;

/**
 * Per-state breakpoint config for the declarative builder. Filter values are
 * raw alphabet characters (matching the input-symbol notation in `states`);
 * the builder translates each to a `tapeBlock.symbol([char])`-interned
 * Symbol at construction time. `true` is the wildcard.
 *
 * Out of scope: final-state entries — `finalStateList` names map to
 * `haltState`, which is not a state in the table. Pass `before` / `after`
 * directly on `haltState.debug` if you need to pause on halt entry.
 */
export type DebugConfigByState = Record<string, {
  before?: true | string[];
  after?: true | string[];
}>;

type StatesQq = Record<string, {
  [stateKey]?: State;
  [referenceKey]?: Reference;
}>

export default function buildMachine({
                                       alphabetString,
                                       initialState,
                                       finalStateList,
                                       states: stateNameToStateDeclarationMap,
                                       debug,
                                     }: {
  alphabetString: string;
  initialState: string;
  finalStateList: string[];
  states: States;
  debug?: DebugConfigByState;
}) {
  const alphabet = new Alphabet(alphabetString.split(''));
  const machine = new TuringMachine({
    tapeBlock: TapeBlock.fromAlphabets([alphabet]),
  });

  const {symbol: getSymbol} = machine.tapeBlock;

  const stateNameToStateOrReferenceMap: StatesQq = finalStateList.reduce((result, finalState) => ({
    ...result,
    [finalState]: {
      [stateKey]: haltState,
      [referenceKey]: haltState,
    },
  }), {});

  Object.keys(stateNameToStateDeclarationMap).forEach((stateName) => {
    if (stateNameToStateDeclarationMap[stateName] != null) {
      stateNameToStateOrReferenceMap[stateName] = {
        [referenceKey]: new Reference(),
      };
    }
  });

  Object.keys(stateNameToStateDeclarationMap).forEach((stateName) => {
    const stateDefinition: ConstructorParameters<typeof State>[0] = {};

    Object.entries(stateNameToStateDeclarationMap[stateName]).forEach(([symbol, stateDeclaration]) => {
      if (!alphabet.has(symbol)) {
        throw new Error('invalid state declaration');
      }

      let nextSymbol: symbol | string = stateDeclaration.symbol;

      if (nextSymbol === symbol) {
        nextSymbol = symbolCommands.keep;
      }

      if (nextSymbol === alphabet.blankSymbol) {
        nextSymbol = symbolCommands.erase;
      }

      const nextMovement = movementsMap[stateDeclaration.movement];

      if (!nextMovement) {
        throw new Error('invalid state declaration');
      }

      const nextState = stateNameToStateOrReferenceMap[stateDeclaration.state][referenceKey]!;

      stateDefinition[getSymbol([symbol])] = {
        command: {
          symbol: nextSymbol,
          movement: nextMovement,
        },
        nextState,
      };
    });

    const state = new State(stateDefinition, stateName);

    Object.assign(stateNameToStateOrReferenceMap[stateName], {
      [stateKey]: state,
      [referenceKey]: stateNameToStateOrReferenceMap[stateName][referenceKey]?.bind(state),
    })
  });

  const resultStates: Record<string, State> = Object.entries(stateNameToStateOrReferenceMap)
    .reduce((result, [stateName, stateOrReference]) => ({
      ...result,
      [stateName]: stateOrReference[stateKey],
    }), {});

  // Apply per-state debug config. Filter values are raw alphabet
  // characters; translate each via tapeBlock.symbol([char]) so they match
  // the same interned Symbol used in transitions. `true` passes through
  // as-is (wildcard). final-state names are rejected — they alias to
  // haltState which is out of scope by design.
  if (debug) {
    Object.entries(debug).forEach(([stateName, config]) => {
      if (finalStateList.includes(stateName)) {
        throw new Error(
          `debug cannot be set on final state '${stateName}': finalStateList `
          + 'entries map to haltState, which is out of scope for the builder. '
          + 'Set haltState.debug directly on the imported singleton if needed.',
        );
      }

      const state = resultStates[stateName];

      if (!state) {
        throw new Error(`debug references unknown state '${stateName}'`);
      }

      const translateFilter = (
        f: true | string[] | undefined,
      ): true | symbol[] | undefined => {
        if (f === undefined) return undefined;
        if (f === true) return true;

        return f.map((c) => {
          if (!alphabet.has(c)) {
            throw new Error(
              `debug filter symbol '${c}' for state '${stateName}' is not in the alphabet`,
            );
          }

          return getSymbol([c]);
        });
      };

      state.debug = {
        before: translateFilter(config.before),
        after: translateFilter(config.after),
      };
    });
  }

  return [
    machine,
    resultStates[initialState],
    resultStates,
  ] as const;
}
