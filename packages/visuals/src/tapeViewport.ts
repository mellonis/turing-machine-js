import type { TapeSnapshot } from './types';

/**
 * Compute a fixed-width window of tape cells centered on the head.
 *
 * The engine's `Tape` class exposes a `viewport` getter that does this for
 * the live tape; `tapeViewport` is the equivalent for the wire-data
 * `TapeSnapshot` carried in `Frame.tape`. Cells outside the snapshot's
 * `symbols` array are padded with `blank`, so the result always has
 * exactly `width` entries.
 *
 * The returned `headIndex` is the head's index within `cells` —
 * deterministic at `Math.floor(width / 2)`, but exposed for callers that
 * want to avoid recomputing it (and to leave room for future non-centered
 * policies without a signature break).
 *
 * Pass the tape's blank symbol from `Snippet.alphabets[i]` (by convention
 * the first entry per tape in the visuals/engine pipeline — verify against
 * how the snippet was recorded).
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
