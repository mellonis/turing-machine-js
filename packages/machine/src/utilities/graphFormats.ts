import {type Graph, type GraphCommand, type GraphNode} from './graph';

// Format converters between a Graph (the data model produced by State.toGraph
// and consumed by State.fromGraph) and external string representations.
//
// Currently only Mermaid flowchart syntax is supported. Future formats
// (Graphviz, JSON-LD, custom DSL) belong here too.
//
// v7 emit shape (#138/#139):
//   - Each wrapper-State collapses onto its bare's representation. The collapsed
//     graph node has `isWrapped: true` and is emitted as Mermaid `[[…]]`
//     (subroutine / double-walled-rectangle) shape, inside a `subgraph
//     w_${id}["halt frame"] … end` block. A synthesized "halt marker" graph
//     node (with `isHalt: true, isHaltMarker: true`, id = -wrapperId in graph
//     data) sits inside the subgraph and serves as the local landing point for
//     the bare's halt-bound transitions. The dotted onHalt edge runs from the
//     `[[bare]]` directly to the override target, crossing the subgraph border.
//   - Real halt (id 0) is emitted as `s0(((halt)))` outside any subgraph.
//   - Halt marker nodes use the Mermaid id `c${absId}` (where `absId = -id`)
//     since Mermaid IDs must match /[A-Za-z][A-Za-z0-9_]*/ — negative numbers
//     are not legal syntax.

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

export function toMermaid(graph: Graph): string {
  const lines: string[] = [
    'flowchart TD',
    `%% alphabets: ${JSON.stringify(graph.alphabets)}`,
  ];

  // Sort nodes by id (ascending — real halt first at 0, regular states next,
  // negative-id halt markers last). Deterministic emit lets `toMermaid` →
  // `fromMermaid` → `toMermaid` round-trip stably (regression for #139).
  const nodes = Object.values(graph.nodes).slice().sort((a, b) => a.id - b.id);
  const wrappedNodes = nodes.filter((n) => n.isWrapped);

  // Convention: wrapped node id N → halt marker id -N.
  const haltMarkerIdFor = (wrappedId: number): number => -wrappedId;

  // Set of halt-marker ids that belong to some wrapper (= are inside a subgraph).
  const haltMarkerIds = new Set<number>();

  for (const w of wrappedNodes) {
    const haltMarkerId = haltMarkerIdFor(w.id);

    if (haltMarkerId in graph.nodes) {
      haltMarkerIds.add(haltMarkerId);
    }
  }

  // Emit non-subgraph nodes first: real halt + regular non-wrapped nodes.
  // No special round-shape `((…))` for the initial — the `idle -. enter .->`
  // arrow emitted below is the sole "start here" signal.
  for (const node of nodes) {
    if (node.isWrapped || haltMarkerIds.has(node.id)) {
      continue;
    }

    const id = mermaidIdFor(node.id);

    if (node.isHalt) {
      lines.push(`  ${id}(((halt)))`);
    } else {
      lines.push(`  ${id}["${node.name}"]`);
    }
  }

  // `idle` sentinel = pre-execution marker for the machine. Always emitted,
  // with a labeled dotted arrow `idle -. enter .-> sN` to the initial state.
  // Symmetric with the `onHalt` dotted convention used by wrapper redirects.
  // Visual-only — `idle` is not a graph node.
  lines.push('  idle([idle])');

  // Emit one subgraph per wrapper, in sorted wrapped-id order.
  for (const wrapped of wrappedNodes) {
    const wrappedMid = mermaidIdFor(wrapped.id);
    const haltMarkerId = haltMarkerIdFor(wrapped.id);
    const haltMarkerMid = mermaidIdFor(haltMarkerId);

    lines.push(`  subgraph w_${wrapped.id}["halt frame"]`);
    lines.push(`    ${wrappedMid}[["${wrapped.name}"]]`);

    if (haltMarkerId in graph.nodes) {
      lines.push(`    ${haltMarkerMid}(((halt)))`);
    }

    lines.push('  end');
  }

  // Enter arrow: emitted after subgraphs so it visually points at the initial
  // node (whether plain `[…]` or wrapped `[[…]]` inside a subgraph).
  lines.push(`  idle -. enter .-> ${mermaidIdFor(graph.initialId)}`);

  // Emit transitions per-node in sorted node-id order. Within a node,
  // transitions emit in their stored array order (which mirrors the source
  // state's symbol-map insertion order — stable per State instance).
  for (const node of nodes) {
    if (node.isHalt && !node.isHaltMarker) {
      continue;
    }

    for (const t of node.transitions) {
      // Bracketed-tape-block format (v7): each role-list — read alternatives,
      // writes, movements — wraps in `[…]` to mark "this is a tape-block
      // reading". Brackets stay even for single-tape machines; the `[…]` is
      // the tape-block concept indicator.
      //
      //   Single-tape:                  ['X'] → [K]/[R]
      //   Single-tape + alternation:    ['^']|['1']|['0'] → [K]/[S]
      //   Two-tape:                     ['0','a'] → [K,'1']/[R,S]
      //   Two-tape + alternation:       ['0','a']|['1','b'] → [K,K]/[R,L]
      //
      // Alternation is ALWAYS per-pattern-bracket — one full bracketed list
      // per alternative — regardless of tape count. Pedagogically each
      // alternative is its own drawn transition; a compact in-bracket form
      // (`['^'|'1']`) would read as cross-product semantics in multi-tape
      // (`['0'|'1','a'|'b']` = 4 combos, not 2 paired alternatives), so we
      // avoid introducing it for the single-tape case too.
      const alternatives = t.pattern.split('|');
      const reads = alternatives.map((alt) => `[${alt}]`).join('|');
      const writes = `[${t.command.map((c) => c.symbol).join(',')}]`;
      const moves = `[${t.command.map((c) => c.movement).join(',')}]`;
      const label = `${reads} → ${writes}/${moves}`;

      // Thicker `==>` arrow when the transition crosses INTO a wrapper —
      // signals "this transition pushes that wrapper's override onto the
      // runtime stack" (per `TuringMachine.run` line ~220's
      // `if (state !== nextState && nextState.overriddenHaltState) push(...)`).
      // Self-loops (state === nextState) don't push at runtime — keep the
      // regular `-->` for those even when the target is wrapped.
      const targetNode = graph.nodes[t.nextStateId];
      const isEnteringWrapper = targetNode && targetNode.isWrapped && t.nextStateId !== node.id;
      const lineSegment = isEnteringWrapper ? '==' : '--';
      const arrowTip = isEnteringWrapper ? '==>' : '-->';

      lines.push(
        `  ${mermaidIdFor(node.id)} ${lineSegment} "${label}" ${arrowTip} ${mermaidIdFor(t.nextStateId)}`,
      );
    }

    if (node.overriddenHaltStateId !== null) {
      lines.push(
        `  ${mermaidIdFor(node.id)} -. onHalt .-> ${mermaidIdFor(node.overriddenHaltStateId)}`,
      );
    }
  }

  return lines.join('\n');
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
const subgraphStartRegex = /^subgraph\s+w_\d+\["([^"]*)"\]$/;
const subgraphEndRegex = /^end$/;
const idleNodeRegex = /^idle\(\[idle\]\)$/;
const enterArrowRegex = /^idle\s+-\.\s+enter\s+\.->\s+(s\d+)$/;
const transitionRegex = /^([sc]\d+)\s+--\s+"(.*)"\s+-->\s+([sc]\d+)$/;
const thickTransitionRegex = /^([sc]\d+)\s+==\s+"(.*)"\s+==>\s+([sc]\d+)$/;
const onHaltRegex = /^([sc]\d+)\s+-\.\s+onHalt\s+\.->\s+([sc]\d+)$/;
// First capture char anchored as \S to avoid polynomial backtracking between
// the preceding \s* and a permissive (.+); see CodeQL js/polynomial-redos.
const alphabetsRegex = /^%%\s*alphabets:\s*(\S.*)$/;

export function fromMermaid(text: string): Graph {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let alphabets: string[][] = [];
  let initialId: number | null = null;
  const nodes: Record<number, GraphNode> = {};
  // Track the halt-marker ids that appeared inside a subgraph — they should be
  // marked `isHaltMarker: true` even though they share the `(((halt)))` shape
  // with the real halt at the top level.
  const haltMarkerIds = new Set<number>();
  let inSubgraph = false;

  const ensureNode = (
    id: number,
    opts: {
      name?: string;
      isHalt?: boolean;
      isHaltMarker?: boolean;
      isWrapped?: boolean;
    } = {},
  ): GraphNode => {
    if (!nodes[id]) {
      nodes[id] = {
        id,
        name: opts.name ?? mermaidIdFor(id),
        isHalt: opts.isHalt ?? false,
        isHaltMarker: opts.isHaltMarker ?? false,
        isWrapped: opts.isWrapped ?? false,
        transitions: [],
        overriddenHaltStateId: null,
      };
    } else {
      if (opts.name !== undefined) nodes[id].name = opts.name;
      if (opts.isHalt !== undefined) nodes[id].isHalt = opts.isHalt;
      if (opts.isHaltMarker !== undefined) nodes[id].isHaltMarker = opts.isHaltMarker;
      if (opts.isWrapped !== undefined) nodes[id].isWrapped = opts.isWrapped;
    }

    return nodes[id];
  };

  // First pass: alphabets + nodes (track subgraph context to mark halt markers).
  for (const line of lines) {
    if (line === 'flowchart TD') {
      continue;
    }

    const am = line.match(alphabetsRegex);

    if (am) {
      alphabets = JSON.parse(am[1]);
      continue;
    }

    if (subgraphStartRegex.test(line)) {
      inSubgraph = true;
      continue;
    }

    if (subgraphEndRegex.test(line)) {
      inSubgraph = false;
      continue;
    }

    // `idle([idle])` sentinel: a visual pre-execution marker. Not a graph
    // node — skip declaration, parse the `idle -. enter .-> sN` arrow in the
    // edge pass to set initialId.
    if (idleNodeRegex.test(line)) {
      continue;
    }

    const hm = line.match(haltNodeRegex);

    if (hm) {
      const id = parseMermaidId(hm[1]);
      const isHaltMarker = inSubgraph || id < 0;

      ensureNode(id, {name: 'halt', isHalt: true, isHaltMarker});

      if (isHaltMarker) {
        haltMarkerIds.add(id);
      }

      continue;
    }

    const wm = line.match(wrappedNodeRegex);

    if (wm) {
      ensureNode(parseMermaidId(wm[1]), {name: wm[2], isWrapped: true});
      continue;
    }

    const rm = line.match(regularNodeRegex);

    if (rm) {
      ensureNode(parseMermaidId(rm[1]), {name: rm[2]});
      continue;
    }
  }

  // Second pass: edges.
  for (const line of lines) {
    // `idle -. enter .-> sN`: the sole source of initialId.
    const em = line.match(enterArrowRegex);

    if (em) {
      initialId = parseMermaidId(em[1]);
      continue;
    }

    const om = line.match(onHaltRegex);

    if (om) {
      ensureNode(parseMermaidId(om[1])).overriddenHaltStateId = parseMermaidId(om[2]);
      continue;
    }

    // Thick transition (`==> `) and regular transition (`-->`) share the same
    // semantics — only the visual differs. Parse both via the same code path.
    const tm = line.match(transitionRegex) ?? line.match(thickTransitionRegex);

    if (tm) {
      const fromId = parseMermaidId(tm[1]);
      const label = tm[2];
      const toId = parseMermaidId(tm[3]);

      const arrowIx = label.indexOf(' → ');

      if (arrowIx === -1) {
        throw new Error(`fromMermaid: malformed edge label: "${label}"`);
      }

      // Bracketed-tape-block format (v7):
      //   [<read-cells>]|[<read-cells>]... → [<write-cells>]/[<move-cells>]
      // Each bracketed list is a tape-block reading; the outer `|` separates
      // alternative read patterns. For single-tape machines with alternation,
      // the compact form `[<alt1>|<alt2>|...]` (one bracket, alternatives
      // inside) is also accepted; both forms decode to the same pattern
      // string.
      const readLabel = label.slice(0, arrowIx);
      const cmdLabel = label.slice(arrowIx + ' → '.length);

      // Strict per-pattern bracket form: `|` only between bracketed lists,
      // never inside. The compact `['^'|'1']` form is rejected by design —
      // every alternative must be its own bracketed pattern (`['^']|['1']`).
      // Pedagogically: each transition is drawn explicitly; the compact form
      // would read as cross-product semantics in multi-tape and confuse
      // readers (`['0'|'1','a'|'b']` could mean 4 combos, not 2 paired alts).
      // The rule applies to all bracketed lists — read alternatives, writes,
      // and movements — because commands and movements have no alternation
      // semantic either.
      const stripBrackets = (s: string): string => {
        if (!s.startsWith('[') || !s.endsWith(']')) {
          throw new Error(`fromMermaid: malformed bracketed list: "${s}"`);
        }

        const inner = s.slice(1, -1);

        // Walk the inner content; backslash escapes the next char (so `\|`
        // inside a cell is a literal pipe, not the alternation separator).
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

      // Match `[…]` blocks in the read label. Inner content is a tape-block
      // reading (possibly with `|` for compact single-tape alternation).
      // `[^\]]*` is the simple non-greedy match — works because cell content
      // doesn't typically contain literal `]`.
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
