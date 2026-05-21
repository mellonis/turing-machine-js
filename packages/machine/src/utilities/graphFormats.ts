import {type Graph, type GraphCommand, type GraphNode} from './graph';

// Format converters between a Graph (the data model produced by State.toGraph
// and consumed by State.fromGraph) and external string representations.
//
// Currently only Mermaid flowchart syntax is supported. Future formats
// (Graphviz, JSON-LD, custom DSL) belong here too.
//
// v7 callable-subtree emit (#174):
//   - Each `withOverriddenHaltState` wrapper produces TWO graph nodes — a
//     wrapper node (`[[composite-name]]`, OUTSIDE any subgraph) and a bare
//     node (regular shape, INSIDE its callable subtree subgraph).
//   - Subgraphs (one per frame): `subgraph w_${frameId}["callable subtree
//     of NAME"]` (single bare) or `["callable scope: A ∪ B"]` (union).
//   - Each frame has exactly one halt marker `c${frameId}(((halt)))` inside
//     its subgraph; halt-bound transitions from in-frame states retarget to
//     it. Always emitted (orphan signals dead wrapper).
//   - Arrow conventions:
//       solid `-->`        regular transitions, including wrapper-to-override.
//       bold  `==>`        RESERVED for the wrapper-to-bare `call` arrow.
//                          `&` ribbon collapses multi-wrapper-shares-bare.
//       dotted `-.->`      frame-level dispatch (`return`, `halt`, `enter`).
//   - The `return` arrow (subgraph → wrapper) is demand-emitted iff the
//     frame's halt marker has at least one incoming edge AND the wrapper
//     calls into the frame. The `halt` arrow (subgraph → s0) is emitted
//     iff the halt marker has incoming AND there's at least one non-wrapper
//     entry into the frame (cross-subgraph solid arrow from outside).

// Maps a graph node id to its Mermaid id.
//   - non-negative id N  → "sN"
//   - negative id -N (halt marker) → "cN"
function mermaidIdFor(id: number): string {
  return id < 0 ? `c${-id}` : `s${id}`;
}

// Inverse of mermaidIdFor.
function parseMermaidId(s: string): number {
  if (s.startsWith('c')) {
    return -Number(s.slice(1));
  }

  return Number(s.slice(1));
}

function frameSubgraphId(frameId: number): string {
  return `w_${frameId}`;
}

export function toMermaid(graph: Graph): string {
  const lines: string[] = [
    'flowchart TD',
    `%% alphabets: ${JSON.stringify(graph.alphabets)}`,
  ];

  // Sort nodes by id ascending — real halt (0) first, then regulars by their
  // ids, then halt markers (negative) at the end. Deterministic emit lets
  // toMermaid → fromMermaid → toMermaid round-trip stably (#139).
  const nodes = Object.values(graph.nodes).slice().sort((a, b) => a.id - b.id);

  // Bucket nodes for emit order.
  const topLevelNodes = nodes.filter((n) => n.frameId === null && !n.isWrapper);
  const wrapperNodes = nodes.filter((n) => n.isWrapper);
  // Bares-and-bodies inside frames, grouped by frameId.
  const nodesByFrame = new Map<number, GraphNode[]>();
  // Halt-marker per frame (kept separate so it always emits LAST inside the
  // subgraph for deterministic shape).
  const haltMarkerByFrame = new Map<number, GraphNode>();

  for (const node of nodes) {
    if (node.frameId === null || node.isWrapper) continue;

    if (node.isHaltMarker) {
      haltMarkerByFrame.set(node.frameId, node);
    } else {
      let bucket = nodesByFrame.get(node.frameId);

      if (!bucket) {
        bucket = [];
        nodesByFrame.set(node.frameId, bucket);
      }

      bucket.push(node);
    }
  }

  // 1. Emit top-level nodes (real halt, non-wrapper regulars outside any frame).
  for (const node of topLevelNodes) {
    const mid = mermaidIdFor(node.id);

    if (node.isHalt) {
      lines.push(`  ${mid}(((halt)))`);
    } else {
      lines.push(`  ${mid}["${node.name}"]`);
    }
  }

  // 2. Emit wrappers at top level.
  for (const wrapper of wrapperNodes) {
    lines.push(`  ${mermaidIdFor(wrapper.id)}[["${wrapper.name}"]]`);
  }

  // 3. `idle` sentinel.
  lines.push('  idle([idle])');

  // 4. Subgraph per frame.
  const frameIds = [...nodesByFrame.keys()].sort((a, b) => a - b);

  for (const frameId of frameIds) {
    const frameBares = (nodesByFrame.get(frameId) ?? []).filter(
      (n) => isFrameBare(n, graph),
    );
    const frameBareNames = frameBares
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((n) => n.name);
    const label = frameBareNames.length > 1
      ? `callable scope: ${frameBareNames.join(' ∪ ')}`
      : `callable subtree of ${frameBareNames[0] ?? frameId}`;

    lines.push(`  subgraph ${frameSubgraphId(frameId)}["${label}"]`);

    // Inner nodes — sort by id for determinism.
    for (const node of (nodesByFrame.get(frameId) ?? []).slice().sort((a, b) => a.id - b.id)) {
      lines.push(`    ${mermaidIdFor(node.id)}["${node.name}"]`);
    }

    const haltMarker = haltMarkerByFrame.get(frameId);

    if (haltMarker) {
      lines.push(`    ${mermaidIdFor(haltMarker.id)}(((halt)))`);
    }

    lines.push('  end');
  }

  // 5. Enter arrow.
  lines.push(`  idle -. enter .-> ${mermaidIdFor(graph.initialId)}`);

  // 6. `call` arrows — grouped by bare (multi-wrapper-shares-bare collapses
  // into a single `&` ribbon).
  const wrappersByBare = new Map<number, GraphNode[]>();

  for (const wrapper of wrapperNodes) {
    if (wrapper.bareStateId === null) continue;

    let group = wrappersByBare.get(wrapper.bareStateId);

    if (!group) {
      group = [];
      wrappersByBare.set(wrapper.bareStateId, group);
    }

    group.push(wrapper);
  }

  const sortedBares = [...wrappersByBare.keys()].sort((a, b) => a - b);

  for (const bareId of sortedBares) {
    const wrappers = wrappersByBare.get(bareId)!.slice().sort((a, b) => a.id - b.id);
    const sources = wrappers.map((w) => mermaidIdFor(w.id)).join(' & ');

    lines.push(`  ${sources} == "call" ==> ${mermaidIdFor(bareId)}`);
  }

  // 7. Demand-emit `return` and `halt` arrows per frame.
  // For each frame: check if its halt marker has incoming transitions.
  const haltMarkerHasIncoming = new Map<number, boolean>();

  for (const node of nodes) {
    for (const t of node.transitions) {
      const target = graph.nodes[t.nextStateId];

      if (target && target.isHaltMarker && target.frameId !== null) {
        haltMarkerHasIncoming.set(target.frameId, true);
      }
    }
  }

  // For each frame: check if there's at least one non-wrapper entry (a solid
  // `-->` from OUTSIDE the frame into any node INSIDE).
  const hasNonWrapperEntry = new Map<number, boolean>();

  for (const node of nodes) {
    if (node.isWrapper) continue;

    for (const t of node.transitions) {
      const target = graph.nodes[t.nextStateId];

      if (
        target
        && target.frameId !== null
        && node.frameId !== target.frameId
      ) {
        hasNonWrapperEntry.set(target.frameId, true);
      }
    }
  }

  for (const frameId of frameIds) {
    if (!haltMarkerHasIncoming.get(frameId)) continue;

    // Return arrow — collapsed `&` ribbon over all wrappers calling this frame.
    const callingWrappers = wrapperNodes.filter((w) => {
      if (w.bareStateId === null) return false;

      const bare = graph.nodes[w.bareStateId];

      return !!bare && bare.frameId === frameId;
    });

    if (callingWrappers.length > 0) {
      const targets = callingWrappers
        .slice()
        .sort((a, b) => a.id - b.id)
        .map((w) => mermaidIdFor(w.id))
        .join(' & ');

      lines.push(`  ${frameSubgraphId(frameId)} -. "return" .-> ${targets}`);
    }

    if (hasNonWrapperEntry.get(frameId)) {
      lines.push(`  ${frameSubgraphId(frameId)} -. "halt" .-> s0`);
    }
  }

  // 8. Wrapper-to-override arrows (regular solid).
  for (const wrapper of wrapperNodes) {
    if (wrapper.overriddenHaltStateId === null) continue;

    lines.push(
      `  ${mermaidIdFor(wrapper.id)} --> ${mermaidIdFor(wrapper.overriddenHaltStateId)}`,
    );
  }

  // 9. Regular transitions for non-wrapper non-halt-marker non-halt nodes.
  for (const node of nodes) {
    if (node.isHalt || node.isHaltMarker || node.isWrapper) continue;

    for (const t of node.transitions) {
      const alternatives = t.pattern.split('|');
      const reads = alternatives.map((alt) => `[${alt}]`).join('|');
      const writes = `[${t.command.map((c) => c.symbol).join(',')}]`;
      const moves = `[${t.command.map((c) => c.movement).join(',')}]`;
      const label = `${reads} → ${writes}/${moves}`;

      lines.push(
        `  ${mermaidIdFor(node.id)} -- "${label}" --> ${mermaidIdFor(t.nextStateId)}`,
      );
    }
  }

  return lines.join('\n');
}

// Helper: identify "the bare states" that anchor a frame's name. A bare is a
// node referenced as some wrapper's `bareStateId`. Body states (also in-frame
// but not bare) are excluded from the frame label.
function isFrameBare(node: GraphNode, graph: Graph): boolean {
  if (node.isWrapper || node.isHalt) return false;

  for (const other of Object.values(graph.nodes)) {
    if (other.isWrapper && other.bareStateId === node.id) {
      return true;
    }
  }

  return false;
}

// Inverse of toMermaid: parses the Mermaid output produced by toMermaid back
// into a Graph. The parser is strict to the dialect toMermaid emits — it
// recognises the specific node/edge shapes and the leading
// `%% alphabets: [...]` comment. Hand-edited Mermaid that uses different
// arrow styles or shapes will not parse.
//
// Caveats:
// - Write-symbol cells in commands are split on '/' (last occurrence) and
//   per-tape segments are split on ','. If your alphabet contains '/' or ','
//   as literal symbols, the parser cannot disambiguate. Stick to alphabets
//   without those characters when round-tripping through Mermaid.
const haltNodeRegex = /^([sc]\d+)\(\(\(halt\)\)\)$/;
const regularNodeRegex = /^(s\d+)\["([^"]*)"\]$/;
const wrappedNodeRegex = /^(s\d+)\[\["([^"]*)"\]\]$/;
const subgraphStartRegex = /^subgraph\s+w_(\d+)\["([^"]*)"\]$/;
const subgraphEndRegex = /^end$/;
const idleNodeRegex = /^idle\(\[idle\]\)$/;
const enterArrowRegex = /^idle\s+-\.\s+enter\s+\.->\s+(s\d+)$/;
// Regular labeled transition (solid `-->`).
const labeledTransitionRegex = /^([sc]\d+)\s+--\s+"(.*)"\s+-->\s+([sc]\d+)$/;
// Wrapper → override (unlabeled solid `-->`).
const wrapperOverrideRegex = /^(s\d+)\s+-->\s+([sc]\d+)$/;
// Call arrow (bold `==>`), with optional `&`-joined source ribbon.
const callArrowRegex = /^(s\d+(?:\s+&\s+s\d+)*)\s+==\s+"call"\s+==>\s+(s\d+)$/;
// Return arrow (`w_N -. return .-> s_W` with optional `&` target ribbon).
const returnArrowRegex = /^w_(\d+)\s+-\.\s+"return"\s+\.->\s+(s\d+(?:\s+&\s+s\d+)*)$/;
// Halt arrow (`w_N -. halt .-> s0`).
const haltArrowRegex = /^w_(\d+)\s+-\.\s+"halt"\s+\.->\s+s0$/;
// First capture char anchored as \S to avoid polynomial backtracking between
// the preceding \s* and a permissive (.+); see CodeQL js/polynomial-redos.
const alphabetsRegex = /^%%\s*alphabets:\s*(\S.*)$/;

export function fromMermaid(text: string): Graph {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let alphabets: string[][] = [];
  let initialId: number | null = null;
  const nodes: Record<number, GraphNode> = {};
  let currentFrameId: number | null = null;

  const ensureNode = (
    id: number,
    opts: {
      name?: string;
      isHalt?: boolean;
      isHaltMarker?: boolean;
      isWrapper?: boolean;
      bareStateId?: number | null;
      frameId?: number | null;
    } = {},
  ): GraphNode => {
    if (!nodes[id]) {
      nodes[id] = {
        id,
        name: opts.name ?? mermaidIdFor(id),
        isHalt: opts.isHalt ?? false,
        isHaltMarker: opts.isHaltMarker ?? false,
        isWrapper: opts.isWrapper ?? false,
        bareStateId: opts.bareStateId ?? null,
        frameId: opts.frameId ?? null,
        transitions: [],
        overriddenHaltStateId: null,
      };
    } else {
      if (opts.name !== undefined) nodes[id].name = opts.name;
      if (opts.isHalt !== undefined) nodes[id].isHalt = opts.isHalt;
      if (opts.isHaltMarker !== undefined) nodes[id].isHaltMarker = opts.isHaltMarker;
      if (opts.isWrapper !== undefined) nodes[id].isWrapper = opts.isWrapper;
      if (opts.bareStateId !== undefined) nodes[id].bareStateId = opts.bareStateId;
      if (opts.frameId !== undefined) nodes[id].frameId = opts.frameId;
    }

    return nodes[id];
  };

  // First pass: nodes + alphabets (track subgraph context for frameId).
  for (const line of lines) {
    if (line === 'flowchart TD') continue;

    const am = line.match(alphabetsRegex);

    if (am) {
      alphabets = JSON.parse(am[1]);
      continue;
    }

    const sgStart = line.match(subgraphStartRegex);

    if (sgStart) {
      currentFrameId = Number(sgStart[1]);
      continue;
    }

    if (subgraphEndRegex.test(line)) {
      currentFrameId = null;
      continue;
    }

    if (idleNodeRegex.test(line)) continue;

    const hm = line.match(haltNodeRegex);

    if (hm) {
      const id = parseMermaidId(hm[1]);
      const isHaltMarker = currentFrameId !== null;

      ensureNode(id, {
        name: 'halt',
        isHalt: true,
        isHaltMarker,
        frameId: isHaltMarker ? currentFrameId : null,
      });

      continue;
    }

    const wm = line.match(wrappedNodeRegex);

    if (wm) {
      ensureNode(parseMermaidId(wm[1]), {
        name: wm[2],
        isWrapper: true,
      });

      continue;
    }

    const rm = line.match(regularNodeRegex);

    if (rm) {
      ensureNode(parseMermaidId(rm[1]), {
        name: rm[2],
        frameId: currentFrameId,
      });

      continue;
    }
  }

  // Second pass: edges.
  for (const line of lines) {
    const em = line.match(enterArrowRegex);

    if (em) {
      initialId = parseMermaidId(em[1]);
      continue;
    }

    // Return/halt arrows are derivable from frame structure at the next
    // toMermaid emit; consume but don't persist as graph data.
    if (returnArrowRegex.test(line) || haltArrowRegex.test(line)) {
      continue;
    }

    // `call` arrow — sets bareStateId on each source wrapper.
    const cm = line.match(callArrowRegex);

    if (cm) {
      const sources = cm[1].split(/\s+&\s+/);
      const bareId = parseMermaidId(cm[2]);

      for (const src of sources) {
        ensureNode(parseMermaidId(src), {isWrapper: true, bareStateId: bareId});
      }

      continue;
    }

    // Wrapper → override (unlabeled solid `-->`). Only fires if the source
    // node is a known wrapper (declared as `[[…]]`).
    const wo = line.match(wrapperOverrideRegex);

    if (wo) {
      const fromId = parseMermaidId(wo[1]);
      const toId = parseMermaidId(wo[2]);

      if (nodes[fromId] && nodes[fromId].isWrapper) {
        nodes[fromId].overriddenHaltStateId = toId;
        continue;
      }
      // Fall through — unlabeled solid from a non-wrapper is unexpected;
      // treated as a malformed line and ignored by the labeled-regex below.
    }

    const tm = line.match(labeledTransitionRegex);

    if (tm) {
      const fromId = parseMermaidId(tm[1]);
      const label = tm[2];
      const toId = parseMermaidId(tm[3]);

      const arrowIx = label.indexOf(' → ');

      if (arrowIx === -1) {
        throw new Error(`fromMermaid: malformed edge label: "${label}"`);
      }

      const readLabel = label.slice(0, arrowIx);
      const cmdLabel = label.slice(arrowIx + ' → '.length);

      const stripBrackets = (s: string): string => {
        if (!s.startsWith('[') || !s.endsWith(']')) {
          throw new Error(`fromMermaid: malformed bracketed list: "${s}"`);
        }

        const inner = s.slice(1, -1);
        let i = 0;

        while (i < inner.length) {
          if (inner[i] === '\\' && i + 1 < inner.length) {
            i += 2;
            continue;
          }

          if (inner[i] === '|') {
            throw new Error(
              `fromMermaid: compact in-bracket alternation "${s}" is not supported — `
              + 'each alternative must be its own bracketed pattern (e.g. "[\'^\']|[\'1\']").',
            );
          }

          i += 1;
        }

        return inner;
      };

      const blockMatches = readLabel.match(/\[[^\]]*\]/g);

      if (!blockMatches || blockMatches.length === 0) {
        throw new Error(`fromMermaid: no bracketed read-list in label: "${label}"`);
      }

      const pattern = blockMatches.map(stripBrackets).join('|');
      const slashIx = cmdLabel.indexOf(']/[');

      if (slashIx === -1) {
        throw new Error(`fromMermaid: malformed command label (expected \`[…]/[…]\`): "${cmdLabel}"`);
      }

      const writesPart = stripBrackets(cmdLabel.slice(0, slashIx + 1));
      const movesPart = stripBrackets(cmdLabel.slice(slashIx + 2));
      const writes = writesPart.split(',');
      const moves = movesPart.split(',');

      if (writes.length !== moves.length) {
        throw new Error(
          `fromMermaid: write-cells (${writes.length}) and move-cells (${moves.length}) mismatch: "${cmdLabel}"`,
        );
      }

      const command: GraphCommand[] = writes.map((symbol, i) => ({symbol, movement: moves[i]}));

      const fromNode = ensureNode(fromId);
      const transitionIx = fromNode.transitions.length;

      fromNode.transitions.push({
        pattern,
        command,
        nextStateId: toId,
        id: `${fromId}-${transitionIx}`,
      });
    }
  }

  if (initialId === null) {
    throw new Error('fromMermaid: no `idle -. enter .-> sN` arrow found');
  }

  return {initialId, alphabets, nodes};
}
