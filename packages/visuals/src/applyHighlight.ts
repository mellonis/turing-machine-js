import type { GraphHighlight } from './types';
import type { Graph } from '@turing-machine-js/machine';
import type { GraphIndexes } from './graphIndexes';
import type { HighlightOps, IndicatorOps, NodeKey } from './highlightOps';
import { bareIdOf, highlightExpand } from './graphUtils';

/**
 * Pure highlight-rule evaluator. Given the current `highlight` (from
 * `MachineView`'s `$derived`), the engine `graph`, derived `indexes`,
 * and the previous strong-id (for pause-revisit pulse detection), emit
 * a sequence of `ops` calls describing the resulting visual state.
 *
 * Strictly additive — the caller is expected to clear previously-applied
 * highlight classes / edge marks / cluster activations BEFORE invoking
 * this function. The function never reads back from the consumer.
 *
 * Returns the new prev-strong-id to thread into the next call. Pulse
 * comparison uses the RAW strong id (not canonical), so wrapper-pause
 * and bare-pause register as different positions and don't pulse each
 * other. Updates only when `highlight.paused === true`; non-paused
 * events (idle / RUNNING_AUTO ticks) leave it untouched. Null highlight
 * resets it to null.
 *
 * See `docs/graph-highlight-and-breakpoints.md` for the 16 rules
 * enumerated.
 */
export function applyHighlight(
  highlight: GraphHighlight | null,
  graph: Graph | null,
  indexes: GraphIndexes,
  prevStrongId: NodeKey | null,
  ops: HighlightOps,
): { nextPrevStrongId: NodeKey | null } {
  if (!highlight || !graph) {
    return { nextPrevStrongId: null };
  }

  // §5 Halt-target retargeting: real halt (id 0) reached from an in-frame
  // state retargets to the frame's halt marker (id = -frameId), so the
  // visible edge lands inside the cluster.
  let toId: number | null = highlight.toId;
  if (toId === 0 && typeof highlight.fromId === 'number') {
    const fromFrameId = indexes.nodeFrameMap.get(highlight.fromId);
    if (fromFrameId !== undefined) toId = -fromFrameId;
  }

  // §2 Equivalence-class expansion (asymmetric, via highlightExpand):
  //   wrapper → [wrapper, bare]  (joined visual pair for wrapper-entry pause)
  //   bare    → [bare]           (engine genuinely on the bare; no wrapper sync)
  // From-side expansion only fires for positive numeric ids; the 'idle'
  // sentinel is handled directly below. Halt markers / singleton fall
  // through the direct-lookup branches.
  const fromEqIds = typeof highlight.fromId === 'number'
    ? highlightExpand(highlight.fromId, graph)
    : [];
  const toEqIds = toId !== null && toId > 0
    ? highlightExpand(toId, graph)
    : [];

  // §3 Class application — from side.
  if (highlight.fromId === 'idle') {
    ops.addNodeClass('idle', 'mg-highlight-from');
    if (highlight.strong === 'from') ops.addNodeClass('idle', 'mg-highlight-strong');
  }
  for (const id of fromEqIds) {
    ops.addNodeClass(id, 'mg-highlight-from');
    if (highlight.strong === 'from') ops.addNodeClass(id, 'mg-highlight-strong');
  }

  // §3 + §8 Class application — to side. Halt markers (toId < 0) and the
  // real halt singleton (toId === 0; only possible when §5 didn't retarget)
  // bypass the equivalence-class expansion via direct lookup.
  if (toId !== null && toId <= 0) {
    ops.addNodeClass(toId, 'mg-highlight-to');
    if (highlight.strong === 'to') ops.addNodeClass(toId, 'mg-highlight-strong');
  }
  for (const id of toEqIds) {
    ops.addNodeClass(id, 'mg-highlight-to');
    if (highlight.strong === 'to') ops.addNodeClass(id, 'mg-highlight-strong');
  }

  // Edge highlight: the data-id token form mermaid emits.
  const fromKey = highlight.fromId === 'idle' ? 'idle' : `s${highlight.fromId}`;
  const toKey =
    toId === null ? null
    : toId < 0 ? `c${-toId}`  // halt marker
    : `s${toId}`;
  if (toKey !== null) ops.highlightEdge(fromKey, toKey);

  // §10 Wrapper-entry "call" edge: when to-side expanded to [wrapper, bare],
  // light up the wrapper→bare connector so the joined pair has a visible link.
  if (toEqIds.length > 1) {
    const wrapperId = toEqIds.find((id) => graph.nodes[id]?.isWrapper);
    const bareId = toEqIds.find((id) => !graph.nodes[id]?.isWrapper);
    if (wrapperId !== undefined && bareId !== undefined) {
      ops.highlightEdge(`s${wrapperId}`, `s${bareId}`);
    }
  }

  // §6 Source return chain: just-fired transition landed on a frame's
  // halt marker. Light up the post-pop trajectory before the next iter
  // moves the strong node.
  if (toId !== null && toId < 0) {
    const frameId = -toId;
    const wrappers = indexes.frameWrappersMap.get(frameId) ?? [];
    for (const { wrapperId, overrideId } of wrappers) {
      ops.highlightEdge(`w_${frameId}`, `s${wrapperId}`);
      ops.addNodeClass(wrapperId, 'mg-highlight-to');
      if (overrideId !== null) {
        ops.highlightEdge(`s${wrapperId}`, `s${overrideId}`);
        ops.addNodeClass(overrideId, 'mg-highlight-to');
      }
    }
  }

  // §7 Destination return chain: paused at a positive toId that's some
  // wrapper W's override AND fromId is in W's frame — the engine just
  // popped. The straight bare→override edge doesn't exist in the graph;
  // light up the actual visible path bare → halt-marker → return →
  // wrapper → override, plus the frame cluster.
  if (typeof highlight.fromId === 'number' && toId !== null && toId > 0) {
    const fromFrameId = indexes.nodeFrameMap.get(highlight.fromId);
    if (fromFrameId !== undefined) {
      const wrappers = indexes.frameWrappersMap.get(fromFrameId) ?? [];
      const matching = wrappers.filter((w) => w.overrideId === toId);
      if (matching.length > 0) {
        ops.addNodeClass(-fromFrameId, 'mg-highlight-to');
        ops.highlightEdge(`s${highlight.fromId}`, `c${fromFrameId}`);
        for (const { wrapperId } of matching) {
          ops.highlightEdge(`w_${fromFrameId}`, `s${wrapperId}`);
          ops.addNodeClass(wrapperId, 'mg-highlight-to');
          ops.highlightEdge(`s${wrapperId}`, `s${toId}`);
        }
        ops.markFrameActive(fromFrameId);
      }
    }
  }

  // §9 Frame-active for the strong node. Wrappers are outside any frame
  // so canonicalize via bareIdOf so the wrapper-entry pause still lights
  // up the bare's enclosing cluster.
  const strongId = highlight.strong === 'from' ? highlight.fromId : highlight.toId;
  const strongIdCanonical = typeof strongId === 'number'
    ? bareIdOf(strongId, graph)
    : strongId;
  if (typeof strongIdCanonical === 'number') {
    const frameId = indexes.nodeFrameMap.get(strongIdCanonical);
    if (frameId !== undefined) ops.markFrameActive(frameId);
  }

  // §11 Pulse on same-state revisit. Uses RAW strongId — wrapper-pause
  // and bare-pause are visually distinct positions even though they
  // share #debugRef; pausing at wrapper then continuing into bare must
  // not pulse. Idles never pulse and never update prevStrongId.
  if (
    highlight.paused
    && strongId !== null
    && strongId === prevStrongId
    && strongId !== undefined
  ) {
    ops.pulse(strongId);
  }

  // Scroll-into-view target: for wrapper-entry pauses, scroll to the
  // BARE (not the wrapper) so the focus matches the displayed state
  // name. The worker's `resolveDisplayName` returns the bare's name
  // for wrapper iters (so the log reads "paused at walkToBlank ..."),
  // but `toId` is the wrapper's id and `highlightExpand` lights up
  // both nodes as strong. Without this canonicalization the scroll
  // lands on the wrapper while the log line and user's mental focus
  // are on the bare. Halt-related ids (≤ 0) are scrolled to as-is —
  // `bareIdOf` would collapse them all to the halt singleton, which
  // is structurally separate from the in-frame halt marker the user
  // is paused near.
  if (strongId !== null) {
    let scrollTarget: NodeKey = strongId;
    if (typeof strongId === 'number' && strongId > 0) {
      const node = graph.nodes[strongId];
      if (node?.isWrapper && node.bareStateId !== null) {
        scrollTarget = node.bareStateId;
      }
    }
    ops.scrollIntoView(scrollTarget);
  }

  const nextPrevStrongId = highlight.paused ? strongId : prevStrongId;
  return { nextPrevStrongId };
}

/**
 * Pure breakpoint-indicator rule evaluator. For each cached node key,
 * emit `ops.setBreakpoint(key, on)` reflecting whether the node's
 * canonical bare-id is in the `breakpoints` set.
 *
 * The 'idle' string sentinel never carries a breakpoint. All numeric
 * keys are valid BP-class members:
 *   - positive id   → regular state; canonical via bareIdOf (wrappers
 *                     collapse to bare)
 *   - 0             → haltState singleton (engine-wide; canonical = 0)
 *   - negative id   → halt marker (per-frame visualization sentinel;
 *                     bareIdOf maps to 0 — same class as the singleton)
 * Consumers pass their iterable of cached node keys (e.g. `nodeCache.keys()`).
 */
export function applyIndicator(
  breakpoints: ReadonlySet<number>,
  graph: Graph | null,
  nodeIds: Iterable<NodeKey>,
  ops: IndicatorOps,
): void {
  for (const key of nodeIds) {
    const on =
      typeof key === 'number'
      && graph !== null
      && breakpoints.has(bareIdOf(key, graph));
    ops.setBreakpoint(key, on);
  }
}
