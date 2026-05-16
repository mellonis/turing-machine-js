import State, {haltState, ifOtherSymbol, DebugConfig} from './State';
import TapeBlock from './TapeBlock';
import Alphabet from './Alphabet';

const alphabet = new Alphabet(' AB'.split(''));

const makeState = (): State => {
  const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
  const {symbol} = tapeBlock;
  return new State({
    [symbol(['A'])]: {nextState: haltState},
    [ifOtherSymbol]: {nextState: haltState},
  });
};

describe('DebugConfig — sealed instance (defensive against typos)', () => {
  test('the DebugConfig instance is Object.seal-ed', () => {
    const state = makeState();
    expect(Object.isSealed(state.debug)).toBe(true);
  });

  test('typo on field name throws TypeError (strict mode)', () => {
    const state = makeState();
    expect(() => {
      // @ts-expect-error — deliberate typo to assert it fails loudly.
      state.debug.bofore = true;
    }).toThrow(TypeError);
  });

  test('legitimate fields (before, after) remain writable through setters', () => {
    const state = makeState();
    expect(() => {
      state.debug.before = true;
      state.debug.after = true;
    }).not.toThrow();
    expect(state.debug.before).toBe(true);
    expect(state.debug.after).toBe(true);
  });
});

describe('State.debug — basics', () => {
  test('returns an empty DebugConfig by default (lazy-init)', () => {
    const state = makeState();
    expect(state.debug).toBeInstanceOf(DebugConfig);
    expect(state.debug.before).toBeUndefined();
    expect(state.debug.after).toBeUndefined();
  });

  test('chained field write `state.debug.before = true` works on a fresh state', () => {
    const state = makeState();
    state.debug.before = true;
    expect(state.debug.before).toBe(true);
  });

  test('chained field write `state.debug.after = true` works on a fresh state', () => {
    const state = makeState();
    state.debug.after = true;
    expect(state.debug.after).toBe(true);
  });

  test('plain-object assignment is wrapped in a DebugConfig instance', () => {
    const state = makeState();
    state.debug = {before: true};
    expect(state.debug).toBeInstanceOf(DebugConfig);
    expect(state.debug.before).toBe(true);
  });

  test('DebugConfig instance assignment is stored as-is (identity preserved)', () => {
    const state = makeState();
    const cfg = new DebugConfig(state, {before: true});
    state.debug = cfg;
    expect(state.debug).toBe(cfg);
  });

  test('null assignment resets filters; next read returns a fresh empty DebugConfig', () => {
    const state = makeState();
    state.debug = {before: true};
    state.debug = null;
    expect(state.debug).toBeInstanceOf(DebugConfig);
    expect(state.debug.before).toBeUndefined();
    expect(state.debug.after).toBeUndefined();
  });

  test('chained write works again after `state.debug = null`', () => {
    const state = makeState();
    state.debug = {before: true};
    state.debug = null;
    state.debug.before = true;
    expect(state.debug.before).toBe(true);
    expect(state.debug.after).toBeUndefined();
  });

  test('withOverrodeHaltState returns a new state that shares the debug ref', () => {
    const state = makeState();
    const wrapped = state.withOverrodeHaltState(haltState);

    expect(wrapped).not.toBe(state);
    // Both lazy-init through the shared ref, so reading either returns the
    // same DebugConfig instance.
    expect(wrapped.debug).toBeInstanceOf(DebugConfig);
    expect(wrapped.debug).toBe(state.debug);

    state.debug = {before: true};

    // Wrapper sees the assignment because both share the same Ref cell.
    expect(wrapped.debug).toBe(state.debug);
    expect(wrapped.debug.before).toBe(true);
  });

  test('null assignment on the original propagates to wrappers (filters reset for both)', () => {
    const state = makeState();
    state.debug = {before: true};
    const wrapped = state.withOverrodeHaltState(haltState);

    state.debug = null;
    expect(state.debug.before).toBeUndefined();
    expect(wrapped.debug.before).toBeUndefined();
    expect(wrapped.debug).toBe(state.debug);
  });

  test('setting on the wrapper propagates back to the original', () => {
    const state = makeState();
    const wrapped = state.withOverrodeHaltState(haltState);

    wrapped.debug = {after: true};
    expect(state.debug).toBe(wrapped.debug);
    expect(state.debug.after).toBe(true);
  });

  test('chained wrappers all share the SAME debug object (identity)', () => {
    const state = makeState();
    const w1 = state.withOverrodeHaltState(haltState);
    const w2 = w1.withOverrodeHaltState(haltState);

    state.debug = {before: true};

    expect(w1.debug).toBe(state.debug);
    expect(w2.debug).toBe(state.debug);
  });
});

describe('DebugConfig — class accessors', () => {
  test('per-property setter `cfg.before = [...]` validates and stores a frozen array', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol(['A']);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    state.debug = {};                    // empty config
    state.debug.before = [symA];        // class setter triggers
    expect(state.debug.before).toEqual([symA]);
    expect(Object.isFrozen(state.debug.before)).toBe(true);
  });

  test('extending the filter via `cfg.before = [...cfg.before, sym]` works', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol(['A']);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    state.debug = {before: [symA]};
    state.debug.before = [...(state.debug.before as readonly symbol[]), ifOtherSymbol];
    expect(state.debug.before).toEqual([symA, ifOtherSymbol]);
    expect(Object.isFrozen(state.debug.before)).toBe(true);
  });

  test('per-property setter validates new symbol list', () => {
    const state = makeState();
    state.debug = {};
    expect(() => {
      state.debug.before = [Symbol('random')];
    }).toThrow(/not a transition key of this state/);
  });

  test('frozen array — push throws TypeError', () => {
    const state = makeState();
    state.debug = {before: [ifOtherSymbol]};
    expect(() => {
      (state.debug.before as symbol[]).push(Symbol('x'));
    }).toThrow(TypeError);
  });

  test('frozen array — index assignment throws TypeError', () => {
    const state = makeState();
    state.debug = {before: [ifOtherSymbol]};
    expect(() => {
      (state.debug.before as symbol[])[0] = Symbol('x');
    }).toThrow(TypeError);
  });

  test('input array is not frozen — only the stored copy is', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol(['A']);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    const userInput: symbol[] = [symA];
    state.debug = {before: userInput};

    // User's source array stays mutable (we stored a copy).
    expect(Object.isFrozen(userInput)).toBe(false);
    userInput.push(ifOtherSymbol);  // works fine
    // But the stored array is still its own frozen snapshot:
    expect(state.debug.before).toEqual([symA]);
  });

  test('true (wildcard) and undefined bypass freeze (no array to freeze)', () => {
    const state = makeState();
    state.debug = {before: true};
    // before is `true`, not an array — Object.isFrozen on a non-array is whatever JS says.
    expect(state.debug.before).toBe(true);

    state.debug.before = undefined;
    expect(state.debug.before).toBeUndefined();
  });
});

describe('State.debug — setter validation', () => {
  test('accepts ifOtherSymbol in filter array', () => {
    const state = makeState();
    expect(() => {
      state.debug = {before: [ifOtherSymbol]};
    }).not.toThrow();
  });

  test('accepts transition-key symbols in filter array', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol(['A']);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    expect(() => {
      state.debug = {before: [symA]};
    }).not.toThrow();
  });

  test('throws when filter contains a symbol from a DIFFERENT tape block', () => {
    const tapeBlockA = TapeBlock.fromAlphabets([alphabet]);
    const tapeBlockB = TapeBlock.fromAlphabets([alphabet]);
    const symFromA = tapeBlockA.symbol(['A']);
    const symFromB = tapeBlockB.symbol(['A']);

    const state = new State({
      [symFromA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    expect(() => {
      state.debug = {before: [symFromB]};
    }).toThrow(/not a transition key of this state/);
  });

  test('throws when filter contains a transition-key symbol from a DIFFERENT state', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol(['A']);
    const symB = symbol(['B']);

    const state1 = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });
    new State({
      [symB]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    expect(() => {
      state1.debug = {before: [symB]};  // symB belongs to another state's transitions
    }).toThrow(/not a transition key of this state/);
  });

  test('throws on random Symbol() not interned by any tape block', () => {
    const state = makeState();
    const random = Symbol('random');

    expect(() => {
      state.debug = {after: [random]};
    }).toThrow(/not a transition key of this state/);
  });

  test('error message names the offending field (before vs after)', () => {
    const state = makeState();
    const random = Symbol('random');

    expect(() => {
      state.debug = {after: [random]};
    }).toThrow(/State\.debug\.after/);
  });

  test('true (wildcard) bypasses validation', () => {
    const state = makeState();
    expect(() => {
      state.debug = {before: true, after: true};
    }).not.toThrow();
  });

  test('empty array bypasses validation', () => {
    const state = makeState();
    expect(() => {
      state.debug = {before: [], after: []};
    }).not.toThrow();
  });

  test('null assignment bypasses validation', () => {
    const state = makeState();
    state.debug = {before: true};
    expect(() => {
      state.debug = null;
    }).not.toThrow();
  });
});

describe('State.debug — post-assignment immutability (frozen arrays)', () => {
  // The config OBJECT itself is not frozen — its `before` / `after` setters
  // must remain callable for incremental updates. Only the inner ARRAYS are
  // frozen, so push / index-write throw.

  test('inner before array is frozen', () => {
    const state = makeState();
    state.debug = {before: [ifOtherSymbol]};
    expect(Object.isFrozen(state.debug.before)).toBe(true);
  });

  test('inner after array is frozen', () => {
    const state = makeState();
    state.debug = {after: [ifOtherSymbol]};
    expect(Object.isFrozen(state.debug.after)).toBe(true);
  });

  test('push to filter array throws TypeError', () => {
    const state = makeState();
    state.debug = {before: [ifOtherSymbol]};

    expect(() => {
      (state.debug.before as symbol[]).push(Symbol('x'));
    }).toThrow(TypeError);
  });

  test('full-config reassignment via spread re-validates and re-freezes', () => {
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;
    const symA = symbol(['A']);
    const state = new State({
      [symA]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
    });

    state.debug = {before: [symA]};
    expect(() => {
      state.debug = {
        before: [...(state.debug.before as readonly symbol[]), ifOtherSymbol],
      };
    }).not.toThrow();
    expect(state.debug.before).toEqual([symA, ifOtherSymbol]);
    expect(Object.isFrozen(state.debug.before)).toBe(true);
  });
});
