import { movements, symbolCommands, type MachineState, type TapeCommand } from '@turing-machine-js/machine';

const MOVEMENT_LETTER = new Map<symbol, string>([
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
