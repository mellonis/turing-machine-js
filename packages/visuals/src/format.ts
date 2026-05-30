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
 * Per-tape read-cell token. Discriminated union for renderer-agnostic
 * consumption — UIs map each variant to their own presentation (plain
 * string via `formatStepNotation`, HTML span with CSS class, ANSI color,
 * clickable token, etc.). `formatStepNotation` is the default string
 * renderer over these tokens.
 *
 * - `literal` — the engine matched this exact symbol non-wildcard.
 * - `blank` — the matched symbol is the tape's blank glyph; renderers
 *   commonly want a `B`-style shortcut instead of `' '`.
 * - `wildcard` — the engine matched via `ifOtherSymbol`. The literal
 *   `symbol` is preserved so renderers can show what the catch-all
 *   actually caught (a blank-shortcut would obscure it).
 */
export type ReadToken =
  | { kind: 'literal'; symbol: string }
  | { kind: 'blank' }
  | { kind: 'wildcard'; symbol: string };

/**
 * Per-tape write-cell token.
 *
 * - `literal` — engine wrote this exact symbol; not a blank, not a keep.
 * - `erase` — engine wrote the tape's blank glyph; rendered as `E` by
 *   `formatStepNotation` but structurally distinct from a generic blank
 *   write so renderers can style "erase" differently from "write blank as
 *   the next interesting symbol."
 * - `keep` — engine left the cell unchanged (`command.symbol === null`).
 *   `readContext` carries the kept symbol when caller supplied `reads`;
 *   `isBlank` flags whether the kept symbol equals the tape's blank glyph.
 *   No `readContext` means manual-Apply path (no transition fired, no
 *   per-tape read available).
 */
export type WriteToken =
  | { kind: 'literal'; symbol: string }
  | { kind: 'erase' }
  | { kind: 'keep'; readContext?: { symbol: string; isBlank: boolean } };

/**
 * Structured-token representation of one step. `formatStepNotation` is the
 * default string renderer over this shape; consumers wanting custom
 * rendering (HTML spans, alternative vocabulary, clickable cells, ANSI
 * colors) call `tokenizeStep` and walk the tokens themselves.
 *
 * `reads === null` denotes the manual-Apply path (no transition fired);
 * all read-side encoding is suppressed and `keep` writes carry no
 * `readContext`.
 */
export type StepTokens = {
  reads: readonly ReadToken[] | null;
  writes: readonly WriteToken[];
  moves: readonly ('L' | 'R' | 'S')[];
};

/**
 * Tokenize one step's per-tape data into renderer-agnostic structured
 * form. Same input contract as `formatStepNotation` — same engine
 * vocabulary, same null-`reads` manual-Apply handling, same wildcard
 * suppression of the blank shortcut. Use this when you need to render the
 * step in a non-string medium (HTML, terminal escape codes, JSON for
 * embeds) or just want different syntax than the default string output.
 */
export function tokenizeStep(
  reads: readonly string[] | null,
  commands: readonly StepCommand[],
  blanks: readonly string[],
  matchKinds?: readonly ('wildcard' | 'literal')[] | null,
): StepTokens {
  const writes: WriteToken[] = commands.map((c, i) => {
    if (c.symbol === null) {
      if (reads !== null) {
        const r = reads[i];
        if (r !== undefined) {
          return { kind: 'keep', readContext: { symbol: r, isBlank: r === blanks[i] } };
        }
      }
      return { kind: 'keep' };
    }
    if (c.symbol === blanks[i]) return { kind: 'erase' };
    return { kind: 'literal', symbol: c.symbol };
  });

  const moves = commands.map((c) => c.movement);

  if (reads === null) {
    return { reads: null, writes, moves };
  }

  const readTokens: ReadToken[] = reads.map((r, i) => {
    if (matchKinds?.[i] === 'wildcard') return { kind: 'wildcard', symbol: r };
    if (r === blanks[i]) return { kind: 'blank' };
    return { kind: 'literal', symbol: r };
  });

  return { reads: readTokens, writes, moves };
}

function renderReadToken(t: ReadToken): string {
  if (t.kind === 'wildcard') return `*='${t.symbol}'`;
  if (t.kind === 'blank') return 'B';
  return `'${t.symbol}'`;
}

function renderWriteToken(t: WriteToken): string {
  if (t.kind === 'erase') return 'E';
  if (t.kind === 'literal') return `'${t.symbol}'`;
  if (!t.readContext) return 'K';
  if (t.readContext.isBlank) return 'K=B';
  return `K='${t.readContext.symbol}'`;
}

/**
 * Engine edge-label format — `[reads] → [writes]/[moves]`. Matches
 * `toMermaid` emit byte-for-byte so a logged step's notation lines up with
 * the same transition's edge label in the rendered state graph. Thin
 * string renderer over `tokenizeStep`; see that function's docstring +
 * `StepTokens` for the structured form most UIs should prefer.
 *
 * Per-cell rendering:
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
 * Pass `reads === null` for the manual-Apply path: output collapses to
 * `[writes]/[moves]` and `K` renders without read context. Pass
 * `matchKinds === null`/omit when no transition fired: every position
 * renders as a literal (no wildcard markers).
 */
export function formatStepNotation(
  reads: readonly string[] | null,
  commands: readonly StepCommand[],
  blanks: readonly string[],
  matchKinds?: readonly ('wildcard' | 'literal')[] | null,
): string {
  const tokens = tokenizeStep(reads, commands, blanks, matchKinds);
  const writesStr = tokens.writes.map(renderWriteToken).join(',');
  const movesStr = tokens.moves.join(',');
  const writesPart = `[${writesStr}]/[${movesStr}]`;
  if (tokens.reads === null) return writesPart;
  const readsStr = tokens.reads.map(renderReadToken).join(',');
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
