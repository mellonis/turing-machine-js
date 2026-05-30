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
