const uniquePredicate = (v, i, a) =>  a.indexOf(v) === i;

class Alphabet {
    #symbolList;

    constructor(symbolList = []) {
        symbolList =  symbolList.filter(uniquePredicate);

        if (symbolList.length < 2) {
            throw new Error('Symbols array is too short')
        }

        symbolList.every(symbol => {
            return typeof symbol === 'string' && symbol.length === 1;
        });

        this.#symbolList = Array.from(symbolList);
    }

    get symbolList() {
        return Array.from(this.#symbolList);
    }

    get blankSymbol() {
        return this.#symbolList[0];
    }

    has(symbol) {
        return this.#symbolList.indexOf(symbol) >= 0;
    }

    get(index) {
        if (index < 0 && index >= this.#symbolList.length) {
            throw new Error('Invalid index')
        }

        return this.#symbolList[index];
    }

    index(symbol) {
        return this.#symbolList.indexOf(symbol);
    }
}

class Tape {
    #alphabet;
    #tape = [];
    #position;
    #viewportWidth;

    constructor({tapeSymbolList = [], position = 0, alphabetSymbolList = null, viewportWidth = 1}) {
        tapeSymbolList = Array.from(tapeSymbolList);
        let alphabet;

        if (tapeSymbolList.length === 0) {
            if (!alphabetSymbolList) {
                throw new Error('Invalid parameters');
            } else {
                alphabet = new Alphabet(alphabetSymbolList);
                tapeSymbolList.push(alphabet.blankSymbol);
            }
        } else {
            if (!alphabetSymbolList) {
                alphabet = new Alphabet(tapeSymbolList);
            } else {
                alphabet = new Alphabet(alphabetSymbolList);

                const isValidTape = tapeSymbolList.every(symbol => alphabet.has(symbol));

                if (!isValidTape) {
                    throw new Error('Invalid tapeSymbolList');
                }
            }

            tapeSymbolList = tapeSymbolList.map(symbol => alphabet.index(symbol));
        }

        this.#alphabet = alphabet;
        this.#tape = tapeSymbolList;
        this.#position = position;
        this.viewportWidth = viewportWidth;
    }

    get alphabet() {
        return this.#alphabet;
    }

    set symbol(symbol) {
        if (!this.#alphabet.has(symbol)) {
            throw new Error('Invalid symbol');
        }

        this.#tape[this.#position] = this.#alphabet.index(symbol);
    }

    get symbol() {
        return this.#alphabet.get(this.#tape[this.#position]);
    }

    get symbolList() {
        return this.#tape
            .slice(this.#position - this.extraCellsCount, this.#position + this.extraCellsCount + 1)
            .map(index => this.#alphabet.get(index));
    }

    get viewportWidth() {
        return this.#viewportWidth;
    }

    set viewportWidth(width) {
        if (width < 1) {
            throw new Error('Invalid width');
        }

        if (width % 2 === 0) {
            width += 1;
        }

        this.#viewportWidth = width;

        this.normalise();
    }

    get extraCellsCount() {
        return (this.#viewportWidth - 1) / 2;
    }

    normalise() {
        while (this.#position - this.extraCellsCount < 0) {
            this.#tape.unshift(0);
            this.#position += 1;
        }

        while (this.#position + this.extraCellsCount >= this.#tape.length) {
            this.#tape.push(0);
        }
    }

    right() {
        this.#position += 1;
        this.normalise();
    }

    left() {
        this.#position -= 1;
        this.normalise();
    }
}

const movements = {
    left: Symbol('move caret left command'),
    right: Symbol('move caret right command'),
    stay: Symbol('do not move carer'),
};
const symbolCommands = {
    erase: Symbol('erase symbol command'),
    keep: Symbol('keep symbol command'),
};

class Command {
    #symbol;
    #movement;
    #nextState;

    constructor({symbol = symbolCommands.keep, movement = movements.stay, nextState}) {
        const isValidSymbol =
            (typeof symbol === 'string' && symbol.length === 1)
            || symbol === symbolCommands.keep
            || symbol === symbolCommands.erase;

        if (!isValidSymbol) {
            throw new Error('Invalid symbol');
        }

        this.#symbol = symbol;

        const isValidMovement =
            movement === movements.left
            || movement === movements.stay
            || movement === movements.right;

        if (!isValidMovement) {
            throw new Error('Invalid movement');
        }

        this.#movement = movement;

        const isValidNextState = nextState instanceof State;

        if (!isValidNextState) {
            throw new Error('Invalid nextState');
        }

        this.#nextState = nextState;
    }

    get symbol() {
        return this.#symbol;
    }

    get movement() {
        return this.#movement;
    }

    get nextState() {
        return this.#nextState;
    }
}

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
                        ...stateDefinition[symbolList],
                    }));
                })
            });

            if (stateDefinition[ifOtherSymbol]) {
                this[stateSymbolToCommandMapKey].set(ifOtherSymbol, new Command({
                    nextState: this,
                    ...stateDefinition[ifOtherSymbol],
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
            return  this[stateSymbolToCommandMapKey].get(ifOtherSymbol);
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
    #tape;
    #stack = [];

    constructor(tape = null) {
        this.#tape = tape;
    }

    run(initialState, stepsLimit = 1e5) {
        if (!initialState instanceof State) {
            throw new Error('Invalid parameters');
        }

        let state = initialState;

        if (state.overrodeHaltState) {
            this.#stack.push(state.overrodeHaltState);
        }

        let i = 0;

        while (!state.isHalt) {
            if (i++ > stepsLimit) {
                throw new Error('Long execution');
            }

            const currentSymbol = this.#tape.symbol;
            const command = state.getCommand(currentSymbol);

            let nextSymbol;

            switch (command.symbol) {
                case symbolCommands.erase:
                    nextSymbol = this.#tape.alphabet.blankSymbol;
                    break;
                case symbolCommands.keep:
                    nextSymbol = currentSymbol;
                    break;
                default:
                    nextSymbol = command.symbol;
                    break;
            }

            let nextMovement = command.movement;
            let nextState = command.nextState;

            // apply

            this.#tape.symbol = nextSymbol;

            switch (nextMovement) {
                case movements.left:
                    this.#tape.left();
                    break;
                case movements.right:
                    this.#tape.right();
                    break;

                //no default
            }

            if (nextState.isHalt && this.#stack.length) {
                nextState = this.#stack.pop();

                if (!nextState instanceof State) {
                    throw new Error('Invalid state');
                }
            }

            if (state !== nextState && nextState.overrodeHaltState) {
                this.#stack.push(nextState.overrodeHaltState);
            }

            state = nextState;
        }
    }

    * runStepByStep(initialState, stepsLimit = 1e5) {
        if (!initialState instanceof State) {
            throw new Error('Invalid parameters');
        }

        let state = initialState;

        if (state.overrodeHaltState) {
            this.#stack.push(state.overrodeHaltState);
        }

        let i = 0;

        while (!state.isHalt) {
            if (i++ > stepsLimit) {
                throw new Error('Long execution');
            }

            const currentSymbol = this.#tape.symbol;
            const command = state.getCommand(currentSymbol);

            let nextSymbol;

            switch (command.symbol) {
                case symbolCommands.erase:
                    nextSymbol = this.#tape.alphabet.blankSymbol;
                    break;
                case symbolCommands.keep:
                    nextSymbol = currentSymbol;
                    break;
                default:
                    nextSymbol = command.symbol;
                    break;
            }

            let nextMovement = command.movement;
            let nextState = command.nextState;

            // before apply

            try {
                const nextStateForYield = nextState.isHalt && this.#stack.length ? this.#stack.slice(-1)[0] : nextState;

                yield {
                    step: i,
                    state: state,
                    currentSymbol,
                    nextSymbol,
                    nextMovement,
                    nextState: nextStateForYield,
                };
            } catch (e) {
                throw new Error(`Execution halted because of ${e.message}`);
            }

            // apply

            this.#tape.symbol = nextSymbol;

            switch (nextMovement) {
                case movements.left:
                    this.#tape.left();
                    break;
                case movements.right:
                    this.#tape.right();
                    break;

                    //no default
            }

            if (nextState.isHalt && this.#stack.length) {
                nextState = this.#stack.pop();
            }

            if (state !== nextState && nextState.overrodeHaltState) {
                this.#stack.push(nextState.overrodeHaltState);
            }

            state = nextState;
        }
    }
}

const ifOtherSymbol = Symbol('other symbol');
const haltState = new State(null);

export {
    TuringMachine as default,
    Tape,
    Alphabet,
    Command,
    State,
    haltState,
    ifOtherSymbol,
    movements,
    symbolCommands,
};