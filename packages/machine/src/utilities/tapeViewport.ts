/**
 * Per-tape wire-data snapshot — the cells visible/usable plus the head's
 * index into them. Pure data; no library handles.
 *
 * Produced by callers serializing a live `Tape` for transmission (worker
 * boundaries, snippet recording, snapshot tests).
 */
export type TapeSnapshot = {
  symbols: string[];
  position: number;
};

/**
 * @internal — centering loop shared by the public `tapeViewport(snapshot, …)`
 * helper AND the engine's `Tape.viewport` getter. Snapshot consumers pass a
 * bounds-checking lambda over `symbols` + a `blank` fallback; the live `Tape`
 * passes its own internal `cellAt` that does int → string via `Alphabet.get`.
 *
 * Each path picks its own data shape; the centering math lives once here.
 */
export function tapeViewportFromAccess(
  position: number,
  width: number,
  cellAt: (idx: number) => string,
): { cells: string[]; headIndex: number } {
  if (!Number.isInteger(width) || width <= 0) {
    throw new RangeError(
      `tapeViewport: width must be a positive integer (got ${width})`,
    );
  }
  const half = Math.floor(width / 2);
  const startTapeIdx = position - half;
  const cells: string[] = new Array(width);
  for (let i = 0; i < width; i += 1) {
    cells[i] = cellAt(startTapeIdx + i);
  }
  return { cells, headIndex: half };
}

/**
 * Compute a fixed-width window of tape cells centered on the head.
 *
 * The engine's `Tape` class exposes a `viewport` getter that does this for
 * the live tape (sharing the same internal centering core); `tapeViewport`
 * is the equivalent for the wire-data `TapeSnapshot`. Cells outside the
 * snapshot's `symbols` array are padded with `blank`, so the result always
 * has exactly `width` entries.
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
  return tapeViewportFromAccess(snapshot.position, width, (i) =>
    i >= 0 && i < snapshot.symbols.length ? snapshot.symbols[i] : blank,
  );
}
