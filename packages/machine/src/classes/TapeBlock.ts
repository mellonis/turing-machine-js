import Alphabet from './Alphabet';
import Command from './Command';
import Tape from './Tape';
import {ifOtherSymbol} from './State';
import {movements, symbolCommands} from './TapeCommand';

const symbolToPatternListMapSymbol = Symbol('symbol for symbolToPatternListMap setter');

type TapeBlockConstructorParam = { alphabets: Alphabet[] } | { tapes: Tape[] };
type PatternList = (string | symbol)[][];
type SymbolToPatternListMap = Map<symbol, PatternList>;

export default class TapeBlock {
  #symbolToPatternListMap: SymbolToPatternListMap = new Map();
  readonly #tapes: Tape[];

  static #generateSymbolHint = (patternList: PatternList) => JSON.stringify(
    patternList
      .map((pattern) => pattern
        .map((symbol) => (symbol === ifOtherSymbol ? null : symbol))),
  );

  static fromAlphabets = (alphabets: Alphabet[]) => {
    return new TapeBlock({alphabets})
  }

  static fromTapes = (tapes: Tape[]) => {
    return new TapeBlock({tapes});
  }

  private constructor(argument: TapeBlockConstructorParam) {
    this.#tapes = [];

    if ('alphabets' in argument) {
      const {alphabets} = argument;

      if (alphabets.length === 0) {
        throw new Error('empty alphabet list');
      }

      this.#tapes = alphabets.map((alphabet) => new Tape({
        alphabet,
      }));
    } else if ('tapes' in argument) {
      this.#tapes = argument.tapes;
    }

    if (this.#tapes.length === 0) {
      throw new Error('empty tape list');
    }
  }

  get alphabets() {
    return [...this.#tapes.map((tape) => tape.alphabet)];
  }

  get currentSymbols() {
    return this.#tapes.map((tape) => tape.symbol);
  }

  get symbol() {
    return this.#symbol.bind(this);
  }

  get tapes() {
    return [...this.#tapes];
  }

  applyCommand(command: Command): void {
    if (this.#tapes.length !== command.tapesCommands.length) {
      throw new Error('invalid command');
    }

    this.#tapes.forEach((tape, ix) => {
      const {movement, symbol} = command.tapesCommands[ix];

      if (typeof symbol === 'string') {
        tape.symbol = symbol;
      }

      if (typeof symbol === 'symbol') {
        switch (symbol) {
          case symbolCommands.keep:
            break;
          case symbolCommands.erase:
            tape.symbol = tape.alphabet.blankSymbol;
            break;
          // no default
        }
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
        // no default
      }
    });
  }

  clone(cloneTapes = false): TapeBlock {
    let tapeBlock;

    if (cloneTapes) {
      tapeBlock = TapeBlock.fromTapes(this.tapes.map((tape) => new Tape(tape)));
    } else {
      tapeBlock = TapeBlock.fromAlphabets(this.alphabets);
    }

    tapeBlock[symbolToPatternListMapSymbol](this.#symbolToPatternListMap);

    return tapeBlock;
  }

  isMatched({
              currentSymbols = this.currentSymbols,
              symbol
            }: { currentSymbols?: string[], symbol: symbol }): boolean {
    if (symbol === ifOtherSymbol) {
      return true;
    }

    if (!this.#symbolToPatternListMap.has(symbol)) {
      throw new Error('invalid symbol');
    }

    const patternList = this.#symbolToPatternListMap.get(symbol);

    return patternList?.some((pattern) => (
      pattern
        .every((everySymbol, ix) => (
          everySymbol === ifOtherSymbol
          || everySymbol === currentSymbols[ix]
        ))
    )) ?? false;
  }

  replaceTape(tape: Tape, tapeIx = 0) {
    if (this.#tapes[tapeIx] == null) {
      throw new Error('invalid tapeIx');
    }

    if (tape.alphabet.symbols.join('') === this.#tapes[tapeIx].alphabet.symbols.join('')) {
      this.#tapes[tapeIx] = tape;
    } else {
      throw new Error('invalid tape');
    }
  }

  [symbolToPatternListMapSymbol] = (symbolToPatternListMap: SymbolToPatternListMap) => {
    this.#symbolToPatternListMap = new Map(symbolToPatternListMap);
  };

  #buildPatternList = (symbolList: (symbol | string)[]) => symbolList.reduce((result, symbol, ix) => {
    const row = Math.floor(ix / this.#tapes.length);

    if (!Array.isArray(result[row])) {
      result[row] = [];
    }

    result[row].push(symbol);

    return result;
  }, [] as PatternList)
    .filter((pattern, ix, patternList) => {
      const samePatternIx = patternList.findIndex((otherPattern) => (
        pattern
          .every((symbol, symbolIx) => symbol === otherPattern[symbolIx])
      ));

      return samePatternIx === ix;
    });

  #getSymbolForPatternList = (patternList: PatternList) => {
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
  };

  #symbol = (symbols: (symbol | string)[] | symbol | string) => {
    let localSymbols: (symbol | string)[] = [];

    if (symbols === ifOtherSymbol) {
      return ifOtherSymbol;
    }

    if (typeof symbols === 'string') {
      localSymbols = symbols.split('');
    } else if (Array.isArray(symbols)) {
      localSymbols = [...symbols];
    }

    if (localSymbols.length === 0 || localSymbols.length % this.#tapes.length > 0) {
      throw new Error('invalid symbol parameter');
    }

    const invalidSymbolIndex = localSymbols.findIndex((symbol, ix) => (
      symbol !== ifOtherSymbol
      && !this.#tapes[ix % this.#tapes.length].alphabet.has(symbol as string)
    ));

    if (invalidSymbolIndex >= 0) {
      throw new Error('invalid symbol parameter');
    }

    if (localSymbols.every((symbol) => symbol === ifOtherSymbol)) {
      return ifOtherSymbol;
    }

    return this.#getSymbolForPatternList(this.#buildPatternList(localSymbols));
  };
}
