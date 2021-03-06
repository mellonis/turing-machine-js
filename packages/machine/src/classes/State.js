import { id } from '../utilities/functions';
import Command from './Command';
import Reference from './Reference';
import TapeCommand from './TapeCommand';

export const ifOtherSymbol = Symbol('other symbol');

export default class State {
  #id = id(this);

  #overrodeHaltState;

  #symbolToDataMap = new Map();

  constructor(stateDefinition = null) {
    if (stateDefinition) {
      const keyList = Object.getOwnPropertyNames(stateDefinition);

      if (keyList.length) {
        throw new Error(`invalid state definition while constructing state #${this.#id}`);
      }

      const symbolList = Object.getOwnPropertySymbols(stateDefinition);

      if (symbolList.length === 0) {
        throw new Error(`invalid state definition while constructing state #${this.#id}`);
      }

      symbolList.forEach((symbol) => {
        let { command, nextState } = stateDefinition[symbol];

        if (command == null) {
          command = new Command([
            new TapeCommand({}),
          ]);
        }

        if (!(command instanceof Command) && !Array.isArray(command)) {
          command = [command];
        }

        if (Array.isArray(command)) {
          try {
            command = new Command(command);
          } catch (e) {
            // ignore error
          }
        }

        if (!(command instanceof Command)) {
          throw new Error('invalid command');
        }

        if (nextState == null) {
          nextState = this;
        }

        if (!(nextState instanceof State) && !(nextState instanceof Reference)) {
          throw new Error('invalid nextState');
        }

        this.#symbolToDataMap.set(symbol, {
          command,
          nextState,
        });
      });
    }
  }

  get id() {
    return this.#id;
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

  getSymbol(tapeBlock) {
    const symbol = [...this.#symbolToDataMap.keys()].find((currentSymbol) => tapeBlock.isMatched({
      symbol: currentSymbol,
    }));

    if (symbol) {
      return symbol;
    }

    return ifOtherSymbol;
  }

  getCommand(symbol) {
    if (this.#symbolToDataMap.has(symbol)) {
      return this.#symbolToDataMap.get(symbol).command;
    }

    throw new Error(`No command for symbol at state named ${this.#id}`);
  }

  getNextState(symbol) {
    if (this.#symbolToDataMap.has(symbol)) {
      return this.#symbolToDataMap.get(symbol).nextState;
    }

    throw new Error(`No nextState for symbol at state named ${this.#id}`);
  }

  withOverrodeHaltState(overrodeHaltState) {
    const state = new State(null);

    state.#symbolToDataMap = this.#symbolToDataMap;
    state.#overrodeHaltState = overrodeHaltState;
    state.#id = `${this.#id}>${overrodeHaltState.#id}`;

    return state;
  }
}

export const haltState = new State(null);
