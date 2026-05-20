import {movements, symbolCommands} from '../classes/TapeCommand';

export type GraphCommand = { symbol: string; movement: string };

export type GraphTransition = {
  pattern: string;
  command: GraphCommand[];
  nextStateId: number;
  // Stable, deterministic per-edge identifier. Format: `${fromNodeId}-${patternIx}`
  // where `patternIx` is the transition's position in the source state's symbol
  // map. Let's downstream rendering (machines-demo #10) target a specific edge in
  // the rendered Mermaid SVG to highlight "the edge that will fire next."
  id: string;
};

export type GraphNode = {
  id: number;
  name: string;
  isHalt: boolean;
  transitions: GraphTransition[];
  overriddenHaltStateId: number | null;
  // `true` when this node represents the bare of a `withOverriddenHaltState`-
  // wrapped state. Carries the `[[…]]` (subroutine) shape signal for `toMermaid`
  // and tells `fromGraph` to reconstruct via `bare.withOverriddenHaltState(target)`.
  isWrapped: boolean;
  // `true` for a synthesized halt-clone graph node — one per wrapper context.
  // Real halt has `isHalt: true, isClonedHalt: false`; cloned halts have both
  // `true`. `fromGraph` maps cloned-halt nodes back to the singleton `haltState`.
  isClonedHalt: boolean;
};

export type Graph = {
  initialId: number;
  alphabets: string[][];
  nodes: Record<number, GraphNode>;
};

const movementDescriptionToLabel: Record<string, string> = {
  'move caret left command': 'L',
  'move caret right command': 'R',
  'do not move carer': 'S',
};

const symbolCommandDescriptionToLabel: Record<string, string> = {
  'keep symbol command': '·',
  'erase symbol command': '⌫',
};

// Reserved characters in the encoded pattern string:
//   '*'  per-cell ifOtherSymbol (matches any symbol on that tape)
//   '-'  the tape's blank symbol
//   ','  separates per-tape cells inside one pattern
//   '|'  separates alternative patterns
//   '\\' escape prefix — to represent any of '*', '-', ',', '|', or '\\' as a
//        *literal* alphabet symbol, prefix it with '\\' (e.g. '\\*' for literal '*').
function escapeAlphabetSymbol(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\*/g, '\\*')
    .replace(/-/g, '\\-')
    .replace(/,/g, '\\,')
    .replace(/\|/g, '\\|');
}

export function decodePatternDescription(
  description: string | undefined,
  alphabets: string[][],
): string {
  if (!description) {
    return '?';
  }

  if (description === 'other symbol') {
    return '*';
  }

  try {
    const patternList: (string | null)[][] = JSON.parse(description);

    return patternList
      .map((pattern) => pattern
        .map((s, tapeIx) => {
          if (s === null) {
            return '*';
          }

          if (s === alphabets[tapeIx]?.[0]) {
            return '-';
          }

          return escapeAlphabetSymbol(s);
        })
        .join(','))
      .join('|');
  } catch {
    return description;
  }
}

export function decodeMovement(description: string | undefined): string {
  if (!description) {
    return '?';
  }

  return movementDescriptionToLabel[description] ?? description;
}

// Inverse of decodePatternDescription: returns either `null` (for the global
// `ifOtherSymbol` case) or a list of patterns where each cell is `null` for
// per-cell ifOtherSymbol or the actual literal symbol string.
export type ParsedPattern = null | (string | null)[][];

export function splitUnescaped(s: string, sep: string): string[] {
  const parts: string[] = [];
  let current = '';
  let i = 0;

  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length) {
      current += s[i + 1];
      i += 2;
    } else if (s[i] === sep) {
      parts.push(current);
      current = '';
      i += 1;
    } else {
      current += s[i];
      i += 1;
    }
  }

  parts.push(current);

  return parts;
}

export function parsePatternString(s: string, alphabets: string[][]): ParsedPattern {
  if (s === '*') {
    return null;
  }

  const alternatives = splitUnescaped(s, '|');

  return alternatives.map((alt) => {
    const cells = splitUnescaped(alt, ',');

    return cells.map((cell, tapeIx) => {
      if (cell === '*') {
        return null;
      }

      if (cell === '-') {
        return alphabets[tapeIx]?.[0] ?? cell;
      }

      return cell;
    });
  });
}

const movementLabelToSymbol: Record<string, symbol> = {
  L: movements.left,
  R: movements.right,
  S: movements.stay,
};

export function parseMovementLabel(label: string): symbol {
  const m = movementLabelToSymbol[label];

  if (!m) {
    throw new Error(`unknown movement label: ${label}`);
  }

  return m;
}

export function parseWriteSymbolLabel(label: string): string | symbol {
  if (label === '·') {
    return symbolCommands.keep;
  }

  if (label === '⌫') {
    return symbolCommands.erase;
  }

  return label;
}

export function decodeWriteSymbol(symbol: string | symbol): string {
  if (typeof symbol === 'symbol') {
    const description = symbol.description ?? '?';

    return symbolCommandDescriptionToLabel[description] ?? description;
  }

  return symbol;
}

// Format converters (toMermaid / fromMermaid) live in ./graphFormats.
