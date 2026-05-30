# @turing-machine-js/visuals

Pure highlight + graph-indexing logic for [`@turing-machine-js/machine`](../machine) — plus a renderer-agnostic edge-label formatter and a `recordSnippet` artifact recorder for prerecorded playback (article embeds, landing-page panels, terminal tools). No DOM, no Svelte, no Mermaid — consumers bring their own renderer.

## When to reach for this

- You have an engine `Graph` (from `State.toGraph(initialState, tapeBlock)`) and want to render it with **runtime highlight cues** — `from → edge → to` triples that animate as the machine steps, breakpoint dots, frame-active subgraph marks, pulse-on-revisit. Implement a small `HighlightOps` object that wraps your renderer's DOM/canvas/ANSI primitives; `applyHighlight` decides *what* to highlight, your `HighlightOps` decides *how*.
- You want a logged step's notation to **line up byte-for-byte** with the rendered state graph's edge labels. `formatStepNotation` mirrors the engine's `toMermaid` edge-label vocabulary; same `[reads] → [writes]/[moves]`, same `'X'` / `B` / `*='X'` / `K='X'` / `E` shortcuts.
- You want to **record a machine run** as a self-contained playback artifact — for an article embed, a landing-page panel, a snapshot test, anything that needs to replay a run without booting an engine. `recordSnippet` produces a `Snippet` with one `Frame` per iter (tape state + per-tape `{ movement, read, write }` command + highlight + optional log line); a player walks frames forward AND backward without recomputing deltas.

## Install

```sh
npm install @turing-machine-js/visuals @turing-machine-js/machine
```

Both prereleases on npm `next`:

```sh
npm install @turing-machine-js/visuals@next @turing-machine-js/machine@next
```

Peer-deps on `@turing-machine-js/machine@^7.0.0-alpha.6` — visuals follows engine v7 alphas with occasional visuals-only patches (`7.0.0-alpha.6.1` added the formatter primitives + token surface on top of the lockstep alpha.6 engine release).

## Public API

### Types

```ts
// Highlight contract
type NodeKey = number | 'idle';
type HighlightClass = 'mg-highlight-from' | 'mg-highlight-to' | 'mg-highlight-strong';
interface HighlightOps {
  addNodeClass(id: NodeKey, cls: HighlightClass): void;
  highlightEdge(fromKey: string, toKey: string): void;
  markFrameActive(frameId: number): void;
  pulse(id: NodeKey): void;
  scrollIntoView(id: NodeKey): void;
}
interface IndicatorOps {
  setBreakpoint(id: NodeKey, on: boolean): void;
}
type GraphHighlight = {
  fromId: number | 'idle';
  toId: number | null;
  strong: 'from' | 'to';
  paused: boolean;
};
type GraphIndexes = { /* node→frame, frame→wrappers, frame→label, etc. */ };

// Recording artifact
type TapeSnapshot = { symbols: string[]; position: number };
type StepCommand = { movement: 'L' | 'R' | 'S'; symbol: string | null };
type Frame = {
  step: number;
  tape: TapeSnapshot[];
  commands?: { movement: 'L' | 'R' | 'S'; read: string; write: string }[];
  highlight: GraphHighlight | null;
  log?: string;
};
type Snippet = {
  version: 1;
  name?: string;
  graph: Graph;
  alphabets: string[][];
  frames: Frame[];
};

// Token surface (renderer-agnostic alternative to formatStepNotation strings)
type ReadToken =
  | { kind: 'literal'; symbol: string }
  | { kind: 'blank' }
  | { kind: 'wildcard'; symbol: string };
type WriteToken =
  | { kind: 'literal'; symbol: string }
  | { kind: 'erase' }
  | { kind: 'keep'; readContext?: { symbol: string; isBlank: boolean } };
type StepTokens = {
  reads: readonly ReadToken[] | null;  // null = manual-Apply path (no transition fired)
  writes: readonly WriteToken[];
  moves: readonly ('L' | 'R' | 'S')[];
};
```

### Functions

```ts
indexGraph(graph): GraphIndexes
applyHighlight(highlight, graph, indexes, prev, ops): { nextPrev }
applyIndicator(breakpoints, graph, ops): void
bareIdOf(id, graph): number
highlightExpand(id, graph): number[]
equivalentIds(id, graph): number[]
recordingOps(): { highlight: HighlightOps; indicator: IndicatorOps; record: RecordedOp[] }

// Formatters
formatStepNotation(reads, commands, blanks, matchKinds?): string
tokenizeStep(reads, commands, blanks, matchKinds?): StepTokens
formatTape(tape): string
formatCommand(tapeCommand): string  // alpha.6 single-command formatter; kept for back-compat
formatStep(machineState): string    // alpha.6 MachineState-based formatter; kept for back-compat

// Recording
recordSnippet({ machine, initialState, graph, alphabets, name?, maxSteps?, log? }): Snippet

// Playback
new SnippetPlayer(snippet)
tapeViewport(snapshot, width, blank): { cells, headIndex }
```

The 16-rule contract `applyHighlight` satisfies is documented at [`docs/graph-highlight-and-breakpoints.md`](./docs/graph-highlight-and-breakpoints.md).

## Example: applying highlight in a DOM renderer

```ts
import {
  applyHighlight,
  indexGraph,
  type HighlightOps,
  type GraphHighlight,
} from '@turing-machine-js/visuals';
import { State } from '@turing-machine-js/machine';

// 1. Build your machine + Graph elsewhere (typical Svelte / React / vanilla code).
const graph = State.toGraph(initialState, tapeBlock);
const indexes = indexGraph(graph);

// 2. Tiny DOM applier (illustrative — your renderer probably has a richer one).
function domOps(svgRoot: SVGSVGElement): HighlightOps {
  const node = (id: number | 'idle') =>
    svgRoot.querySelector(`g.node[data-id="${id === 'idle' ? 'idle' : `s${id}`}"]`);
  return {
    addNodeClass: (id, cls) => node(id)?.classList.add(cls),
    highlightEdge: (from, to) =>
      svgRoot
        .querySelector(`path[data-id^="L_${from}_${to}_"]`)
        ?.classList.add('mg-highlight-edge'),
    markFrameActive: (frameId) =>
      svgRoot.querySelector(`g.cluster[data-id="w_${frameId}"]`)?.classList.add('mg-frame-active'),
    pulse: (id) => node(id)?.classList.add('mg-pulse'),
    scrollIntoView: (id) => node(id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
  };
}

// 3. On each engine pause / step: wipe previous highlight from the DOM, then apply the new one.
//    HighlightOps is purely additive — the consumer is responsible for clearing
//    `mg-highlight-*` classes before calling applyHighlight.
let prev = null;
function onMachineStep(highlight: GraphHighlight | null, svgRoot: SVGSVGElement) {
  // Wipe.
  for (const el of svgRoot.querySelectorAll(
    '.mg-highlight-from, .mg-highlight-to, .mg-highlight-strong, .mg-highlight-edge, .mg-frame-active',
  )) {
    el.classList.remove(
      'mg-highlight-from',
      'mg-highlight-to',
      'mg-highlight-strong',
      'mg-highlight-edge',
      'mg-frame-active',
    );
  }
  if (!highlight) return;
  const result = applyHighlight(highlight, graph, indexes, prev, domOps(svgRoot));
  prev = result.nextPrev;
}
```

## Example: rendering a step's edge-label notation

```ts
import { formatStepNotation, type StepCommand } from '@turing-machine-js/visuals';

const commands: StepCommand[] = [
  { movement: 'R', symbol: 'b' },        // write 'b', move right
  { movement: 'L', symbol: null },       // keep current symbol, move left
];
const reads = ['a', 'x'];
const blanks = [' ', ' '];
const matchKinds = ['literal', 'wildcard'] as const;

formatStepNotation(reads, commands, blanks, matchKinds);
// => "['a',*='x'] → ['b',K='x']/[R,L]"
```

For manual-Apply rendering (no transition fired), pass `reads: null`:

```ts
formatStepNotation(null, [{ movement: 'R', symbol: 'b' }], [' '], null);
// => "['b']/[R]"
```

## Example: tokenize for custom (non-string) rendering

```ts
import { tokenizeStep } from '@turing-machine-js/visuals';

const tokens = tokenizeStep(['a'], [{ movement: 'R', symbol: 'b' }], [' '], ['literal']);
// tokens.reads:  [{ kind: 'literal', symbol: 'a' }]
// tokens.writes: [{ kind: 'literal', symbol: 'b' }]
// tokens.moves:  ['R']

// Now render however you want — HTML spans with CSS classes, ANSI escapes, JSON, etc.
function readToHtml(t: typeof tokens.reads[0]) {
  if (t.kind === 'wildcard') return `<span class="cell-wildcard">${t.symbol}</span>`;
  if (t.kind === 'blank') return `<span class="cell-blank">␣</span>`;
  return `<span class="cell-literal">${t.symbol}</span>`;
}
```

## Example: recording a snippet

```ts
import { recordSnippet, formatStep } from '@turing-machine-js/visuals';
import {
  Alphabet, Tape, TapeBlock, TuringMachine, State, haltState, movements,
} from '@turing-machine-js/machine';

const alphabet = new Alphabet([' ', 'a', 'b']);
const tape = new Tape({ alphabet, symbols: ['a', 'a', 'a'] });
const tapeBlock = TapeBlock.fromTapes([tape]);
const machine = new TuringMachine({ tapeBlock });
const initialState = new State({
  [tapeBlock.symbol(['a'])]: { command: [{ symbol: 'b', movement: movements.right }] },
  [tapeBlock.symbol([' '])]: { nextState: haltState },
});

const snippet = recordSnippet({
  machine,
  initialState,
  graph: State.toGraph(initialState, tapeBlock),
  alphabets: [[' ', 'a', 'b']],
  name: 'replace a with b',
  log: (m) => formatStep(m),
});

// snippet.frames[0]    — initial state (no commands, highlight null)
// snippet.frames[N]    — post-iter snapshot with per-tape commands { movement, read, write }
//                        and a graph highlight ready to feed applyHighlight()
// snippet.graph        — the same Graph the player should render
// snippet.alphabets    — per-tape alphabet symbols (single-tape: length 1)
```

`Frame.commands` carries both `read` and `write` per tape so a player can step forward (write `write`, move per `movement`, flash if `write !== read`) AND backward (move opposite of `movement`, restore `read`) without diffing neighbouring frames.

## Example: playing a snippet

```ts
import {
  applyHighlight, SnippetPlayer, indexGraph,
  type HighlightOps, type Snippet,
} from '@turing-machine-js/visuals';

const player = new SnippetPlayer(snippet);
const indexes = indexGraph(snippet.graph);
let prev: Parameters<typeof applyHighlight>[3] = null;

function render(ops: HighlightOps, renderTape: (snap: Snippet['frames'][0]['tape']) => void) {
  const frame = player.currentFrame;
  // (consumer wipes previous highlight classes from the DOM before calling)
  if (frame.highlight) {
    prev = applyHighlight(frame.highlight, snippet.graph, indexes, prev, ops).nextPrev;
  }
  renderTape(frame.tape);
}

// Auto-play forward at a fixed cadence:
const id = setInterval(() => {
  if (!player.forward()) { clearInterval(id); return; }
  render(ops, renderTape);
}, 800);

// Bi-directional scrub:
prevBtn.onclick = () => { if (player.back())    render(ops, renderTape); };
nextBtn.onclick = () => { if (player.forward()) render(ops, renderTape); };
replayBtn.onclick = () => { player.reset();     render(ops, renderTape); };
```

`SnippetPlayer` is pure state — no timers, no events. Consumers wire `setInterval` / `requestAnimationFrame` / `IntersectionObserver` and call `forward()` / `back()` / `goTo(idx)`. Two players over the same `Snippet` are independent (frame storage is shared and read-only). Mirrors the engine's `DebugSession` shape — stateful playback driver for live runs vs prerecorded runs.

## Versioning

Engine + builder + libraries bump in **lockstep** via `lerna version`. **Visuals breaks lockstep for additive consumer-package patches** (e.g., `7.0.0-alpha.6.1` added formatter primitives + the token surface without bumping the engine — there were no engine changes to justify ghost releases). Semver-prerelease caret semantics make this safe: peer `^7.0.0-alpha.6` accepts `7.0.0-alpha.6.1+` without consumers having to widen anything. When the next engine alpha needs to ship, all 5 packages bump back to lockstep.

## License

[GPL-3.0-or-later](../../LICENSE)
