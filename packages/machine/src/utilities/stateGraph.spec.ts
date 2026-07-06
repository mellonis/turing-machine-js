import Alphabet from '../classes/Alphabet';
import Reference from '../classes/Reference';
import State, {abortState, haltState, ifOtherSymbol} from '../classes/State';
import TapeBlock from '../classes/TapeBlock';
import {movements} from '../classes/TapeCommand';
import {collectStates, toGraph} from './stateGraph';

const alphabet = new Alphabet(' 01'.split(''));
const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
const {symbol} = tapeBlock;

describe('collectStates', () => {
  test('alignment contract: every GraphTransition.id maps to transitionSymbols[K]', () => {
    // For every transition emitted by toGraph, the (stateId, patternIx)
    // pair extracted from its id should index back to the firing Symbol
    // via stateMap.get(stateId).transitionSymbols[patternIx]. This is
    // the load-bearing primitive the issue identifies — a single test
    // pinning it across the whole machine catches any drift between
    // toGraph's patternIx counter and collectStates' Map.keys() walk.
    const sym0 = symbol(['0']);
    const sym1 = symbol(['1']);
    const branch = new State({
      [sym0]: {nextState: haltState},
      [sym1]: {command: [{symbol: '0', movement: movements.right}], nextState: haltState},
    }, 'branch');

    const graph = toGraph(branch, tapeBlock);
    const stateMap = collectStates(branch, tapeBlock);

    let assertions = 0;
    for (const node of Object.values(graph.nodes)) {
      for (const t of node.transitions) {
        const [nStr, kStr] = t.id.split('.');
        const n = Number(nStr);
        const k = Number(kStr);
        const entry = stateMap.get(n);
        expect(entry).toBeDefined();
        // Positional alignment by index, identity equality of the
        // Symbol (not structural). Symbols are interned per-pattern by
        // tapeBlock.symbol — re-creating the pattern returns the same
        // Symbol, so we can compare against the recreated keys here.
        expect(entry!.transitionSymbols[k]).toBeDefined();
        assertions += 1;
      }
    }
    // Sanity: the test would pass vacuously if no transitions existed.
    expect(assertions).toBeGreaterThan(0);
  });

  test('transitionSymbols matches #symbolToDataMap insertion order', () => {
    // Construction order: sym0 first, then sym1. collectStates surfaces
    // the same order as transitionSymbols[0], [1]. The contract is by
    // reference equality.
    const sym0 = symbol(['0']);
    const sym1 = symbol(['1']);
    const s = new State({
      [sym0]: {nextState: haltState},
      [sym1]: {command: [{symbol: '0', movement: movements.right}], nextState: haltState},
    }, 's');

    const entry = collectStates(s, tapeBlock).get(s.id)!;

    expect(entry.transitionSymbols[0]).toBe(sym0);
    expect(entry.transitionSymbols[1]).toBe(sym1);
  });

  test('ifOtherSymbol is included at its natural slot', () => {
    // A state that wrote ifOtherSymbol BETWEEN two literal-pattern
    // entries — the catch-all sits at index 1 in #symbolToDataMap, so
    // transitionSymbols[1] === ifOtherSymbol by reference.
    const sym0 = symbol(['0']);
    const sym1 = symbol(['1']);
    const s = new State({
      [sym0]: {nextState: haltState},
      [ifOtherSymbol]: {nextState: haltState},
      [sym1]: {command: [{symbol: '0', movement: movements.right}], nextState: haltState},
    }, 's');

    const entry = collectStates(s, tapeBlock).get(s.id)!;

    expect(entry.transitionSymbols).toHaveLength(3);
    expect(entry.transitionSymbols[0]).toBe(sym0);
    expect(entry.transitionSymbols[1]).toBe(ifOtherSymbol);
    expect(entry.transitionSymbols[2]).toBe(sym1);
  });

  test('wrapper entries have empty transitionSymbols and point at the wrapper instance', () => {
    const bare = new State({
      [symbol(['0'])]: {nextState: haltState},
    }, 'bare');
    const wrapper = bare.withOverriddenHaltState(haltState);

    const stateMap = collectStates(wrapper, tapeBlock);
    const wrapperEntry = stateMap.get(wrapper.id);

    expect(wrapperEntry).toBeDefined();
    expect(wrapperEntry!.state).toBe(wrapper);
    expect(wrapperEntry!.transitionSymbols).toEqual([]);
  });

  test('halt singleton entry at id 0 points at haltState with empty transitionSymbols', () => {
    const s = new State({
      [symbol(['0'])]: {nextState: haltState},
    }, 's');

    const haltEntry = collectStates(s, tapeBlock).get(0)!;

    expect(haltEntry.state).toBe(haltState);
    expect(haltEntry.transitionSymbols).toEqual([]);
  });

  test('halt singleton falls back to the module singleton when BFS never reaches haltState', () => {
    // No transition targets haltState — the BFS visits only `looping`,
    // so `stateById` has no entry at id 0. `toGraph` still emits the
    // halt sentinel unconditionally (it anchors `subtree -. halt .-> s0`
    // edges), so id 0 IS in `graph.nodes`. collectStates must fall back
    // to the module-level `haltState` for the entry's `.state` field —
    // pinning that fallback path here.
    const looping = new State({
      [symbol(['0'])]: {}, // nextState defaults to self → self-loop, no halt reached
    }, 'loop');

    const entry = collectStates(looping, tapeBlock).get(0)!;

    expect(entry.state).toBe(haltState);
    expect(entry.transitionSymbols).toEqual([]);
  });

  test('halt markers (negative ids) are excluded from the map', () => {
    // A wrapper produces a callable-subtree frame, which gets a synthetic
    // halt marker with id = -2 * frameId. collectStates must skip it — the
    // marker is visualization-only.
    const bare = new State({
      [symbol(['0'])]: {nextState: haltState},
    }, 'bare');
    const wrapper = bare.withOverriddenHaltState(haltState);

    const graph = toGraph(wrapper, tapeBlock);
    const stateMap = collectStates(wrapper, tapeBlock);

    const haltMarkerIds = Object.keys(graph.nodes)
      .map(Number)
      .filter((id) => graph.nodes[id].isHaltMarker);

    // Sanity: the test would be vacuous if the graph had no halt marker.
    expect(haltMarkerIds.length).toBeGreaterThan(0);

    for (const id of haltMarkerIds) {
      expect(stateMap.has(id)).toBe(false);
    }

    // Map coverage: every non-halt-marker GraphNode has a stateMap entry.
    const expectedIds = Object.keys(graph.nodes)
      .map(Number)
      .filter((id) => !graph.nodes[id].isHaltMarker);
    expect(stateMap.size).toBe(expectedIds.length);
  });

  test('unbound Reference: transitionSymbols[K] is defined but no GraphTransition matches', () => {
    // Construct a state whose first pattern points at an unbound
    // Reference. toGraph's BFS catches the unbound-ref error and
    // `continue`s — patternIx still advances, so the slot exists in
    // #symbolToDataMap.keys() but no GraphTransition is emitted for it.
    const danglingRef = new Reference();
    const sym0 = symbol(['0']);
    const sym1 = symbol(['1']);
    const s = new State({
      [sym0]: {nextState: danglingRef}, // unbound — no GraphTransition emitted
      [sym1]: {command: [{symbol: '0', movement: movements.right}], nextState: haltState},
    }, 's');

    const graph = toGraph(s, tapeBlock);
    const stateMap = collectStates(s, tapeBlock);
    const entry = stateMap.get(s.id)!;

    // Both Map keys present in transitionSymbols, in insertion order.
    expect(entry.transitionSymbols).toHaveLength(2);
    expect(entry.transitionSymbols[0]).toBe(sym0);
    expect(entry.transitionSymbols[1]).toBe(sym1);

    // No GraphTransition with id `${s.id}.0` (the unbound-ref slot);
    // the one for slot 1 (the bound transition) DOES exist.
    // (The separator changed from `-` to `.` in v7.)
    const node = graph.nodes[s.id];
    const ids = node.transitions.map((t) => t.id);
    expect(ids).not.toContain(`${s.id}.0`);
    expect(ids).toContain(`${s.id}.1`);
  });
});

describe('State.collectStates — static delegate', () => {
  test('returns the same shape as the module function', () => {
    const s = new State({
      [symbol(['0'])]: {nextState: haltState},
    }, 's');

    const fromStatic = State.collectStates(s, tapeBlock);
    const fromModule = collectStates(s, tapeBlock);

    expect(fromStatic.size).toBe(fromModule.size);
    for (const [id, entry] of fromModule) {
      const staticEntry = fromStatic.get(id)!;
      expect(staticEntry.state).toBe(entry.state);
      expect(staticEntry.transitionSymbols).toEqual(entry.transitionSymbols);
    }
  });
});

describe('graph layer × abortState', () => {
  // Wrapper fixture: a single bare in a frame. Its halt-bound transition
  // retargets to the frame's halt marker (Pass 4), giving every test in
  // this block a marker to inspect.
  const outerBare = new State({
    [symbol(['0'])]: {nextState: haltState},
  }, 'outerBare');
  const outer = outerBare.withOverriddenHaltState(haltState);

  // Wrapper fixture referencing abortState: the bare's '1'-transition
  // targets abortState directly — a legal transition TARGET (only
  // withOverriddenHaltState composition with abort is banned, see
  // State.spec.ts's "withOverriddenHaltState × abortState" suite). Its
  // fallback halts, which (being in-frame) DOES retarget to the frame's
  // halt marker — only the abort-bound transition must stay untouched.
  const innerAbortBare = new State({
    [symbol(['1'])]: {nextState: abortState},
    [ifOtherSymbol]: {nextState: haltState},
  }, 'innerAbortBare');
  const contAbort = new State({
    [ifOtherSymbol]: {nextState: haltState},
  }, 'contAbort');
  const outerWithAbort = innerAbortBare.withOverriddenHaltState(contAbort);

  // A machine that never references abortState at all.
  const plainHaltMachineStart = new State({
    [symbol(['0'])]: {nextState: haltState},
  }, 'plainHaltMachineStart');

  it('halt markers use even negative ids -2f', () => {
    const graph = toGraph(outer, tapeBlock);
    const markers = Object.values(graph.nodes).filter((n) => n.isHaltMarker);

    expect(markers.length).toBeGreaterThan(0);

    for (const m of markers) {
      expect(m.id).toBeLessThan(0);
      expect(Math.abs(m.id) % 2).toBe(0);
      expect(m.id).toBe(-2 * m.frameId!);
    }
  });

  it('abort emits as a single top-level node with id -1', () => {
    const graph = toGraph(outerWithAbort, tapeBlock);
    const abortNode = graph.nodes[-1];

    expect(abortNode).toMatchObject({id: -1, isAbort: true, isHalt: false, frameId: null, name: 'abort'});
    expect(abortNode.transitions).toEqual([]);
  });

  it('machines that never abort get no abort node', () => {
    const graph = toGraph(plainHaltMachineStart, tapeBlock);

    expect(graph.nodes[-1]).toBeUndefined();
  });

  it('in-frame abort transitions keep nextStateId -1 (no marker retarget)', () => {
    const graph = toGraph(outerWithAbort, tapeBlock);
    const innerNode = Object.values(graph.nodes).find(
      (n) => n.frameId !== null && !n.isHaltMarker && n.transitions.some((t) => t.nextStateId === -1),
    );

    expect(innerNode).toBeDefined();
  });

  it('fromGraph maps the abort node back to the singleton', () => {
    const graph = toGraph(outerWithAbort, tapeBlock);
    const {start, tapeBlock: rebuiltTapeBlock} = State.fromGraph(graph);
    const rebuilt = State.toGraph(start, rebuiltTapeBlock);

    expect(rebuilt.nodes[-1]).toMatchObject({isAbort: true});
  });

  it('collectStates includes the abort singleton with empty transitionSymbols', () => {
    const map = State.collectStates(outerWithAbort, tapeBlock);

    expect(map.get(-1)?.state).toBe(abortState);
    expect(map.get(-1)?.transitionSymbols).toEqual([]);
  });
});
