import type { Frame, Snippet } from './types';

/**
 * Pure-state playback driver for a `Snippet` produced by `recordSnippet`.
 *
 * Holds the current frame index and exposes `forward` / `back` / `reset` /
 * `goTo`. Stateless w.r.t. wall-clock — consumers wire their own ticking
 * (`setInterval`, `requestAnimationFrame`, `IntersectionObserver`, etc.).
 * Renderer-agnostic — consumers read `currentFrame` and apply it however
 * they like (e.g. `applyHighlight(snippet.graph, frame.highlight, ops)`
 * for state-graph highlight, plus app-specific tape rendering).
 *
 * Two players over the same `Snippet` are independent — frame storage is
 * shared and read-only.
 *
 * Mirrors the engine's `DebugSession` shape (a stateful playback driver
 * for live runs); this is the analogous driver for prerecorded runs.
 */
export class SnippetPlayer {
  readonly #snippet: Snippet;
  readonly #lastIndex: number;
  #index = 0;

  constructor(snippet: Snippet) {
    if (snippet.frames.length === 0) {
      throw new Error('SnippetPlayer: snippet has no frames');
    }
    this.#snippet = snippet;
    this.#lastIndex = snippet.frames.length - 1;
  }

  /** The frame at the current index. Live getter — re-reads on every access. */
  get currentFrame(): Frame {
    return this.#snippet.frames[this.#index];
  }

  /** Current frame index (0 = initial state, `snippet.frames.length - 1` = final). */
  get frameIndex(): number {
    return this.#index;
  }

  /** True when `frameIndex === snippet.frames.length - 1`. */
  get done(): boolean {
    return this.#index === this.#lastIndex;
  }

  /**
   * Advance one frame. Returns `true` if advanced, `false` if already at the
   * last frame (no-op in that case).
   */
  forward(): boolean {
    if (this.#index >= this.#lastIndex) return false;
    this.#index += 1;
    return true;
  }

  /**
   * Retreat one frame. Returns `true` if retreated, `false` if already at
   * the first frame (no-op in that case).
   */
  back(): boolean {
    if (this.#index <= 0) return false;
    this.#index -= 1;
    return true;
  }

  /** Jump to frame 0. */
  reset(): void {
    this.#index = 0;
  }

  /**
   * Jump to a specific frame index. Throws `RangeError` if out of bounds
   * (negative, beyond the last frame, or not an integer).
   */
  goTo(frameIndex: number): void {
    if (!Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex > this.#lastIndex) {
      throw new RangeError(
        `SnippetPlayer.goTo: frame index ${frameIndex} out of bounds [0, ${this.#lastIndex}]`,
      );
    }
    this.#index = frameIndex;
  }
}
