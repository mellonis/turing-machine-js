import { movements, symbolCommands, type MachineState, type TapeCommand } from '@turing-machine-js/machine';
import type { TapeSnapshot } from './types';

/**
 * Plain per-tape command shape consumed by `formatStepNotation`. Distinct
 * from the engine's `TapeCommand` class: `symbol === null` means "keep
 * current" (the resolved symbol equals what was already under the head),
 * `movement` is the role letter (not an engine symbol). Matches the shape
 * machines-demo exposes from its worker boundary.
 */
export type StepCommand = {
  movement: 'L' | 'R' | 'S';
  symbol: string | null;
};

export const MOVEMENT_LETTER = new Map<symbol, 'L' | 'R' | 'S'>([
  [movements.left, 'L'],
  [movements.right, 'R'],
  [movements.stay, 'S'],
]);

/**
 * Render a single tape command in `WRITE/MOVE` form.
 * - Write: `'X'` (literal symbol) | `K` (keep) | `E` (erase = write blank).
 * - Move: `L` / `R` / `S` from `movements.*`.
 *
 * Matches the engine's edge-label vocabulary so formatted commands line up
 * with the write/move cells in `toMermaid`-emitted edge labels.
 */
export function formatCommand(tapeCommand: TapeCommand): string {
  let write: string;

  if (tapeCommand.symbol === symbolCommands.keep) {
    write = 'K';
  } else if (tapeCommand.symbol === symbolCommands.erase) {
    write = 'E';
  } else {
    write = `'${tapeCommand.symbol as string}'`;
  }

  const move = MOVEMENT_LETTER.get(tapeCommand.movement) ?? '?';

  return `${write}/${move}`;
}

/**
 * Render one step's edge-label notation: `[reads] → [writes]/[moves]`.
 * Each role is wrapped in a single `[…]`; multi-tape entries are
 * comma-separated inside the brackets.
 *
 * Matches the engine's `toMermaid` emit so logged steps line up with
 * graph edge labels. Note: `nextSymbols` in `MachineState` is already
 * resolved (keep → current symbol, erase → blank) — `K` is inferred
 * by comparing `nextSymbols[i] === currentSymbols[i]`.
 */
export function formatStep(m: MachineState): string {
  const reads = m.currentSymbols.map((s) => `'${s}'`).join(',');
  const writes = m.nextSymbols
    .map((s, i) => (s === m.currentSymbols[i] ? 'K' : `'${s}'`))
    .join(',');
  const moves = m.movements.map((mv) => MOVEMENT_LETTER.get(mv) ?? '?').join(',');

  return `[${reads}] → [${writes}]/[${moves}]`;
}

/**
 * Engine edge-label format — `[reads] → [writes]/[moves]`. Matches
 * `toMermaid` emit byte-for-byte so a logged step's notation lines up with
 * the same transition's edge label in the rendered state graph.
 *
 * Per-cell encoding:
 * - Read cell: `'X'` (literal) | `B` (blank, NON-wildcard only) | `*='X'`
 *   (wildcard — shows what `ifOtherSymbol` caught; the `B` shortcut is
 *   suppressed for wildcards so the matched literal is always visible).
 * - Write cell: `'X'` (literal) | `K='X'` (keep, with concrete read
 *   appended) | `K=B` (keep, read was blank) | `K` (keep, no read context
 *   — only when `reads === null`) | `E` (erase, write equals blank).
 * - Move cell: `L` | `R` | `S`.
 *
 * Multi-tape: per-tape entries comma-separated inside one outer bracket
 * per role — `['1','a'] → ['0','b']/[R,L]`.
 *
 * Pass `reads === null` for the manual-Apply path (no transition fired):
 * output collapses to `[writes]/[moves]` and `K` renders without read
 * context. Pass `matchKinds === null`/omit when no transition fired:
 * every position renders as a literal (no wildcard markers).
 */
export function formatStepNotation(
  reads: readonly string[] | null,
  commands: readonly StepCommand[],
  blanks: readonly string[],
  matchKinds?: readonly ('wildcard' | 'literal')[] | null,
): string {
  const writes = commands
    .map((c, i) => {
      if (c.symbol === null) {
        if (reads !== null) {
          const r = reads[i];
          if (r !== undefined) return r === blanks[i] ? 'K=B' : `K='${r}'`;
        }
        return 'K';
      }
      if (c.symbol === blanks[i]) return 'E';
      return `'${c.symbol}'`;
    })
    .join(',');
  const moves = commands.map((c) => c.movement).join(',');
  const writesPart = `[${writes}]/[${moves}]`;

  if (reads === null) return writesPart;

  const readsStr = reads
    .map((r, i) => {
      if (matchKinds?.[i] === 'wildcard') return `*='${r}'`;
      return r === blanks[i] ? 'B' : `'${r}'`;
    })
    .join(',');
  return `[${readsStr}] → ${writesPart}`;
}

/** Inline tape rendering with the head bracketed in place (`a[b]c`).
 *  No UI substitution — the user controls the blank glyph. `[<blank>]`
 *  may render an invisible space if blank is `' '`; that's the chosen
 *  symbol, not a bug. */
export function formatTape(tape: TapeSnapshot): string {
  return tape.symbols
    .map((sym, i) => (i === tape.position ? `[${sym}]` : sym))
    .join('');
}
