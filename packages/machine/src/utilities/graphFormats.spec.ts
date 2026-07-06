import Alphabet from '../classes/Alphabet';
import State, {abortState, haltState, ifOtherSymbol} from '../classes/State';
import Tape from '../classes/Tape';
import TapeBlock from '../classes/TapeBlock';
import TuringMachine from '../classes/TuringMachine';
import {fromMermaid, mermaidIdFor, parseMermaidId, toMermaid} from './graphFormats';

describe('mermaidIdFor / parseMermaidId namespacing', () => {
  const cases: Array<[number, string]> = [
    [1, 'u1'], [2, 'u2'], [42, 'u42'], // user states
    [0, 's0'], // halt
    [-1, 's1'], [-3, 's2'], [-5, 's3'], // sentinels (odd negatives)
    [-2, 's0-1'], [-4, 's0-2'], [-6, 's0-3'], // halt markers (even negatives)
  ];

  it.each(cases)('%d ⇄ %s', (num, str) => {
    expect(mermaidIdFor(num)).toBe(str);
    expect(parseMermaidId(str)).toBe(num);
  });
});

// Fixture shape mirrors stateGraph.spec.ts's "graph layer × abortState"
// describe block: a wrapper whose bare has a transition TARGETING abortState
// directly (a legal transition target — only wohs *composition* with abort
// is banned, see State.spec.ts's "withOverriddenHaltState × abortState").
describe('toMermaid × abortState', () => {
  const alphabet = new Alphabet(' 01'.split(''));
  const tapeBlock = TapeBlock.fromAlphabets([alphabet]);
  const {symbol} = tapeBlock;

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

  it('emits the abort terminal with classDef, only when referenced', () => {
    const withAbort = toMermaid(State.toGraph(outerWithAbort, tapeBlock));

    expect(withAbort).toContain('s1(((abort)))');
    expect(withAbort).toContain('classDef abortSentinel stroke:#c0392b,stroke-width:2px,stroke-dasharray:4 3');
    expect(withAbort).toContain('class s1 abortSentinel');

    const without = toMermaid(State.toGraph(plainHaltMachineStart, tapeBlock));

    expect(without).not.toContain('abort');
  });

  it('in-frame abort edges are solid arrows to the global s1', () => {
    const text = toMermaid(State.toGraph(outerWithAbort, tapeBlock));

    // The in-frame bare uses a `uN` id and targets `s1` directly through a
    // regular labeled solid arrow — not a frame-local halt-marker retarget
    // (abort transitions are never retargeted, unlike halt-bound ones).
    expect(text).toMatch(/u\d+ -- ".*" --> s1/);
  });

  it('round-trips through fromMermaid', () => {
    const graph = State.toGraph(outerWithAbort, tapeBlock);
    const text = toMermaid(graph);
    const reparsed = fromMermaid(text);

    expect(Object.values(reparsed.nodes).find((n) => n.isAbort)).toMatchObject({id: -1, name: 'abort'});
    expect(toMermaid(reparsed)).toBe(text); // bytewise, matching the existing round-trip discipline

    // Semantic round-trip (beyond the structural assertions above — an
    // abort-feature review finding): rebuild a State graph via `State.fromGraph` — like
    // `test/round-trip.spec.ts` does — and confirm the abort path still
    // actually aborts at runtime. If `fromMermaid` ever dropped the abort
    // node (the pre-fix bug: abort rendered as a plain `["abort"]` node and
    // was never parsed back), the dangling `nextStateId: -1` would silently
    // resolve to `haltState` in `fromGraph`, and `outcome` here would read
    // `'halted'` instead of `'aborted'` — a structural-only check on
    // `GraphNode.isAbort` would NOT have caught that regression.
    const {start: rebuiltStart, tapeBlock: rebuiltTapeBlock} = State.fromGraph(reparsed);
    const rebuiltMachine = new TuringMachine({tapeBlock: rebuiltTapeBlock});
    const tape = new Tape({alphabet: rebuiltTapeBlock.tapes[0].alphabet, symbols: ['1']});

    rebuiltTapeBlock.replaceTape(tape);

    const result = rebuiltMachine.run({initialState: rebuiltStart});

    expect(result.outcome).toBe('aborted');
  });
});
