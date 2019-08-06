import Alphabet from './Alphabet';
import { ifOtherSymbol } from './State';
import Tape from './Tape';
import { movements, symbolCommands } from './TapeCommand';
import { uniquePredicate } from '../utilities/functions';

export default class TapeBlock {
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

      const notAlphabetIndex = alphabetList.findIndex(alphabet => !(alphabet instanceof Alphabet));

      if (notAlphabetIndex >= 0) {
        throw new Error('invalid alphabet');
      }

      this.#tapeList = alphabetList.map(alphabet => new Tape({
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

    const notTapeIndex = this.#tapeList.findIndex(tape => !(tape instanceof Tape));

    if (notTapeIndex >= 0) {
      throw new Error('invalid tape');
    }
  }

  get currentSymbolList() {
    return this.#tapeList.map(tape => tape.symbol);
  }

  get symbol() {
    return this.#symbol.bind(this);
  }

  get tapeList() {
    return [...this.#tapeList];
  }

  applyCommand(command) {
    if (this.#tapeList.length !== command.tapeCommandList.length) {
      throw new Error('invalid command');
    }

    this.#tapeList.forEach((tape, ix) => {
      const { movement, symbol } = command.tapeCommandList[ix];

      switch (symbol) {
        case symbolCommands.keep:
          break;
        case symbolCommands.erase:
          tape.symbol = tape.alphabet.blankSymbol;
          break;
        default:
          tape.symbol = symbol;
          break;
      }

      switch (movement) {
        case movements.left:
          tape.left();
          break;
        case movements.stay:
          break;
        case movements.right:
          tape.right();
          break;
        default:
          throw new Error('invalid tape movement');
      }
    });
  }

  isMatched({
    currentSymbolList = this.currentSymbolList,
    symbol
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

    return patternList.some(pattern => currentSymbolList.join('') === pattern);
  }

  replaceTape(tape, tapeIx = 0) {
    if (this.#tapeList[tapeIx] == null) {
      throw new Error('invalid tapeIx');
    }

    if (tape.alphabet.symbolList === this.#tapeList[tapeIx].alphabet.symbolList) {
      this.#tapeList[tapeIx] = tape;
    }
  }

  #buildPatternList(symbolList) {
    return symbolList.reduce((result, symbol, ix) => {
      const row = Math.floor(ix / this.#tapeList.length);

      if (!Array.isArray(result[row])) {
        result[row] = [];
      }

      result[row].push(symbol);

      if (ix % this.#tapeList.length + 1 === this.#tapeList.length) {
        result[row] = result[row].join('');
      }

      return result;
    }, [])
      .filter(uniquePredicate)
      .sort();
  }

  #getSymbolForPatternList(patternList) {
    const [storedPatternListSymbol] = [...this.#symbolToPatternListMap.entries()].find(([_, storedPatternList]) => {
      if (storedPatternList.length !== patternList.length) {
        return false;
      }

      return patternList.every((pattern, ix) => pattern ===storedPatternList[ix]);
    }) || [null, null];

    let symbol;

    if (storedPatternListSymbol) {
      symbol = storedPatternListSymbol;
    } else {
      symbol = Symbol();

      this.#symbolToPatternListMap.set(symbol, patternList);
    }

    return symbol;
  }

  #symbol(symbols) {
    let symbolList;

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

    const invalidSymbolIndex = symbolList.findIndex((symbol, ix) => !this.#tapeList[ix % this.#tapeList.length].alphabet.has(symbol));

    if (invalidSymbolIndex >= 0) {
      throw new Error('invalid symbol parameter');
    }

    return this.#getSymbolForPatternList(this.#buildPatternList(symbolList));
  }
}
