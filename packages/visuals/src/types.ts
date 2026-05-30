import type { Graph } from '@turing-machine-js/machine';

/**
 * State-graph highlight descriptor (machines-demo#10). MachineView derives it
 * from `executionMode` + the latest pause-response data; MachineGraph reads
 * it to light up the `from → edge → to` triple in the rendered SVG.
 *
 * - `fromId: 'idle'` represents the synthetic `idle([idle])` sentinel that
 *   `toMermaid` emits at the entry point. Used in IDLE mode to mark "where
 *   execution would start".
 * - `fromId: number` is an engine `GraphNode.id` — the source state.
 * - `toId: number | null` is the destination state's id (or `null` at halt).
 * - `strong` selects which end of the triple gets the bolder/stronger
 *   accent. Per the (B) rule: `from` strong at `before` pause; `to` strong
 *   at `after` / iter-end pause / IDLE (destination feels current).
 */
export type GraphHighlight = {
  fromId: number | 'idle';
  toId: number | null;
  strong: 'from' | 'to';
  /**
   * True when this highlight reflects a paused-event apply (RUNNING_PAUSED),
   * false for per-iter idle applies (RUNNING_AUTO). MachineGraph uses this
   * to detect cross-pause same-state revisits — pulsing the strong node when
   * the current paused apply lands on the same state as the previous paused
   * apply, even when intermediate idle applies pointed elsewhere
   * (e.g., stateA breakpoint → continue → run through stateB/C → stateA
   * breakpoint fires again). The simpler "previous apply's strong matches"
   * check already covers AUTO self-loops; this flag drives the second pulse
   * trigger.
   */
  paused: boolean;
};

/**
 * Per-tape snapshot: the cells visible/usable plus the head's index into them.
 * Same shape as machines-demo's TapeSnapshot. Pure data — no library handles.
 */
export type TapeSnapshot = {
  symbols: string[];
  position: number;
};

/**
 * One frame of a recorded snippet — the state of the machine at iter `step`.
 * Frame 0 = initial state (before any transition); frame N = state after iter N's transition.
 *
 * `tape` is per-tape (single-tape machines: length 1). `highlight` describes
 * what to render on the state graph at this moment (null when no highlight).
 * `log` is optional pre-formatted text — a caption / status line consumers can render.
 * `commands` carries the per-tape engine command for the iter that produced this frame.
 * Undefined on frame 0 (initial state — no transition has fired yet).
 * `movement` drives the tape slide direction; `symbol === null` means keep (no write —
 * UI skips the per-cell flash); a non-null `symbol` is the literal that was written to
 * the just-vacated cell.
 */
export type Frame = {
  step: number;
  tape: TapeSnapshot[];
  /**
   * Per-tape engine command for the iter that produced this frame.
   * Undefined on frame 0 (initial state — no transition has fired yet).
   * `movement` drives the tape slide direction; `symbol === null` means
   * keep (no write — UI skips the per-cell flash); a non-null `symbol`
   * is the literal that was written to the just-vacated cell.
   */
  commands?: {
    movement: 'L' | 'R' | 'S';
    symbol: string | null;
  }[];
  highlight: GraphHighlight | null;
  log?: string;
};

/**
 * Recorded run of a machine — playback artifact for embeds, articles,
 * landing-page panels. Engine-agnostic (no `engine` field; identity lives
 * at the caller bucket level).
 *
 * - `version: 1` — schema integer. Additive fields don't bump it;
 *   shape-breaking changes do.
 * - `graph` — engine `State.toGraph` output captured at recording time.
 * - `alphabets` — per-tape alphabet list (single-tape: length 1).
 * - `frames` — length === `stepsApplied + 1`; frame 0 is the initial state.
 */
export type Snippet = {
  version: 1;
  name?: string;
  graph: Graph;
  alphabets: string[][];
  frames: Frame[];
};
