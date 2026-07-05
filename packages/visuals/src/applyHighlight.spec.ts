import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyHighlight, applyIndicator } from './applyHighlight';
import { indexGraph } from './graphIndexes';
import { recordingOps, type RecordedOp } from './highlightOps';
import type { GraphHighlight } from './types';
import type { Graph } from '@turing-machine-js/machine';

/**
 * Rule tests for `applyHighlight`. Section numbers mirror
 * `docs/graph-highlight-and-breakpoints.md` — any rule change must
 * update both the doc and the matching `describe` block here.
 *
 * Fixtures come from `tests/fixtures/graphs/`, which are committed
 * snapshots of `State.toGraph` output for each bundled example
 * (regenerable via `REGEN_FIXTURES=1 npm test`). Using real engine output
 * means these tests also catch any drift between engine emit and
 * rule expectations.
 *
 * Helpful fixture ids for `turing-callable-subtree`:
 *   bare walkToBlank             = 3   (frameId 3)
 *   writeMarker (override)       = 4
 *   wrapper walkToBlank(writeMarker) = 5  (bareStateId 3, overriddenHaltStateId 4)
 *   halt singleton               = 0
 *   frame halt marker            = -6  (id = -2 * frameId; #239 namespacing —
 *                                       even negatives are halt markers, odd
 *                                       negatives are reserved for sentinels
 *                                       like `abortState`)
 *
 * Mermaid id scheme (#239, `mermaidIdFor`/`parseMermaidId` from
 * `@turing-machine-js/machine`): positive N → `uN`; 0 → `s0`; even negative
 * `-2f` → `s0-f` (frame f's halt marker); odd negative → `s{(1-id)/2}`
 * (sentinel, e.g. `abortState` at id -1 → `s1`).
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FIXTURE_DIR = resolve(__dirname, './fixtures/graphs');

function loadGraph(name: string): Graph {
  return JSON.parse(readFileSync(resolve(FIXTURE_DIR, `${name}.json`), 'utf-8'));
}

/** Run `applyHighlight` with a recording ops impl, return the ordered ops list. */
function run(highlight: GraphHighlight | null, graph: Graph, prev: number | 'idle' | null = null): {
  ops: RecordedOp[];
  next: number | 'idle' | null;
} {
  const indexes = indexGraph(graph);
  const { highlight: opsImpl, record } = recordingOps();
  const { nextPrevStrongId } = applyHighlight(highlight, graph, indexes, prev, opsImpl);
  return { ops: record, next: nextPrevStrongId };
}

describe('applyHighlight', () => {
  describe('null/empty highlight', () => {
    it('returns no-op with nextPrev=null when highlight is null', () => {
      const g = loadGraph('turing-callable-subtree');
      const { ops, next } = run(null, g, 3);
      expect(ops).toEqual([]);
      expect(next).toBeNull();
    });
  });

  describe('§5 halt-target retargeting', () => {
    it('rewrites toId=0 to -2*frameId when fromId is in a frame', () => {
      const g = loadGraph('turing-callable-subtree');
      // Bare walkToBlank (id 3, frameId 3) halts → engine reports toId=0,
      // should retarget to -6 (frame halt marker, id = -2 * frameId).
      const { ops } = run({ fromId: 3, toId: 0, strong: 'from', paused: false }, g);
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      // halt marker -6 gets highlight-to; halt singleton 0 does not.
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: -6, cls: 'mg-highlight-to' });
      expect(classOps).not.toContainEqual({ op: 'addNodeClass', id: 0, cls: 'mg-highlight-to' });
    });

    it('emits u-prefixed keys for user states and s0-f for halt markers (#239)', () => {
      const g = loadGraph('turing-callable-subtree');
      // Same scenario: bare(3) retargets to its frame's halt marker. The
      // bare→marker edge is the one place this fixture emits both new
      // prefixes in a single call: fromKey uses the 'u' (user-state)
      // namespace, toKey uses 's0-f' (frame-f halt marker).
      const { ops } = run({ fromId: 3, toId: 0, strong: 'from', paused: false }, g);
      const edgeOps = ops.filter((o) => o.op === 'highlightEdge');
      expect(edgeOps).toContainEqual({ op: 'highlightEdge', fromKey: 'u3', toKey: 's0-3' }); // was 's3' / 'c3'
      expect(edgeOps.some((o) => /^s0-\d+$/.test(o.toKey))).toBe(true);
    });

    it('does NOT retarget when fromId is outside any frame', () => {
      const g = loadGraph('turing-callable-subtree');
      // writeMarker (id 4) is the wrapper's override-target; sits outside
      // the frame (frameId: null), so its halt→halt-singleton stays as id 0.
      const { ops } = run({ fromId: 4, toId: 0, strong: 'from', paused: false }, g);
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 0, cls: 'mg-highlight-to' });
    });
  });

  describe('§2 + §3 wrapper/bare equivalence (asymmetric)', () => {
    it('wrapper-strong expands to [wrapper, bare] — both get highlight-to + strong', () => {
      const g = loadGraph('turing-callable-subtree');
      // Wrapper-entry pause: idle → wrapper(5), pauseBefore strong=to.
      const { ops } = run({ fromId: 'idle', toId: 5, strong: 'to', paused: true }, g);
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 5, cls: 'mg-highlight-to' });
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 5, cls: 'mg-highlight-strong' });
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 3, cls: 'mg-highlight-to' });
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 3, cls: 'mg-highlight-strong' });
    });

    it('bare-strong stays bare only — does NOT light up wrapper', () => {
      const g = loadGraph('turing-callable-subtree');
      // Bare-loop pause: prev=bare(3), to=bare(3), pauseBefore strong=to.
      const { ops } = run({ fromId: 3, toId: 3, strong: 'to', paused: true }, g);
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 3, cls: 'mg-highlight-to' });
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 3, cls: 'mg-highlight-strong' });
      // Wrapper 5 gets NOTHING from the to-side expansion.
      expect(classOps).not.toContainEqual({ op: 'addNodeClass', id: 5, cls: 'mg-highlight-to' });
      expect(classOps).not.toContainEqual({ op: 'addNodeClass', id: 5, cls: 'mg-highlight-strong' });
    });
  });

  describe('§6 source return chain (toId < 0)', () => {
    it('lights up return arrow + wrapper + override edge + override target', () => {
      const g = loadGraph('turing-callable-subtree');
      // Just-fired halt-bound transition: from=bare(3), to=halt-marker(-6),
      // strong=from (pause-after-style).
      const { ops } = run({ fromId: 3, toId: -6, strong: 'from', paused: true }, g);
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      const edgeOps = ops.filter((o) => o.op === 'highlightEdge');
      // Return arrow w_3 → wrapper(5). Frame subgraph ids (`w_N`) are
      // unchanged by #239; wrapper/bare keys move 's'→'u' (#239).
      expect(edgeOps).toContainEqual({ op: 'highlightEdge', fromKey: 'w_3', toKey: 'u5' });
      // Wrapper gets highlight-to.
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 5, cls: 'mg-highlight-to' });
      // Wrapper → override edge.
      expect(edgeOps).toContainEqual({ op: 'highlightEdge', fromKey: 'u5', toKey: 'u4' });
      // Override (writeMarker) gets highlight-to.
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 4, cls: 'mg-highlight-to' });
    });
  });

  describe('§7 destination return chain (paused at override after pop)', () => {
    it('lights the full path bare → halt-marker → return → wrapper → override + frame', () => {
      const g = loadGraph('turing-callable-subtree');
      // Paused-before writeMarker: prev=bare(3) (last yield was bare's halt),
      // current=writeMarker(4). strong=to. Bare is in frame 3; wrapper 5's
      // override is 4 → matches.
      const { ops } = run({ fromId: 3, toId: 4, strong: 'to', paused: true }, g);
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      const edgeOps = ops.filter((o) => o.op === 'highlightEdge');
      const frameOps = ops.filter((o) => o.op === 'markFrameActive');

      // Halt marker lit (real graph id -6 = -2 * frameId).
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: -6, cls: 'mg-highlight-to' });
      // bare → halt-marker edge. 'u' for the user state, 's0-f' for the
      // frame's halt marker (was 's3' / 'c3').
      expect(edgeOps).toContainEqual({ op: 'highlightEdge', fromKey: 'u3', toKey: 's0-3' });
      // Return arrow.
      expect(edgeOps).toContainEqual({ op: 'highlightEdge', fromKey: 'w_3', toKey: 'u5' });
      // Wrapper highlight-to.
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 5, cls: 'mg-highlight-to' });
      // Wrapper → override edge.
      expect(edgeOps).toContainEqual({ op: 'highlightEdge', fromKey: 'u5', toKey: 'u4' });
      // Frame active (override sits outside frame, but the chain fired so
      // we still mark the frame to show "we came out of THIS subtree").
      expect(frameOps).toContainEqual({ op: 'markFrameActive', frameId: 3 });
    });

    it('does NOT fire when fromId is not in any frame', () => {
      const g = loadGraph('turing-callable-subtree');
      // From idle → writeMarker(4): no frame on the from side, no chain.
      const { ops } = run({ fromId: 'idle', toId: 4, strong: 'to', paused: true }, g);
      const edgeOps = ops.filter((o) => o.op === 'highlightEdge');
      expect(edgeOps).not.toContainEqual({ op: 'highlightEdge', fromKey: 'u3', toKey: 's0-3' });
      expect(edgeOps).not.toContainEqual({ op: 'highlightEdge', fromKey: 'w_3', toKey: 'u5' });
    });
  });

  describe('§8 halt singleton (toId === 0, no retarget)', () => {
    it('marks the halt singleton with highlight-to + strong', () => {
      const g = loadGraph('turing-callable-subtree');
      // writeMarker (id 4, no frame) → halt singleton (0). strong=from
      // (pause-after applying writeMarker's command).
      const { ops } = run({ fromId: 4, toId: 0, strong: 'from', paused: true }, g);
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: 0, cls: 'mg-highlight-to' });
      // strong is 'from', so halt singleton is not strong.
      expect(classOps).not.toContainEqual({ op: 'addNodeClass', id: 0, cls: 'mg-highlight-strong' });
    });
  });

  describe('abort terminal highlight targets the abort node, never halt (#239)', () => {
    it('lights abort node (-1 / s1) when toId is -1, not halt singleton (0)', () => {
      const g = loadGraph('turing-callable-subtree');
      // Abort is an odd-negative sentinel: id -1 maps to mermaid key 's1'.
      // Transition from bare(3) to abort(-1). strong=from, paused=false
      // (RUNNING_AUTO-style). The abort node should get highlight-to;
      // halt singleton should not.
      const { ops } = run({ fromId: 3, toId: -1, strong: 'from', paused: false }, g);
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      const edgeOps = ops.filter((o) => o.op === 'highlightEdge');

      // Abort node (-1) gets highlight-to (not halt).
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: -1, cls: 'mg-highlight-to' });
      // Halt singleton (0) is NOT highlighted when abort is the target.
      expect(classOps).not.toContainEqual({ op: 'addNodeClass', id: 0, cls: 'mg-highlight-to' });
      // Edge from bare(3) to abort uses 's1' (abort's mermaid key).
      expect(edgeOps).toContainEqual({ op: 'highlightEdge', fromKey: 'u3', toKey: 's1' });
    });
  });

  describe('§9 frame-active', () => {
    it('marks the frame when canonical strong is inside it (wrapper case)', () => {
      const g = loadGraph('turing-callable-subtree');
      // Wrapper-entry pause: strong=wrapper(5). bareIdOf(5)=3. nodeFrameMap[3]=3.
      const { ops } = run({ fromId: 'idle', toId: 5, strong: 'to', paused: true }, g);
      const frameOps = ops.filter((o) => o.op === 'markFrameActive');
      expect(frameOps).toContainEqual({ op: 'markFrameActive', frameId: 3 });
    });

    it('marks the frame when bare is strong', () => {
      const g = loadGraph('turing-callable-subtree');
      const { ops } = run({ fromId: 3, toId: 3, strong: 'to', paused: true }, g);
      const frameOps = ops.filter((o) => o.op === 'markFrameActive');
      expect(frameOps).toContainEqual({ op: 'markFrameActive', frameId: 3 });
    });

    it('does NOT mark a frame when strong is outside any frame', () => {
      const g = loadGraph('turing-callable-subtree');
      // writeMarker (4, no frame) is strong.
      const { ops } = run({ fromId: 4, toId: 0, strong: 'from', paused: true }, g);
      const frameOps = ops.filter((o) => o.op === 'markFrameActive');
      expect(frameOps).toEqual([]);
    });
  });

  describe('§10 wrapper-entry call edge', () => {
    it('highlights the wrapper → bare call edge when to-side expanded to both', () => {
      const g = loadGraph('turing-callable-subtree');
      const { ops } = run({ fromId: 'idle', toId: 5, strong: 'to', paused: true }, g);
      const edgeOps = ops.filter((o) => o.op === 'highlightEdge');
      expect(edgeOps).toContainEqual({ op: 'highlightEdge', fromKey: 'u5', toKey: 'u3' });
    });

    it('does NOT highlight a call edge when to-side is bare only', () => {
      const g = loadGraph('turing-callable-subtree');
      const { ops } = run({ fromId: 3, toId: 3, strong: 'to', paused: true }, g);
      const edgeOps = ops.filter((o) => o.op === 'highlightEdge');
      // No u5→u3 call edge (bare doesn't expand to include wrapper).
      expect(edgeOps).not.toContainEqual({ op: 'highlightEdge', fromKey: 'u5', toKey: 'u3' });
    });
  });

  describe('§11 pause-revisit pulse (raw, not canonical)', () => {
    it('does NOT pulse on wrapper-pause → bare-pause transition', () => {
      const g = loadGraph('turing-callable-subtree');
      // First pause: wrapper-entry. prev=null → no pulse. nextPrev=5 (wrapper).
      const r1 = run({ fromId: 'idle', toId: 5, strong: 'to', paused: true }, g, null);
      expect(r1.ops.find((o) => o.op === 'pulse')).toBeUndefined();
      expect(r1.next).toBe(5);
      // Second pause: bare loop iter. prev=5 (wrapper), strong=3 (bare).
      // 5 !== 3 → NO pulse, even though they share #debugRef.
      const r2 = run({ fromId: 3, toId: 3, strong: 'to', paused: true }, g, r1.next);
      expect(r2.ops.find((o) => o.op === 'pulse')).toBeUndefined();
      expect(r2.next).toBe(3);
    });

    it('pulses on same-state revisit (bare → bare)', () => {
      const g = loadGraph('turing-callable-subtree');
      const r1 = run({ fromId: 3, toId: 3, strong: 'to', paused: true }, g, null);
      expect(r1.ops.find((o) => o.op === 'pulse')).toBeUndefined();
      const r2 = run({ fromId: 3, toId: 3, strong: 'to', paused: true }, g, r1.next);
      expect(r2.ops).toContainEqual({ op: 'pulse', id: 3 });
    });

    it('does NOT update prev on non-paused (idle / RUNNING_AUTO) events', () => {
      const g = loadGraph('turing-callable-subtree');
      const r = run({ fromId: 3, toId: 3, strong: 'from', paused: false }, g, 5);
      expect(r.next).toBe(5); // unchanged
    });

    it('resets prev to null on null highlight', () => {
      const g = loadGraph('turing-callable-subtree');
      const r = run(null, g, 3);
      expect(r.next).toBeNull();
    });
  });

  describe('scroll-into-view', () => {
    it('scrolls to the strong node', () => {
      const g = loadGraph('turing-callable-subtree');
      const { ops } = run({ fromId: 3, toId: 4, strong: 'to', paused: true }, g);
      expect(ops).toContainEqual({ op: 'scrollIntoView', id: 4 });
    });

    it('does not scroll when strong is null (no highlight)', () => {
      const g = loadGraph('turing-callable-subtree');
      const { ops } = run(null, g);
      expect(ops.find((o) => o.op === 'scrollIntoView')).toBeUndefined();
    });
  });

  describe('applyIndicator (§2 canonical breakpoint + §3 indicator class)', () => {
    it('marks every member of the equivalence class when canonical id is in set', () => {
      const g = loadGraph('turing-callable-subtree');
      const { indicator, record } = recordingOps();
      // BP set has the bare id (3). Both wrapper (5) and bare (3) should turn on.
      applyIndicator(new Set([3]), g, [3, 4, 5, -6, 0, 'idle'], indicator);
      const onIds = record
        .filter((r): r is Extract<RecordedOp, { op: 'setBreakpoint' }> => r.op === 'setBreakpoint' && r.on)
        .map((r) => r.id);
      expect(onIds).toContain(3);
      expect(onIds).toContain(5);
      // writeMarker (4), halt-marker (-6), halt (0), idle: never on.
      expect(onIds).not.toContain(4);
      expect(onIds).not.toContain(-6);
      expect(onIds).not.toContain(0);
      expect(onIds).not.toContain('idle');
    });

    it('clears every node when the set is empty', () => {
      const g = loadGraph('turing-callable-subtree');
      const { indicator, record } = recordingOps();
      applyIndicator(new Set(), g, [3, 4, 5, 'idle'], indicator);
      const onCount = record.filter((r) => r.op === 'setBreakpoint' && r.on).length;
      expect(onCount).toBe(0);
      // Every node still gets an explicit off call (idempotent clears).
      expect(record.length).toBe(4);
    });

    // machines-demo#37 — halt singleton (id 0) is a valid breakpoint
    // target (engine-wide haltState). The set stores canonical id 0;
    // both the halt singleton AND every halt marker (negative ids; one
    // per frame) collapse to that class via `bareIdOf(-N, g) === 0`.
    it('marks halt singleton AND every halt marker when 0 is in the set', () => {
      const g = loadGraph('turing-callable-subtree');
      const { indicator, record } = recordingOps();
      applyIndicator(new Set([0]), g, [3, 4, 5, -6, 0, 'idle'], indicator);
      const onIds = record
        .filter((r): r is Extract<RecordedOp, { op: 'setBreakpoint' }> => r.op === 'setBreakpoint' && r.on)
        .map((r) => r.id);
      expect(onIds).toContain(0); // halt singleton
      expect(onIds).toContain(-6); // halt marker for frame 3
      // Regular and wrapper / bare nodes: never on.
      expect(onIds).not.toContain(3);
      expect(onIds).not.toContain(4);
      expect(onIds).not.toContain(5);
      expect(onIds).not.toContain('idle');
    });
  });

  describe('regression: simple machines (no callable subtree)', () => {
    it('lights from + to + strong + edge for a plain RUNNING_AUTO tick', () => {
      const g = loadGraph('turing-replace-b');
      // Pick any two ids that have a transition between them.
      const nodes = Object.values(g.nodes).filter((n) => !n.isHalt && !n.isHaltMarker);
      const src = nodes.find((n) => n.transitions.length > 0)!;
      const transition = src.transitions[0];
      const dst = transition.nextStateId;
      const { ops } = run(
        { fromId: src.id, toId: dst, strong: 'from', paused: false },
        g,
      );
      const classOps = ops.filter((o) => o.op === 'addNodeClass');
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: src.id, cls: 'mg-highlight-from' });
      expect(classOps).toContainEqual({ op: 'addNodeClass', id: src.id, cls: 'mg-highlight-strong' });
    });
  });
});
