import {movements, symbolCommands} from '../classes/TapeCommand';

export type GraphCommand = { symbol: string; movement: string };

export type GraphTransition = {
  pattern: string;
  command: GraphCommand[];
  nextStateId: number;
  // Stable per-edge identifier: `${fromNodeId}.${patternIx}` where patternIx
  // is the transition's position in the source state's symbol map. Lets
  // downstream rendering target a specific edge in the Mermaid SVG.
  id: string;
};

export type GraphNode = {
  id: number;
  name: string;
  isHalt: boolean;
  transitions: GraphTransition[];
  // On wrapper nodes (`isWrapper: true`), the id of the override target's
  // GraphNode (could be a wrapper or a regular state). `null` on non-wrapper
  // nodes (their override semantics live in the wrapper that wraps them, if
  // any).
  overriddenHaltStateId: number | null;
  // `true` for external `[[…]]` wrapper nodes — the call sites that
  // `withOverriddenHaltState` produces. Wrappers sit OUTSIDE any callable
  // subtree subgraph; their `bareStateId` points to the bare's GraphNode id
  // (which lives inside its home subtree). Multiple wrappers can share the
  // same `bareStateId` when they wrap the same bare with different overrides.
  // Wrapper nodes have NO transitions of their own — the `call` arrow into
  // the bare is derived from `bareStateId`, the post-return `-->` arrow to
  // the override is derived from `overriddenHaltStateId`.
  isWrapper: boolean;
  // On wrappers, the id of the bare GraphNode this wrapper wraps. `null`
  // for non-wrapper nodes.
  bareStateId: number | null;
  // The id of the callable subtree this node lives in. `null` for nodes
  // outside any subtree (top-level states, real halt singleton, wrapper
  // nodes themselves, the `idle` visualization sentinel). Set on bares,
  // body states reachable from any bare, and halt markers. Two bares may
  // share a `frameId` when union-find merges their reachable sets (shared
  // body state forces a union frame; see spec Example "Shared body state").
  // The canonical frame id is the smallest bare-id in the component.
  frameId: number | null;
  // `true` for a synthesized halt marker graph node — one per frame.
  // Real halt has `isHalt: true, isHaltMarker: false`; halt markers have
  // both `true`. `fromGraph` maps halt-marker nodes back to the singleton
  // `haltState`. Halt marker id = `-frameId` (sits in disjoint negative-id
  // range from real node ids).
  isHaltMarker: boolean;
  // Out-of-band tags applied to this State (#186). Empty array if untagged.
  // Survives `toGraph`/`fromGraph` round-trip and renders in `toMermaid` as
  // `classDef tag_<name>` + `class sN tag_<name>` lines. Doesn't affect
  // runtime semantics — purely a visualization/debugger-tooling channel.
  tags: string[];
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
  'keep symbol command': 'K',
  'erase symbol command': 'E',
};

// Reserved characters in the encoded pattern string:
//   '*'  ASCII asterisk (U+002A) — per-cell ifOtherSymbol, matches any symbol
//        on that tape. ASCII (not a fancier glyph like U+1F7B0) so it renders
//        in every Mermaid environment and every monospace font. A literal `*`
//        in the alphabet is unambiguous from the marker because it's quoted
//        (`'*'`).
//   'B'  the tape's blank symbol shorthand (in read patterns). A literal `B`
//        in the alphabet is unambiguous from the marker because it's quoted
//        (`'B'`).
//   ','  separates per-tape cells inside one pattern
//   '|'  separates alternative patterns
//   "'"  surrounds a literal alphabet symbol — e.g. `'0'` for literal `0`,
//        `'X'` for literal `X`. The quoting is what visually separates literal
//        symbols from the convention markers `*` / `B` and from the write
//        commands `K` / `E`.
//   '\\' escape prefix — to represent any of '*', 'B', ',', '|', "'", or '\\'
//        as a *literal* alphabet symbol *inside* the quotes (e.g. `'\''` for
//        a literal apostrophe).
const IF_OTHER_MARKER = '*';
const BLANK_MARKER = 'B';

function escapeAlphabetSymbol(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
}

export function decodePatternDescription(
  description: string | undefined,
  alphabets: string[][],
): string {
  if (!description) {
    return '?';
  }

  if (description === 'other symbol') {
    return IF_OTHER_MARKER;
  }

  try {
    const patternList: (string | null)[][] = JSON.parse(description);

    return patternList
      .map((pattern) => pattern
        .map((s, tapeIx) => {
          if (s === null) {
            return IF_OTHER_MARKER;
          }

          if (s === alphabets[tapeIx]?.[0]) {
            return BLANK_MARKER;
          }

          return `'${escapeAlphabetSymbol(s)}'`;
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
  if (s === IF_OTHER_MARKER) {
    return null;
  }

  const alternatives = splitUnescaped(s, '|');

  return alternatives.map((alt) => {
    const cells = splitUnescaped(alt, ',');

    return cells.map((cell, tapeIx) => {
      if (cell === IF_OTHER_MARKER) {
        return null;
      }

      if (cell === BLANK_MARKER) {
        return alphabets[tapeIx]?.[0] ?? cell;
      }

      // Literal alphabet symbols are wrapped in single quotes by
      // `decodePatternDescription` — strip them on the way back.
      if (cell.length >= 2 && cell.startsWith("'") && cell.endsWith("'")) {
        return cell.slice(1, -1);
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
  if (label === 'K') {
    return symbolCommands.keep;
  }

  if (label === 'E') {
    return symbolCommands.erase;
  }

  // Literal alphabet symbols are wrapped in single quotes by
  // `decodeWriteSymbol` — strip them on the way back.
  if (label.length >= 2 && label.startsWith("'") && label.endsWith("'")) {
    return label.slice(1, -1);
  }

  return label;
}

export function decodeWriteSymbol(symbol: string | symbol): string {
  if (typeof symbol === 'symbol') {
    const description = symbol.description ?? '?';

    return symbolCommandDescriptionToLabel[description] ?? description;
  }

  return `'${symbol}'`;
}

// Format converters (toMermaid / fromMermaid) live in ./graphFormats.
