import type { Graph } from '@turing-machine-js/machine';

/**
 * Normalize an engine `GraphNode.id` to its canonical representative for
 * breakpoint-class lookups. Wrappers produced by
 * `State.withOverriddenHaltState` share `#debugRef` with their bare state
 * engine-side (turing-machine-js v7 `State.ts`: `state.#debugRef =
 * bare.#debugRef`), so they form a single breakpoint from the user's POV.
 * This collapses any wrapper id to its bare's id; non-wrapper ids return
 * self. Used so the demo can store ONE canonical id per equivalence class
 * in its breakpoint set, and expand to all class members for indicator
 * rendering — keeping the worker-side toggle count to one per class
 * (multiple toggles on the shared ref would double-flip).
 */
export function bareIdOf(id: number, graph: Graph | null): number {
  if (!graph) return id;
  // Negative ids split by parity (sentinel id scheme): EVEN negatives
  // (`-2·frameId`) are per-frame halt markers — visualization sentinels
  // that all collapse to the haltState singleton (id 0) at runtime, so for
  // breakpoint purposes they're one class with it. ODD negatives are
  // engine sentinels (abortState at -1) — each is its own breakpoint
  // class and must NOT be folded into halt's.
  if (id < 0) return id % 2 === 0 ? 0 : id;
  const node = graph.nodes[id];
  if (node && node.isWrapper && node.bareStateId !== null) {
    return node.bareStateId;
  }
  return id;
}

/**
 * Asymmetric expansion for the highlight effect.
 * Wrapper → `[wrapper, bare]` (the wrapper-entry pause is visually joined
 * to its bare, since the user thinks of them as one call site).
 * Bare → `[bare]` only (when the engine is genuinely on the bare — e.g. a
 * loop iter — the wrapper is not the "active" state and shouldn't get the
 * strong highlight).
 * Non-wrapper / non-bare ids return `[id]`.
 */
export function highlightExpand(id: number, graph: Graph | null): number[] {
  if (!graph) return [id];
  const node = graph.nodes[id];
  if (node?.isWrapper && node.bareStateId !== null) {
    return [id, node.bareStateId];
  }
  return [id];
}

/**
 * All GraphNode ids in the same breakpoint equivalence class as `id`.
 * Symmetric — gives consumers the full list of nodes that share an engine
 * breakpoint, regardless of which class member is the input. Used by the
 * context-menu's "Shared with" info line so the user can see at a glance
 * which other nodes flip together.
 *
 * Halt class (canonical id 0): the halt singleton + every halt marker in
 * the graph. Wrapper/bare class: the bare + every wrapper pointing at it.
 * Singleton classes (regular states, idle sentinel proxies) return just
 * the input id.
 */
export function equivalentIds(id: number, graph: Graph | null): number[] {
  if (!graph) return [id];
  const canonical = bareIdOf(id, graph);
  if (canonical === 0) {
    const ids: number[] = [0];
    for (const node of Object.values(graph.nodes)) {
      if (node.isHaltMarker) ids.push(node.id);
    }
    return ids;
  }
  const result = new Set<number>([canonical]);
  for (const node of Object.values(graph.nodes)) {
    if (node.isWrapper && node.bareStateId === canonical) result.add(node.id);
  }
  return [...result];
}
