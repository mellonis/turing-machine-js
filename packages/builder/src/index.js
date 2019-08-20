import TuringMachine, {
  Alphabet,
  haltState, movements,
  Reference,
  State, symbolCommands,
  TapeBlock,
} from '@turing-machine-js/machine';

const movementsMap = {
  L: movements.left,
  R: movements.right,
  S: movements.stay,
};

const referenceKey = Symbol('reference');
const stateKey = Symbol('state');

export default function buildMachine({
  alphabetString,
  initialState,
  finalStateList,
  states: stateDeclarations,
}) {
  const alphabet = new Alphabet({
    symbolList: alphabetString.split(''),
  });
  const machine = new TuringMachine({
    tapeBlock: new TapeBlock({
      alphabetList: [alphabet],
    }),
  });

  const { symbol: getSymbol } = machine.tapeBlock;

  let states = finalStateList.reduce((result, finalState) => ({
    ...result,
    [finalState]: {
      [stateKey]: haltState,
      [referenceKey]: haltState,
    },
  }), {});

  Object.keys(stateDeclarations).forEach((stateName) => {
    if (stateDeclarations[stateName] != null) {
      states[stateName] = {
        [referenceKey]: new Reference(),
      };
    }
  });

  Object.keys(stateDeclarations).forEach((stateName) => {
    if (stateDeclarations[stateName] != null) {
      const stateDefinition = {};

      Object.keys(stateDeclarations[stateName]).forEach((symbol) => {
        if (!alphabet.has(symbol)) {
          throw new Error('invalid state declaration');
        }

        let nextSymbol = stateDeclarations[stateName][symbol].symbol;

        if (nextSymbol === symbol) {
          nextSymbol = symbolCommands.keep;
        }

        if (nextSymbol === alphabet.blankSymbol) {
          nextSymbol = symbolCommands.erase;
        }

        const nextMovement = movementsMap[stateDeclarations[stateName][symbol].movement];

        if (!nextMovement) {
          throw new Error('invalid state declaration');
        }

        const nextState = states[stateDeclarations[stateName][symbol].state][referenceKey];

        stateDefinition[getSymbol([symbol])] = {
          command: {
            symbol: nextSymbol,
            movement: nextMovement,
          },
          nextState,
        };
      });

      const state = new State(stateDefinition);

      state.name = stateName;

      states[stateName][stateKey] = state;
      states[stateName][referenceKey].bind(state);
    }
  });

  states = Object.keys(states).reduce((result, stateName) => ({
    ...result,
    [stateName]: states[stateName][stateKey],
  }), {});

  return [
    machine,
    states[initialState],
    states,
  ];
}
