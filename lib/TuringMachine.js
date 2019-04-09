function _classPrivateFieldGet(receiver, privateMap) { if (!privateMap.has(receiver)) { throw new TypeError("attempted to get private field on non-instance"); } var descriptor = privateMap.get(receiver); if (descriptor.get) { return descriptor.get.call(receiver); } return descriptor.value; }

function _classPrivateFieldSet(receiver, privateMap, value) { if (!privateMap.has(receiver)) { throw new TypeError("attempted to set private field on non-instance"); } var descriptor = privateMap.get(receiver); if (descriptor.set) { descriptor.set.call(receiver, value); } else { if (!descriptor.writable) { throw new TypeError("attempted to set read only private field"); } descriptor.value = value; } return value; }

const uniquePredicate = (v, i, a) => a.indexOf(v) === i;

class Alphabet {
  constructor(_symbolList2 = []) {
    _symbolList.set(this, {
      writable: true,
      value: void 0
    });

    _symbolList2 = _symbolList2.filter(uniquePredicate);

    if (_symbolList2.length < 2) {
      throw new Error('Symbols array is too short');
    }

    _symbolList2.every(symbol => {
      return typeof symbol === 'string' && symbol.length === 1;
    });

    _classPrivateFieldSet(this, _symbolList, Array.from(_symbolList2));
  }

  get symbolList() {
    return Array.from(_classPrivateFieldGet(this, _symbolList));
  }

  get blankSymbol() {
    return _classPrivateFieldGet(this, _symbolList)[0];
  }

  has(symbol) {
    return _classPrivateFieldGet(this, _symbolList).indexOf(symbol) >= 0;
  }

  get(index) {
    if (index < 0 && index >= _classPrivateFieldGet(this, _symbolList).length) {
      throw new Error('Invalid index');
    }

    return _classPrivateFieldGet(this, _symbolList)[index];
  }

  index(symbol) {
    return _classPrivateFieldGet(this, _symbolList).indexOf(symbol);
  }

}

var _symbolList = new WeakMap();

class Tape {
  constructor({
    tapeSymbolList: _tapeSymbolList2 = [],
    position: _position2 = 0,
    alphabetSymbolList = null,
    viewportWidth: _viewportWidth2 = 1
  }) {
    _alphabet.set(this, {
      writable: true,
      value: void 0
    });

    _tapeSymbolList.set(this, {
      writable: true,
      value: []
    });

    _position.set(this, {
      writable: true,
      value: void 0
    });

    _viewportWidth.set(this, {
      writable: true,
      value: void 0
    });

    _tapeSymbolList2 = Array.from(_tapeSymbolList2);

    let _alphabet2;

    if (_tapeSymbolList2.length === 0) {
      if (!alphabetSymbolList) {
        throw new Error('Invalid parameters');
      } else {
        _alphabet2 = new Alphabet(alphabetSymbolList);

        _tapeSymbolList2.push(_alphabet2.blankSymbol);
      }
    } else {
      if (!alphabetSymbolList) {
        _alphabet2 = new Alphabet(_tapeSymbolList2);
      } else {
        _alphabet2 = new Alphabet(alphabetSymbolList);

        const isValidTape = _tapeSymbolList2.every(symbol => _alphabet2.has(symbol));

        if (!isValidTape) {
          throw new Error('Invalid tapeSymbolList');
        }
      }
    }

    _tapeSymbolList2 = _tapeSymbolList2.map(symbol => _alphabet2.index(symbol));

    _classPrivateFieldSet(this, _alphabet, _alphabet2);

    _classPrivateFieldSet(this, _tapeSymbolList, _tapeSymbolList2);

    _classPrivateFieldSet(this, _position, _position2);

    this.viewportWidth = _viewportWidth2;
  }

  get alphabet() {
    return _classPrivateFieldGet(this, _alphabet);
  }

  set symbol(symbol) {
    if (!_classPrivateFieldGet(this, _alphabet).has(symbol)) {
      throw new Error('Invalid symbol');
    }

    _classPrivateFieldGet(this, _tapeSymbolList)[_classPrivateFieldGet(this, _position)] = _classPrivateFieldGet(this, _alphabet).index(symbol);
  }

  get symbol() {
    return _classPrivateFieldGet(this, _alphabet).get(_classPrivateFieldGet(this, _tapeSymbolList)[_classPrivateFieldGet(this, _position)]);
  }

  get symbolList() {
    return _classPrivateFieldGet(this, _tapeSymbolList).slice(_classPrivateFieldGet(this, _position) - this.extraCellsCount, _classPrivateFieldGet(this, _position) + this.extraCellsCount + 1).map(index => _classPrivateFieldGet(this, _alphabet).get(index));
  }

  get viewportWidth() {
    return _classPrivateFieldGet(this, _viewportWidth);
  }

  set viewportWidth(width) {
    if (width < 1) {
      throw new Error('Invalid width');
    }

    if (width % 2 === 0) {
      width += 1;
    }

    _classPrivateFieldSet(this, _viewportWidth, width);

    this.normalise();
  }

  get extraCellsCount() {
    return (_classPrivateFieldGet(this, _viewportWidth) - 1) / 2;
  }

  normalise() {
    while (_classPrivateFieldGet(this, _position) - this.extraCellsCount < 0) {
      _classPrivateFieldGet(this, _tapeSymbolList).unshift(0);

      _classPrivateFieldSet(this, _position, _classPrivateFieldGet(this, _position) + 1);
    }

    while (_classPrivateFieldGet(this, _position) + this.extraCellsCount >= _classPrivateFieldGet(this, _tapeSymbolList).length) {
      _classPrivateFieldGet(this, _tapeSymbolList).push(0);
    }
  }

  right() {
    _classPrivateFieldSet(this, _position, _classPrivateFieldGet(this, _position) + 1);

    this.normalise();
  }

  left() {
    _classPrivateFieldSet(this, _position, _classPrivateFieldGet(this, _position) - 1);

    this.normalise();
  }

}

var _alphabet = new WeakMap();

var _tapeSymbolList = new WeakMap();

var _position = new WeakMap();

var _viewportWidth = new WeakMap();

const movements = {
  left: Symbol('move caret left command'),
  right: Symbol('move caret right command'),
  stay: Symbol('do not move carer')
};
const symbolCommands = {
  erase: Symbol('erase symbol command'),
  keep: Symbol('keep symbol command')
};

class Command {
  constructor({
    symbol: _symbol2 = symbolCommands.keep,
    movement: _movement2 = movements.stay,
    nextState: _nextState2
  }) {
    _symbol.set(this, {
      writable: true,
      value: void 0
    });

    _movement.set(this, {
      writable: true,
      value: void 0
    });

    _nextState.set(this, {
      writable: true,
      value: void 0
    });

    const isValidSymbol = typeof _symbol2 === 'string' && _symbol2.length === 1 || _symbol2 === symbolCommands.keep || _symbol2 === symbolCommands.erase;

    if (!isValidSymbol) {
      throw new Error('Invalid symbol');
    }

    _classPrivateFieldSet(this, _symbol, _symbol2);

    const isValidMovement = _movement2 === movements.left || _movement2 === movements.stay || _movement2 === movements.right;

    if (!isValidMovement) {
      throw new Error('Invalid movement');
    }

    _classPrivateFieldSet(this, _movement, _movement2);

    const isValidNextState = _nextState2 instanceof State;

    if (!isValidNextState) {
      throw new Error('Invalid nextState');
    }

    _classPrivateFieldSet(this, _nextState, _nextState2);
  }

  get symbol() {
    return _classPrivateFieldGet(this, _symbol);
  }

  get movement() {
    return _classPrivateFieldGet(this, _movement);
  }

  get nextState() {
    return _classPrivateFieldGet(this, _nextState);
  }

}

var _symbol = new WeakMap();

var _movement = new WeakMap();

var _nextState = new WeakMap();

const stateSymbolToCommandMapKey = Symbol('stateSymbolToCommandMapKey');
const stateOverrodeHaltStateKey = Symbol('stateOverrodeHaltStateKey');
const stateNameKey = Symbol('stateNameKey');

class State {
  constructor(stateDefinition = null, name) {
    if (stateDefinition) {
      this[stateNameKey] = typeof name === 'string' ? name : null;
      this[stateSymbolToCommandMapKey] = new Map();
      let isValidStateDefinition = true;
      const keyList = Object.keys(stateDefinition);

      if (keyList.some(symbol => symbol.length === 0)) {
        isValidStateDefinition = false;
      }

      const symbolList = keyList.join('').split('');

      if (symbolList.length !== symbolList.filter(uniquePredicate).length) {
        isValidStateDefinition = false;
      }

      if (!isValidStateDefinition) {
        throw new Error('Invalid state definition');
      }

      keyList.forEach(symbolList => {
        symbolList.split('').forEach(symbol => {
          this[stateSymbolToCommandMapKey].set(symbol, new Command({
            nextState: this,
            ...stateDefinition[symbolList]
          }));
        });
      });

      if (stateDefinition[ifOtherSymbol]) {
        this[stateSymbolToCommandMapKey].set(ifOtherSymbol, new Command({
          nextState: this,
          ...stateDefinition[ifOtherSymbol]
        }));
      }
    } else {
      this[stateNameKey] = '__HALT__';
    }
  }

  getCommand(symbol) {
    if (symbol.length !== 1) {
      throw new Error('Invalid symbol');
    }

    if (this[stateSymbolToCommandMapKey].has(symbol)) {
      return this[stateSymbolToCommandMapKey].get(symbol);
    }

    if (this[stateSymbolToCommandMapKey].has(ifOtherSymbol)) {
      return this[stateSymbolToCommandMapKey].get(ifOtherSymbol);
    }

    throw new Error(`No command for symbol '${symbol}' at state named ${this[stateNameKey]}`);
  }

  get isHalt() {
    return !this[stateSymbolToCommandMapKey];
  }

  get name() {
    return this[stateNameKey] || void 0;
  }

  get overrodeHaltState() {
    return this[stateOverrodeHaltStateKey];
  }

  withOverrodeHaltState(overrodeHaltState) {
    const state = new State(null);
    state[stateSymbolToCommandMapKey] = this[stateSymbolToCommandMapKey];
    state[stateOverrodeHaltStateKey] = overrodeHaltState;
    state[stateNameKey] = `${this[stateNameKey]}>${overrodeHaltState[stateNameKey]}`;
    return state;
  }

}

class TuringMachine {
  constructor(_tape2 = null) {
    _tape.set(this, {
      writable: true,
      value: void 0
    });

    _stack.set(this, {
      writable: true,
      value: []
    });

    _classPrivateFieldSet(this, _tape, _tape2);
  }

  run(initialState, stepsLimit = 1e5) {
    if (!initialState instanceof State) {
      throw new Error('Invalid parameters');
    }

    let state = initialState;

    if (state.overrodeHaltState) {
      _classPrivateFieldGet(this, _stack).push(state.overrodeHaltState);
    }

    let i = 0;

    while (!state.isHalt) {
      if (i++ > stepsLimit) {
        throw new Error('Long execution');
      }

      const currentSymbol = _classPrivateFieldGet(this, _tape).symbol;

      const command = state.getCommand(currentSymbol);
      let nextSymbol;

      switch (command.symbol) {
        case symbolCommands.erase:
          nextSymbol = _classPrivateFieldGet(this, _tape).alphabet.blankSymbol;
          break;

        case symbolCommands.keep:
          nextSymbol = currentSymbol;
          break;

        default:
          nextSymbol = command.symbol;
          break;
      }

      let nextMovement = command.movement;
      let nextState = command.nextState; // apply

      _classPrivateFieldGet(this, _tape).symbol = nextSymbol;

      switch (nextMovement) {
        case movements.left:
          _classPrivateFieldGet(this, _tape).left();

          break;

        case movements.right:
          _classPrivateFieldGet(this, _tape).right();

          break;
        //no default
      }

      if (nextState.isHalt && _classPrivateFieldGet(this, _stack).length) {
        nextState = _classPrivateFieldGet(this, _stack).pop();

        if (!nextState instanceof State) {
          throw new Error('Invalid state');
        }
      }

      if (state !== nextState && nextState.overrodeHaltState) {
        _classPrivateFieldGet(this, _stack).push(nextState.overrodeHaltState);
      }

      state = nextState;
    }
  }

  *runStepByStep(initialState, stepsLimit = 1e5) {
    if (!initialState instanceof State) {
      throw new Error('Invalid parameters');
    }

    let state = initialState;

    if (state.overrodeHaltState) {
      _classPrivateFieldGet(this, _stack).push(state.overrodeHaltState);
    }

    let i = 0;

    while (!state.isHalt) {
      if (i++ > stepsLimit) {
        throw new Error('Long execution');
      }

      const currentSymbol = _classPrivateFieldGet(this, _tape).symbol;

      const command = state.getCommand(currentSymbol);
      let nextSymbol;

      switch (command.symbol) {
        case symbolCommands.erase:
          nextSymbol = _classPrivateFieldGet(this, _tape).alphabet.blankSymbol;
          break;

        case symbolCommands.keep:
          nextSymbol = currentSymbol;
          break;

        default:
          nextSymbol = command.symbol;
          break;
      }

      let nextMovement = command.movement;
      let nextState = command.nextState; // before apply

      try {
        const nextStateForYield = nextState.isHalt && _classPrivateFieldGet(this, _stack).length ? _classPrivateFieldGet(this, _stack).slice(-1)[0] : nextState;
        yield {
          step: i,
          state: state,
          currentSymbol,
          nextSymbol,
          nextMovement,
          nextState: nextStateForYield
        };
      } catch (e) {
        throw new Error(`Execution halted because of ${e.message}`);
      } // apply


      _classPrivateFieldGet(this, _tape).symbol = nextSymbol;

      switch (nextMovement) {
        case movements.left:
          _classPrivateFieldGet(this, _tape).left();

          break;

        case movements.right:
          _classPrivateFieldGet(this, _tape).right();

          break;
        //no default
      }

      if (nextState.isHalt && _classPrivateFieldGet(this, _stack).length) {
        nextState = _classPrivateFieldGet(this, _stack).pop();
      }

      if (state !== nextState && nextState.overrodeHaltState) {
        _classPrivateFieldGet(this, _stack).push(nextState.overrodeHaltState);
      }

      state = nextState;
    }
  }

}

var _tape = new WeakMap();

var _stack = new WeakMap();

const ifOtherSymbol = Symbol('other symbol');
const haltState = new State(null);
export { TuringMachine as default, Tape, Alphabet, Command, State, haltState, ifOtherSymbol, movements, symbolCommands };