import Alphabet from './Alphabet';
import Reference from './Reference';
import State, {haltState, ifOtherSymbol} from './State';
import TapeBlock from './TapeBlock';
import {movements, symbolCommands} from './TapeCommand';

const alphabet = new Alphabet(' 01'.split(''));
const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
const {symbol} = tapeBlock;

describe('State constructor — happy path', () => {
  // The default command (when a transition entry omits `command`) is
  // { symbol: keep, movement: stay }; the default nextState is the state
  // being constructed itself (i.e., self-loop). These four tests pin that
  // contract across both ifOtherSymbol and explicit-symbol entries.

  test('ifOtherSymbol with empty entry: self-loop with keep+stay', () => {
    const state = new State({
      [ifOtherSymbol]: {},
    });

    const resolved = state.getSymbol(tapeBlock);
    const command = state.getCommand(resolved);
    const nextState = state.getNextState(resolved);

    expect(nextState.ref).toBe(state); // self-loop
    expect(command.tapesCommands[0].movement).toBe(movements.stay);
    expect(command.tapesCommands[0].symbol).toBe(symbolCommands.keep);
  });

  test('ifOtherSymbol with unbound Reference: command defaults preserved, ref-read still throws', () => {
    const state = new State({
      [ifOtherSymbol]: {nextState: new Reference()},
    });

    const resolved = state.getSymbol(tapeBlock);
    const nextState = state.getNextState(resolved);

    expect(() => nextState.ref).toThrow('unbounded reference');
    const command = state.getCommand(resolved);
    expect(command.tapesCommands[0].movement).toBe(movements.stay);
    expect(command.tapesCommands[0].symbol).toBe(symbolCommands.keep);
  });

  test('ifOtherSymbol with bound Reference: nextState resolves to the bound target', () => {
    const ref = new Reference();
    const target = new State({[ifOtherSymbol]: {}});
    const state = new State({[ifOtherSymbol]: {nextState: ref}});
    ref.bind(target);

    const resolved = state.getSymbol(tapeBlock);
    const nextState = state.getNextState(resolved);

    expect(nextState.ref).toBe(target);
  });

  test('explicit symbol with empty entry: same defaults as ifOtherSymbol case', () => {
    const state = new State({
      [symbol(alphabet.symbols[0])]: {},
    });

    const resolved = state.getSymbol(tapeBlock);
    const command = state.getCommand(resolved);
    const nextState = state.getNextState(resolved);

    expect(nextState.ref).toBe(state);
    expect(command.tapesCommands[0].movement).toBe(movements.stay);
    expect(command.tapesCommands[0].symbol).toBe(symbolCommands.keep);
  });
});

describe('State constructor — invalid inputs', () => {
  test('throws when stateDefinition is empty (no transitions)', () => {
    expect(() => new State({})).toThrow('invalid state definition');
  });

  test('throws when stateDefinition has string-keyed properties (only symbol keys allowed)', () => {
    expect(() => new State({foo: {nextState: haltState}} as never))
      .toThrow(/^invalid state definition/);
  });

  test('throws when nextState is neither State nor Reference', () => {
    expect(() => new State({
      [symbol(['0'])]: {nextState: 'not a state' as never},
    })).toThrow('invalid nextState');
  });

  test('throws "invalid command" when Command construction fails (empty array)', () => {
    // command: [] takes the `try { new Command([]) }` branch. Command rejects
    // empty input; the catch swallows the inner error and commandLocal stays
    // as the plain []. The instanceof Command check then fails → throws.
    expect(() => new State({
      [symbol(['0'])]: {command: [] as never, nextState: haltState},
    })).toThrow('invalid command');
  });

  test('throws when user-provided name contains `(`', () => {
    expect(() => new State(null, 'foo(bar')).toThrow(/invalid state name/);
  });

  test('throws when user-provided name contains `)`', () => {
    expect(() => new State(null, 'foo)bar')).toThrow(/invalid state name/);
  });
});

describe('State.getCommand / .getNextState — error paths', () => {
  // Default-constructed State has an empty symbolToDataMap; any lookup throws.

  test('getCommand on an unmapped symbol throws "No command for symbol at state named …"', () => {
    expect(() => new State().getCommand(ifOtherSymbol))
      .toThrow(/^No command for symbol at state named/);
  });

  test('getNextState on an unmapped symbol throws "No nextState for symbol at state named …"', () => {
    expect(() => new State().getNextState(ifOtherSymbol))
      .toThrow(/^No nextState for symbol at state named/);
  });
});

describe('State.getSymbol — head resolution', () => {
  test('returns ifOtherSymbol when no specific transition matches the head', () => {
    // State has only a transition for '1'. Tape head defaults to blank ' '.
    // No specific symbol matches → fallback to ifOtherSymbol.
    const state = new State({
      [symbol(['1'])]: {nextState: haltState},
    });

    expect(state.getSymbol(tapeBlock)).toBe(ifOtherSymbol);
  });
});

describe('State.withOverriddenHaltState', () => {
  // The wrapper shares the original's symbolToDataMap and debugRef but adds
  // an overriddenHaltState. Audit-flagged: the previous test only checked the
  // name pattern; these tests pin the actual wrapping contract.

  test('wrapper exposes the override target', () => {
    const original = new State({[ifOtherSymbol]: {nextState: haltState}});
    const override = new State({[ifOtherSymbol]: {}});

    const wrapped = original.withOverriddenHaltState(override);

    expect(wrapped.overriddenHaltState).toBe(override);
    expect(original.overriddenHaltState).toBeNull(); // original unchanged
  });

  test('wrapper proxies getCommand / getNextState to the original transitions', () => {
    const original = new State({
      [symbol(['0'])]: {
        command: [{symbol: '1', movement: movements.right}],
        nextState: haltState,
      },
    });
    const wrapped = original.withOverriddenHaltState(haltState);

    const sym = symbol(['0']);
    expect(wrapped.getCommand(sym)).toBe(original.getCommand(sym));
    expect(wrapped.getNextState(sym)).toBe(original.getNextState(sym));
  });

  test('wrapper shares debugRef with the original (assignment on either is visible from both)', () => {
    const original = new State({[ifOtherSymbol]: {}});
    const wrapped = original.withOverriddenHaltState(haltState);

    original.debug = {before: true};

    expect(wrapped.debug?.before).toBe(true);

    // And the reverse — assigning on the wrapper updates the original.
    wrapped.debug = {after: true};

    expect(original.debug?.after).toBe(true);
  });

  test('wrapper has its own id (not shared with the original)', () => {
    const original = new State({[ifOtherSymbol]: {}});
    const wrapped = original.withOverriddenHaltState(haltState);

    expect(wrapped.id).not.toBe(original.id);
  });

  test('wrapper name encodes the override target as `bare(override)`', () => {
    const original = new State({[ifOtherSymbol]: {}}, 'inner');
    const override = new State({[ifOtherSymbol]: {}}, 'outer');

    const wrapped = original.withOverriddenHaltState(override);

    expect(wrapped.name).toBe('inner(outer)');
  });

  test('paren-naming distinguishes wrapping where the override is itself wrapped', () => {
    const A = new State({[ifOtherSymbol]: {}}, 'A');
    const B = new State({[ifOtherSymbol]: {}}, 'B');

    // bare=A, override=(B with override A) — outer1 = A.wohs(B.wohs(A))
    // Under #176, only `this` is unwrapped; the override (B.wohs(A)) is preserved as-is.
    const inner1 = B.withOverriddenHaltState(A);
    const outer1 = A.withOverriddenHaltState(inner1);

    expect(outer1.name).toBe('A(B(A))');
    expect(outer1.overriddenHaltState).toBe(inner1);
  });

  test('nested `.wohs()` chain collapses inner overrides (#176)', () => {
    // `A.wohs(t1).wohs(t2)` is equivalent to `A.wohs(t2)` — t1 is dead at
    // runtime (only the outermost wohs's override is pushed onto the stack
    // when the wrapper is entered; verified empirically by probe). The
    // composite name reflects the runtime behavior, not construction history.
    const A = new State({[ifOtherSymbol]: {}}, 'A');
    const t1 = new State({[ifOtherSymbol]: {}}, 't1');
    const t2 = new State({[ifOtherSymbol]: {}}, 't2');

    const W1 = A.withOverriddenHaltState(t1);
    const W2 = W1.withOverriddenHaltState(t2);

    // Composite name: outer override only, inner ('t1') dropped.
    expect(W2.name).toBe('A(t2)');
    expect(W2.overriddenHaltState).toBe(t2);

    // Structurally equivalent to direct construction.
    const W2direct = A.withOverriddenHaltState(t2);

    expect(W2.name).toBe(W2direct.name);
    expect(W2.overriddenHaltState).toBe(W2direct.overriddenHaltState);
  });

  test('memoization: same (bare, override) pair returns the same wrapper instance (#175)', () => {
    // `withOverriddenHaltState` interns its results keyed by (bare, override).
    // Two calls with the same arguments — even with chained construction —
    // return the literally same JS object.
    const A = new State({[ifOtherSymbol]: {}}, 'A');
    const t = new State({[ifOtherSymbol]: {}}, 't');

    const W1 = A.withOverriddenHaltState(t);
    const W2 = A.withOverriddenHaltState(t);

    expect(W1).toBe(W2);
    expect(W1.id).toBe(W2.id);
    expect(W1.name).toBe('A(t)');
  });

  test('memoization composes with chain collapse: A.wohs(t1).wohs(t2) === A.wohs(t2) (#175 + #176)', () => {
    // After #176 collapses the chain to (A, t2), the cache hit on (A, t2)
    // returns the same instance as the direct call.
    const A = new State({[ifOtherSymbol]: {}}, 'A');
    const t1 = new State({[ifOtherSymbol]: {}}, 't1');
    const t2 = new State({[ifOtherSymbol]: {}}, 't2');

    const Wdirect = A.withOverriddenHaltState(t2);
    const Wchained = A.withOverriddenHaltState(t1).withOverriddenHaltState(t2);

    expect(Wchained).toBe(Wdirect);
  });

  test('memoization is per-(bare, override) pair: different override → different instance (#175)', () => {
    const A = new State({[ifOtherSymbol]: {}}, 'A');
    const t1 = new State({[ifOtherSymbol]: {}}, 't1');
    const t2 = new State({[ifOtherSymbol]: {}}, 't2');

    const W1 = A.withOverriddenHaltState(t1);
    const W2 = A.withOverriddenHaltState(t2);

    expect(W1).not.toBe(W2);
    expect(W1.name).toBe('A(t1)');
    expect(W2.name).toBe('A(t2)');
  });

  test('memoization is per-(bare, override) pair: different bare → different instance (#175)', () => {
    const A = new State({[ifOtherSymbol]: {}}, 'A');
    const B = new State({[ifOtherSymbol]: {}}, 'B');
    const t = new State({[ifOtherSymbol]: {}}, 't');

    const W_A = A.withOverriddenHaltState(t);
    const W_B = B.withOverriddenHaltState(t);

    expect(W_A).not.toBe(W_B);
    expect(W_A.name).toBe('A(t)');
    expect(W_B.name).toBe('B(t)');
  });

  test('3-deep `.wohs()` chain collapses to outermost override (#176)', () => {
    const A = new State({[ifOtherSymbol]: {}}, 'A');
    const t1 = new State({[ifOtherSymbol]: {}}, 't1');
    const t2 = new State({[ifOtherSymbol]: {}}, 't2');
    const t3 = new State({[ifOtherSymbol]: {}}, 't3');

    const W = A.withOverriddenHaltState(t1).withOverriddenHaltState(t2).withOverriddenHaltState(t3);

    expect(W.name).toBe('A(t3)');
    expect(W.overriddenHaltState).toBe(t3);
  });
});

describe('State.toGraph — unbound Reference', () => {
  test('skips a transition whose nextState is an unbound Reference (non-wrapper context)', () => {
    // An unbound Reference throws when its `.ref` getter is read. State.toGraph
    // catches that and skips the transition rather than failing the whole walk.
    const unboundRef = new Reference();
    const state = new State({
      [symbol(['0'])]: {nextState: unboundRef},
      [symbol(['1'])]: {nextState: haltState},
    });

    const graph = State.toGraph(state, tapeBlock);

    // Only the haltState-bound transition survives; the unbound one is dropped.
    expect(graph.nodes[state.id].transitions).toHaveLength(1);
  });

  test('skips a transition whose nextState is an unbound Reference (wrapper context)', () => {
    // Under the v7 callable-subtree model, the bare lives as a separate node
    // from the wrapper. Same skip-and-continue semantic — the bare's unbound-
    // Reference transition is dropped while building its node.
    const unboundRef = new Reference();
    const bare = new State({
      [symbol(['0'])]: {nextState: unboundRef},
      [symbol(['1'])]: {nextState: haltState},
    }, 'bare');
    const override = new State({
      [symbol(['0'])]: {nextState: haltState},
      [symbol(['1'])]: {nextState: haltState},
    }, 'override');
    const wrapped = bare.withOverriddenHaltState(override);

    const graph = State.toGraph(wrapped, tapeBlock);

    // The bare's node retains only the haltState-bound transition; the
    // wrapper itself has no transitions of its own under the new model.
    expect(graph.nodes[bare.id].transitions).toHaveLength(1);
    expect(graph.nodes[wrapped.id].isWrapper).toBe(true);
    expect(graph.nodes[wrapped.id].transitions).toHaveLength(0);
  });
});

describe('State tags (#186)', () => {
  test('a fresh State has an empty tags array', () => {
    const s = new State({[ifOtherSymbol]: {nextState: haltState}});

    expect(s.tags).toEqual([]);
  });

  test('tag() adds tags and is chainable', () => {
    const s = new State({[ifOtherSymbol]: {nextState: haltState}});

    const ret = s.tag('hot', 'sampled');

    expect(ret).toBe(s);
    expect(s.tags).toEqual(['hot', 'sampled']);
  });

  test('tag() de-duplicates repeated tags', () => {
    const s = new State({[ifOtherSymbol]: {nextState: haltState}});

    s.tag('hot');
    s.tag('hot', 'cold');

    expect(s.tags).toEqual(['hot', 'cold']);
  });

  test('untag() removes tags and is chainable', () => {
    const s = new State({[ifOtherSymbol]: {nextState: haltState}});

    s.tag('hot', 'sampled', 'cold');
    const ret = s.untag('hot');

    expect(ret).toBe(s);
    expect(s.tags).toEqual(['sampled', 'cold']);
  });

  test('untag() of a non-present tag is a no-op', () => {
    const s = new State({[ifOtherSymbol]: {nextState: haltState}});

    s.tag('a');
    s.untag('not-present');

    expect(s.tags).toEqual(['a']);
  });

  test('tags getter returns a frozen snapshot — caller cannot mutate', () => {
    const s = new State({[ifOtherSymbol]: {nextState: haltState}});

    s.tag('a');
    const snapshot = s.tags;

    expect(() => {
      (snapshot as unknown as string[]).push('b');
    }).toThrow();

    expect(s.tags).toEqual(['a']);
  });

  test('tags are scoped to the wrapper instance, not the shared bare (#175 sharing)', () => {
    // Engine #175 memoization means `A.wohs(t1)` and `A.wohs(t2)` produce
    // distinct wrapper instances even though they share the same `#symbolToDataMap`.
    // Tags must live on the wrapper instance — tagging one wrapper must NOT
    // propagate to siblings sharing the same bare.
    const A = new State({[ifOtherSymbol]: {nextState: haltState}}, 'A');
    const t1 = new State({[ifOtherSymbol]: {nextState: haltState}}, 't1');
    const t2 = new State({[ifOtherSymbol]: {nextState: haltState}}, 't2');

    const W1 = A.withOverriddenHaltState(t1);
    const W2 = A.withOverriddenHaltState(t2);

    W1.tag('hot');

    expect(W1.tags).toEqual(['hot']);
    expect(W2.tags).toEqual([]); // no leak across wrappers sharing a bare
    expect(A.tags).toEqual([]);  // no leak to the bare either
  });

  test('haltState is not specially excluded from tagging', () => {
    // No reason to forbid tagging haltState. Engine doesn't impose a tag
    // semantic, so tagging the halt singleton is the consumer's call.
    haltState.tag('halt-debug-marker');

    expect(haltState.tags).toContain('halt-debug-marker');

    // Cleanup so other tests don't see the residue.
    haltState.untag('halt-debug-marker');
    expect(haltState.tags).not.toContain('halt-debug-marker');
  });

  // Round-trip tag application (#186) — exercises both fromGraph branches:
  // tagging a bare/regular node (the simple branch) and tagging a wrapper
  // node (the path that goes through `state.tag(...node.tags)` after
  // `withOverriddenHaltState`).
  test('toGraph → fromGraph preserves tags on bare/regular nodes', () => {
    const tapeBlock = TapeBlock.fromAlphabets([new Alphabet([' ', '0'])]);
    const original = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 'tagged-bare').tag('alpha', 'beta');

    const graph = State.toGraph(original, tapeBlock);
    const {start} = State.fromGraph(graph);

    expect(start.tags).toEqual(['alpha', 'beta']);
  });

  test('toGraph → fromGraph preserves tags on wrapper nodes', () => {
    const tapeBlock = TapeBlock.fromAlphabets([new Alphabet([' ', '0'])]);
    const bare = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 'bare');
    const target = new State({
      [tapeBlock.symbol(['0'])]: {nextState: haltState},
    }, 'target');
    const wrapper = bare.withOverriddenHaltState(target).tag('hot');

    const graph = State.toGraph(wrapper, tapeBlock);
    const {start} = State.fromGraph(graph);

    expect(start.tags).toEqual(['hot']);
  });
});

describe('State.toGraph — union-find depth & ordering', () => {
  // Direct coverage for the path-compression loop and the reverse-order
  // `ra > rb` branch in `ufUnion`. The simpler shared-body-state tests in
  // `graph.spec.ts` only exercise depth-1 unions; this case forces depth ≥ 2
  // by chaining: A and B share X; C and D share Y; bridging through a shared
  // state Z forces a multi-level union where `ufFind` walks > 1 step.
  test('reverse-order union — bares[0] has higher id than bares[i], hits the ra > rb branch', () => {
    // The simpler shared-body tests in `graph.spec.ts` always have the
    // lowest-id bare encountered first (so `ufUnion(bares[0], bares[i])`
    // runs with ra < rb and the smaller-id branch fires). To cover the
    // ra > rb else-branch in `ufUnion`, we construct the higher-id bare's
    // wrapper first and reach it via the dispatcher's FIRST transition —
    // so BFS visits its bare before the lower-id one, making it bares[0].
    const alphabet = new Alphabet([' ', '1', '2']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    // Construct the higher-id bare FIRST so it has a HIGHER #id than the
    // lower-id bare we construct later. Counter-intuitive — but bare
    // identity in toGraph's `bareIds` Set is insertion order = BFS visit
    // order, which depends on the dispatcher's transition order, NOT on
    // construction order. So we construct B before A (B gets a lower #id),
    // then route dispatcher to reach A's wrapper FIRST.
    const X = new State({
      [ifOtherSymbol]: {command: {movement: movements.stay}, nextState: haltState},
    }, 'X');
    const B = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: X}}, 'B');
    const A = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: X}}, 'A');
    // A.id > B.id (A constructed later). Now dispatcher visits A's wrapper
    // FIRST via the [1] transition, so BFS puts A in bareIds before B →
    // bares[0]=A (higher id), bares[1]=B (lower id) → ufUnion(A, B) with
    // ra > rb → hits the else-branch.
    const t = new State({
      [ifOtherSymbol]: {command: {movement: movements.stay}, nextState: haltState},
    }, 't');
    const WA = A.withOverriddenHaltState(t);
    const WB = B.withOverriddenHaltState(t);
    const dispatcher = new State({
      [symbol(['1'])]: {command: {movement: movements.stay}, nextState: WA},
      [symbol(['2'])]: {command: {movement: movements.stay}, nextState: WB},
    }, 'dispatcher');

    const graph = State.toGraph(dispatcher, tapeBlock);

    // The frame id is the smallest id in the component (canonical), which
    // is B (constructed first) — confirms `ra > rb` did the right thing:
    // when ufUnion(A, B) ran with A as `ra`, the else-branch set
    // parent[A] = B, keeping the smaller id as root.
    expect(graph.nodes[A.id].frameId).toBe(B.id);
    expect(graph.nodes[B.id].frameId).toBe(B.id);
    expect(graph.nodes[X.id].frameId).toBe(B.id);
  });

  test('multi-bare overlap with several shared bares (smoke test)', () => {
    const alphabet = new Alphabet([' ', '1', '2', '3', '4']);
    const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
    const {symbol} = tapeBlock;

    // Z is a "bridge" body state that A, B, C, D all eventually transition
    // into. Ensures every bare's reach set contains Z → all bares unioned.
    const Z = new State({
      [ifOtherSymbol]: {command: {movement: movements.stay}, nextState: haltState},
    }, 'Z');
    const A = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: Z}}, 'A');
    const B = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: Z}}, 'B');
    const C = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: Z}}, 'C');
    const D = new State({[ifOtherSymbol]: {command: {movement: movements.right}, nextState: Z}}, 'D');

    const t = new State({
      [ifOtherSymbol]: {command: {movement: movements.stay}, nextState: haltState},
    }, 't');

    const WA = A.withOverriddenHaltState(t);
    const WB = B.withOverriddenHaltState(t);
    const WC = C.withOverriddenHaltState(t);
    const WD = D.withOverriddenHaltState(t);

    const dispatcher = new State({
      [symbol(['1'])]: {command: {movement: movements.stay}, nextState: WA},
      [symbol(['2'])]: {command: {movement: movements.stay}, nextState: WB},
      [symbol(['3'])]: {command: {movement: movements.stay}, nextState: WC},
      [symbol(['4'])]: {command: {movement: movements.stay}, nextState: WD},
    }, 'dispatcher');

    const graph = State.toGraph(dispatcher, tapeBlock);

    // All four bares end up in the same union frame (canonical = smallest id).
    const frameId = graph.nodes[A.id].frameId;

    expect(frameId).not.toBeNull();
    expect(graph.nodes[B.id].frameId).toBe(frameId);
    expect(graph.nodes[C.id].frameId).toBe(frameId);
    expect(graph.nodes[D.id].frameId).toBe(frameId);
    expect(graph.nodes[Z.id].frameId).toBe(frameId);
  });
});

describe('State.fromGraph — cyclic override-halt chain', () => {
  test('throws when the override-halt graph has a cycle', () => {
    // Under the v7 callable-subtree model, override-halt chains live on
    // wrapper nodes. Hand-build two wrappers (sharing a single bare) whose
    // `overriddenHaltStateId`s point at each other to exercise the defensive
    // cycle guard in `fromGraph`'s `getFinal`.
    const dummyTransition = {pattern: '*', command: [{symbol: 'K', movement: 'S'}], nextStateId: 0, id: "test-edge"};
    const graph = {
      initialId: 1,
      alphabets: [[' ', '0', '1']],
      nodes: {
        0: {id: 0, name: 'halt', isHalt: true, transitions: [], overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: []},
        1: {id: 1, name: 'wA', isHalt: false, transitions: [], overriddenHaltStateId: 2, isHaltMarker: false, isWrapper: true, bareStateId: 3, frameId: null, tags: []},
        2: {id: 2, name: 'wB', isHalt: false, transitions: [], overriddenHaltStateId: 1, isHaltMarker: false, isWrapper: true, bareStateId: 3, frameId: null, tags: []},
        3: {id: 3, name: 'shared', isHalt: false, transitions: [dummyTransition], overriddenHaltStateId: null, isHaltMarker: false, isWrapper: false, bareStateId: null, frameId: null, tags: []},
      },
    };

    expect(() => State.fromGraph(graph)).toThrow(/^override-halt cycle at state #/);
  });
});
