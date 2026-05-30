import type { Graph } from '@turing-machine-js/machine';

/**
 * Derived lookups over an engine `Graph` that the highlight + indicator
 * passes need. Recomputed once per Build; consumed read-only thereafter.
 *
 * Pure transformation of `graph` — same input always produces deep-equal
 * output. See `docs/graph-highlight-and-breakpoints.md` for how each
 * field is consumed.
 */
export type GraphIndexes = {
  /** `GraphNode.id` → containing callable-subtree frameId. Only nodes
   *  with `frameId !== null` (i.e. in-frame states) are present. */
  nodeFrameMap: Map<number, number>;

  /** frameId → list of wrappers calling into that frame, each with the
   *  wrapper's id and its override-target id. Used by both source and
   *  destination return-chain passes. */
  frameWrappersMap: Map<number, Array<{ wrapperId: number; overrideId: number | null }>>;

  /** Cluster label text (as emitted by `toMermaid`) → frameId. The
   *  rendered SVG's `g.cluster` carries the label inside a
   *  `<foreignObject>`; consumers match by `label.textContent.trim()` to
   *  build their own `clusterCache: Map<frameId, SVGElement>`. */
  frameLabelToId: Map<string, number>;
};

/**
 * Walk the engine graph once and build all derived lookups. Cheap;
 * intended to run on every Build (graph identity changes per build).
 */
export function indexGraph(graph: Graph | null): GraphIndexes {
  const nodeFrameMap = new Map<number, number>();
  const frameWrappersMap = new Map<
    number,
    Array<{ wrapperId: number; overrideId: number | null }>
  >();
  const frameLabelToId = new Map<string, number>();

  if (!graph) return { nodeFrameMap, frameWrappersMap, frameLabelToId };

  for (const node of Object.values(graph.nodes)) {
    if (node.frameId !== null) nodeFrameMap.set(node.id, node.frameId);
  }

  // For each wrapper, append to its bare's frame entry. Multiple wrappers
  // can share the same bare with different overrides; we record them all
  // so the return-chain passes can highlight every candidate.
  for (const node of Object.values(graph.nodes)) {
    if (!node.isWrapper || node.bareStateId === null) continue;
    const bare = graph.nodes[node.bareStateId];
    if (!bare || bare.frameId === null) continue;
    const entry = { wrapperId: node.id, overrideId: node.overriddenHaltStateId };
    const arr = frameWrappersMap.get(bare.frameId);
    if (arr) arr.push(entry);
    else frameWrappersMap.set(bare.frameId, [entry]);
  }

  // Cluster label reconstruction: mirrors the engine's `toMermaid` emit
  // (`callable subtree of NAME` for single-bare frames, `callable scope:
  // A ∪ B ∪ …` for union frames; bare names sorted by id). Consumers
  // need this to map mermaid's rendered cluster (whose own SVG id is the
  // useless literal `[object Object]`) back to a frameId.
  const bareIds = new Set<number>();
  for (const n of Object.values(graph.nodes)) {
    if (n.isWrapper && n.bareStateId !== null) bareIds.add(n.bareStateId);
  }
  const frameToBareNames = new Map<number, string[]>();
  for (const n of Object.values(graph.nodes).sort((a, b) => a.id - b.id)) {
    if (n.isWrapper || n.isHaltMarker || n.frameId === null) continue;
    if (!bareIds.has(n.id)) continue;
    const arr = frameToBareNames.get(n.frameId) ?? [];
    arr.push(n.name);
    frameToBareNames.set(n.frameId, arr);
  }
  for (const [frameId, names] of frameToBareNames) {
    const label = names.length > 1
      ? `callable scope: ${names.join(' ∪ ')}`
      : `callable subtree of ${names[0] ?? frameId}`;
    frameLabelToId.set(label, frameId);
  }

  return { nodeFrameMap, frameWrappersMap, frameLabelToId };
}
