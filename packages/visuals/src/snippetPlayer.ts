import type { Frame, Snippet } from './types';

/**
 * Pure-state playback driver for a `Snippet` produced by `recordSnippet`.
 *
 * Holds the current frame index and exposes forward / back / reset / goTo.
 * Stateless w.r.t. wall-clock — consumers wire their own ticking
 * (`setInterval`, `requestAnimationFrame`, `IntersectionObserver`, etc.).
 * Renderer-agnostic — consumers read `currentFrame` and apply it however
 * they like (e.g. `applyHighlight(snippet.graph, frame.highlight, ops)`
 * for state-graph highlight, plus app-specific tape rendering).
 */
export type SnippetPlayer = {
  /** The frame at the current index. Live getter — re-reads on every access. */
  readonly currentFrame: Frame;
  /** Current frame index (0 = initial state, `snippet.frames.length - 1` = final). */
  readonly frameIndex: number;
  /** True when `frameIndex === snippet.frames.length - 1`. */
  readonly done: boolean;
  /**
   * Advance one frame. Returns `true` if advanced, `false` if already at the
   * last frame (no-op in that case).
   */
  forward(): boolean;
  /**
   * Retreat one frame. Returns `true` if retreated, `false` if already at
   * the first frame (no-op in that case).
   */
  back(): boolean;
  /** Jump to frame 0. */
  reset(): void;
  /**
   * Jump to a specific frame index. Throws `RangeError` if out of bounds.
   */
  goTo(frameIndex: number): void;
};

/**
 * Create a fresh `SnippetPlayer` positioned at frame 0.
 *
 * Throws if the snippet has no frames. Each `createSnippetPlayer` call
 * yields an independent player — the same `Snippet` can drive any number
 * of concurrent players (frame storage is shared and read-only).
 */
export function createSnippetPlayer(snippet: Snippet): SnippetPlayer {
  if (snippet.frames.length === 0) {
    throw new Error('createSnippetPlayer: snippet has no frames');
  }
  const lastIndex = snippet.frames.length - 1;
  let idx = 0;
  return {
    get currentFrame() { return snippet.frames[idx]; },
    get frameIndex() { return idx; },
    get done() { return idx === lastIndex; },
    forward() {
      if (idx >= lastIndex) return false;
      idx += 1;
      return true;
    },
    back() {
      if (idx <= 0) return false;
      idx -= 1;
      return true;
    },
    reset() { idx = 0; },
    goTo(target: number) {
      if (!Number.isInteger(target) || target < 0 || target > lastIndex) {
        throw new RangeError(
          `createSnippetPlayer.goTo: frame index ${target} out of bounds [0, ${lastIndex}]`,
        );
      }
      idx = target;
    },
  };
}
