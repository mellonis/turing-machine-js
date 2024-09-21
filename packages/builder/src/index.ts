import {
  Alphabet,
  haltState,
  movements,
  Reference,
  State,
  symbolCommands,
  TapeBlock,
  TuringMachine,
} from '@turing-machine-js/machine/src';

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
type StatesQq = Record<string, {
  [stateKey]?: State;
  [referenceKey]?: Reference;
}>

export default function buildMachine({
                                       alphabetString,
                                       initialState,
                                       finalStateList,
                                       states: stateNameToStateDeclarationMap,
                                     }: {
  alphabetString: string;
  initialState: string;
  finalStateList: string[];
  states: States;
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

  return [
    machine,
    resultStates[initialState],
    resultStates,
  ] as const;
}
