/**
 * Contract between the pure highlight logic (`applyHighlight`,
 * `applyIndicator`) and any consumer that actually renders the graph
 * (Svelte component, vanilla embed, server-side snapshot, etc.).
 *
 * The pure functions decide *what* should happen (which node gets a class,
 * which edge lights up, where to pulse); the consumer's `HighlightOps`
 * implementation decides *how* (DOM mutation, recording for tests, etc.).
 *
 * See `docs/graph-highlight-and-breakpoints.md` for the rules each
 * implementation must respect.
 */

export type NodeKey = number | 'idle';

/** Classes the apply-highlight pass may add to a `g.node` element. */
export type HighlightClass =
  | 'mg-highlight-from'
  | 'mg-highlight-to'
  | 'mg-highlight-strong';

/**
 * Operations the highlight logic invokes on the rendered graph. Purely
 * additive — the consumer is expected to clear previous highlight state
 * (classes, marker swaps) BEFORE invoking `applyHighlight`. The pure
 * function never reads back from the consumer; it just emits ops.
 *
 * Edge keys follow mermaid's data-id token form, built via `mermaidIdFor`
 * from `@turing-machine-js/machine` (#239 namespacing): `'idle'` for the
 * synthetic entry sentinel, `'u${id}'` for regular/wrapper/bare states,
 * `'s0'` for the halt singleton, `'s0-${frameId}'` for halt markers (real
 * graph id `-2 * frameId`), `'w_${id}'` for callable-subtree subgraph
 * clusters (unchanged by #239). Mermaid emits `L_${from}_${to}_${ix}` per
 * edge; ix-resolution is the consumer's concern (multiple edges between
 * the same pair are rare; the consumer typically picks the first match).
 */
export interface HighlightOps {
  /** Add a highlight class to the node identified by `id`. */
  addNodeClass(id: NodeKey, cls: HighlightClass): void;

  /** Highlight the edge whose data-id matches `L_${fromKey}_${toKey}_*`. */
  highlightEdge(fromKey: string, toKey: string): void;

  /** Mark the callable-subtree cluster for `frameId` as active. */
  markFrameActive(frameId: number): void;

  /** Fire a one-shot pulse animation on the given node. */
  pulse(id: NodeKey): void;

  /** Scroll the given node into the visible area of its container. */
  scrollIntoView(id: NodeKey): void;
}

/** Operations the indicator (breakpoint dot) pass invokes. */
export interface IndicatorOps {
  /** Set or clear the breakpoint indicator on the given node. */
  setBreakpoint(id: NodeKey, on: boolean): void;
}

/** A single recorded op — serializable, suitable for snapshot tests. */
export type RecordedOp =
  | { op: 'addNodeClass'; id: NodeKey; cls: HighlightClass }
  | { op: 'highlightEdge'; fromKey: string; toKey: string }
  | { op: 'markFrameActive'; frameId: number }
  | { op: 'pulse'; id: NodeKey }
  | { op: 'scrollIntoView'; id: NodeKey }
  | { op: 'setBreakpoint'; id: NodeKey; on: boolean };

/**
 * Build a recording `HighlightOps` + `IndicatorOps` pair plus the shared
 * `record` array of calls in invocation order. Used by tests to assert
 * what the pure logic would have done without running a real DOM.
 *
 * Snapshot-friendly: the record contains only plain JSON-serializable
 * values (no DOM nodes, no function refs).
 */
export function recordingOps(): {
  highlight: HighlightOps;
  indicator: IndicatorOps;
  record: RecordedOp[];
} {
  const record: RecordedOp[] = [];
  return {
    record,
    highlight: {
      addNodeClass(id, cls) { record.push({ op: 'addNodeClass', id, cls }); },
      highlightEdge(fromKey, toKey) { record.push({ op: 'highlightEdge', fromKey, toKey }); },
      markFrameActive(frameId) { record.push({ op: 'markFrameActive', frameId }); },
      pulse(id) { record.push({ op: 'pulse', id }); },
      scrollIntoView(id) { record.push({ op: 'scrollIntoView', id }); },
    },
    indicator: {
      setBreakpoint(id, on) { record.push({ op: 'setBreakpoint', id, on }); },
    },
  };
}
