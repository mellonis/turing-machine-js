/**
 * Per-tape wire-data snapshot — the cells visible/usable plus the head's
 * index into them. Pure data; no library handles.
 *
 * Produced by callers serializing a live `Tape` for transmission (worker
 * boundaries, snippet recording, snapshot tests). The engine's own
 * `Tape.viewport` getter operates on the live, internally-int-encoded
 * tape rather than on a `TapeSnapshot` — so it doesn't currently call
 * `tapeViewport` internally. The two surfaces serve different inputs
 * (string snapshot vs live int-encoded tape) and are not direct duplicates.
 */
export type TapeSnapshot = {
  symbols: string[];
  position: number;
};

/**
 * Compute a fixed-width window of tape cells centered on the head.
 *
 * The engine's `Tape` class exposes a `viewport` getter that does this for
 * the live tape; `tapeViewport` is the equivalent for the wire-data
 * `TapeSnapshot`. Cells outside the snapshot's `symbols` array are padded
 * with `blank`, so the result always has exactly `width` entries.
 *
 * The returned `headIndex` is the head's index within `cells` —
 * deterministic at `Math.floor(width / 2)`, but exposed for callers that
 * want to avoid recomputing it (and to leave room for future non-centered
 * policies without a signature break).
 *
 * Pass the alphabet's blank symbol as `blank`.
 */
export function tapeViewport(
  snapshot: TapeSnapshot,
  width: number,
  blank: string,
): { cells: string[]; headIndex: number } {
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError(
      `tapeViewport: width must be a positive integer (got ${width})`,
    );
  }
  const half = Math.floor(width / 2);
  const startTapeIdx = snapshot.position - half;
  const cells: string[] = new Array(width);
  for (let i = 0; i < width; i += 1) {
    const tapeIdx = startTapeIdx + i;
    cells[i] =
      tapeIdx >= 0 && tapeIdx < snapshot.symbols.length
        ? snapshot.symbols[tapeIdx]
        : blank;
  }
  return { cells, headIndex: half };
}
