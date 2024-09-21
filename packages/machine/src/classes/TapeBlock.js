import Alphabet from './Alphabet';
import Command from './Command';
import { ifOtherSymbol } from './State';
import Tape from './Tape';
import { movements, symbolCommands } from './TapeCommand';
import Lock from './Lock';

const symbolToPatternListMapSetterKey = Symbol('symbol for symbolToPatternListMap setter');

export const lockSymbol = Symbol('capture symbol');

export default class TapeBlock {
  #lock = new Lock();

  #symbolToPatternListMap = new Map();

  #tapeList;

  constructor({ tapeList, alphabetList }) {
    if (!alphabetList && !tapeList) {
      throw new Error('invalid parameter');
    }

    if (alphabetList) {
      if (!Array.isArray(alphabetList)) {
        throw new Error('alphabetList must be an array');
      }

      if (alphabetList.length === 0) {
        throw new Error('empty alphabet list');
      }

      const notAlphabetIndex = alphabetList
        .findIndex((alphabet) => !(alphabet instanceof Alphabet));

      if (notAlphabetIndex >= 0) {
        throw new Error('invalid alphabet');
      }

      this.#tapeList = alphabetList.map((alphabet) => new Tape({
        alphabet,
      }));
    } else {
      this.#tapeList = tapeList;
    }

    if (!Array.isArray(this.#tapeList)) {
      throw new Error('tapeList must be an array');
    }

    if (this.#tapeList.length === 0) {
      throw new Error('empty tape list');
    }

    const notTapeIndex = this.#tapeList.findIndex((tape) => !(tape instanceof Tape));

    if (notTapeIndex >= 0) {
      throw new Error('invalid tape');
    }
  }

  get [lockSymbol]() {
    return this.#lock;
  }

  get alphabetList() {
    return [...this.#tapeList.map((tape) => tape.alphabet)];
  }

  get currentSymbolList() {
    return this.#tapeList.map((tape) => tape.symbol);
  }

  get symbol() {
    return this.#symbol.bind(this);
  }

  get tapeList() {
    return [...this.#tapeList];
  }

  set [symbolToPatternListMapSetterKey](symbolToPatternListMap) {
    this.#symbolToPatternListMap = new Map(symbolToPatternListMap);
  }

  static #generateSymbolHint = (patternList) => JSON.stringify(
    patternList
      .map((pattern) => pattern
        .map((symbol) => (symbol === ifOtherSymbol ? null : symbol))),
  )

  applyCommand(command, executionSymbol = null) {
    this.#lock.check(executionSymbol);

    if (!(command instanceof Command)) {
      throw new Error('invalid command');
    }

    if (this.#tapeList.length !== command.tapeCommandList.length) {
      throw new Error('invalid command');
    }

    this.#tapeList.forEach((tape, ix) => {
      const { movement, symbol } = command.tapeCommandList[ix];

      switch (symbol) {
        case symbolCommands.keep:
          break;
        case symbolCommands.erase:
          // eslint-disable-next-line no-param-reassign
          tape.symbol = tape.alphabet.blankSymbol;
          break;
        default:
          // eslint-disable-next-line no-param-reassign
          tape.symbol = symbol;
          break;
      }

      // eslint-disable-next-line default-case
      switch (movement) {
        case movements.left:
          tape.left();
          break;
        case movements.stay:
          break;
        case movements.right:
          tape.right();
          break;
      }
    });
  }

  clone(cloneTapes = false) {
    let tapeBlock;

    if (cloneTapes) {
      tapeBlock = new TapeBlock({
        tapeList: this.tapeList.map((tape) => new Tape(tape)),
      });
    } else {
      tapeBlock = new TapeBlock({
        alphabetList: this.alphabetList,
      });
    }

    tapeBlock[symbolToPatternListMapSetterKey] = this.#symbolToPatternListMap;

    return tapeBlock;
  }

  isMatched({
    currentSymbolList = this.currentSymbolList,
    symbol,
  }) {
    if (symbol === ifOtherSymbol) {
      return true;
    }

    if (typeof symbol !== 'symbol') {
      throw new Error('invalid symbol');
    }

    if (!this.#symbolToPatternListMap.has(symbol)) {
      throw new Error('invalid symbol');
    }

    const patternList = this.#symbolToPatternListMap.get(symbol);

    return patternList.some((pattern) => (
      pattern
        .every((everySymbol, ix) => (
          everySymbol === ifOtherSymbol
          || everySymbol === currentSymbolList[ix]
        ))
    ));
  }

  replaceTape(tape, tapeIx = 0) {
    if (!(tape instanceof Tape)) {
      throw new Error('invalid tape');
    }

    if (this.#tapeList[tapeIx] == null) {
      throw new Error('invalid tapeIx');
    }

    if (tape.alphabet.symbolList.join('') === this.#tapeList[tapeIx].alphabet.symbolList.join('')) {
      this.#tapeList[tapeIx] = tape;
    } else {
      throw new Error('invalid tape');
    }
  }

  #buildPatternList = (symbolList) => symbolList.reduce((result, symbol, ix) => {
    const row = Math.floor(ix / this.#tapeList.length);

    if (!Array.isArray(result[row])) {
      // eslint-disable-next-line no-param-reassign
      result[row] = [];
    }

    result[row].push(symbol);

    return result;
  }, [])
    .filter((pattern, ix, patternList) => {
      const samePatternIx = patternList.findIndex((otherPattern) => (
        pattern
          .every((symbol, symbolIx) => symbol === otherPattern[symbolIx])
      ));

      return samePatternIx === ix;
    });

  #getSymbolForPatternList = (patternList) => {
    if (patternList.some((pattern) => pattern.every((symbol) => symbol === ifOtherSymbol))) {
      return ifOtherSymbol;
    }

    const [storedPatternListSymbol] = [...this.#symbolToPatternListMap.entries()]
      .find(([, storedPatternList]) => {
        if (storedPatternList.length !== patternList.length) {
          return false;
        }

        return patternList
          .every((pattern, patternIx) => pattern
            .every((symbol, symbolIx) => symbol === storedPatternList[patternIx][symbolIx]));
      }) || [null, null];

    let symbol;

    if (storedPatternListSymbol) {
      symbol = storedPatternListSymbol;
    } else {
      symbol = Symbol(TapeBlock.#generateSymbolHint(patternList));

      this.#symbolToPatternListMap.set(symbol, patternList);
    }

    return symbol;
  }

  #symbol = (symbols) => {
    let symbolList;

    if (symbols === ifOtherSymbol) {
      return ifOtherSymbol;
    }

    if (typeof symbols === 'string') {
      symbolList = symbols.split('');
    } else if (Array.isArray(symbols)) {
      symbolList = [...symbols];
    }

    if (!Array.isArray(symbolList)) {
      throw new Error('invalid symbol parameter');
    }

    if (symbolList.length === 0 || symbolList.length % this.#tapeList.length > 0) {
      throw new Error('invalid symbol parameter');
    }

    const invalidSymbolIndex = symbolList.findIndex((symbol, ix) => (
      symbol !== ifOtherSymbol
      && !this.#tapeList[ix % this.#tapeList.length].alphabet.has(symbol)
    ));

    if (invalidSymbolIndex >= 0) {
      throw new Error('invalid symbol parameter');
    }

    if (symbolList.every((symbol) => symbol === ifOtherSymbol)) {
      return ifOtherSymbol;
    }

    return this.#getSymbolForPatternList(this.#buildPatternList(symbolList));
  }
}
