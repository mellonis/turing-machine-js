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
//     w_${id}["halt frame"] … end` block. A synthesized "cloned halt" graph
//     node (with `isHalt: true, isClonedHalt: true`, id = -wrapperId in graph
//     data) sits inside the subgraph and serves as the local landing point for
//     the bare's halt-bound transitions. The dotted onHalt edge runs from the
//     `[[bare]]` directly to the override target, crossing the subgraph border.
//   - Real halt (id 0) is emitted as `s0(((halt)))` outside any subgraph.
//   - Cloned halt nodes use the Mermaid id `c${absId}` (where `absId = -id`)
//     since Mermaid IDs must match /[A-Za-z][A-Za-z0-9_]*/ — negative numbers
//     are not legal syntax.

// Maps a graph node id to its Mermaid id.
//   - non-negative id N  → "sN"
//   - negative id -N (cloned halt) → "cN"
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
  // negative-id cloned halts last). Deterministic emit lets `toMermaid` →
  // `fromMermaid` → `toMermaid` round-trip stably (regression for #139).
  const nodes = Object.values(graph.nodes).slice().sort((a, b) => a.id - b.id);
  const wrappedNodes = nodes.filter((n) => n.isWrapped);

  // Convention: wrapped node id N → cloned halt id -N.
  const clonedHaltFor = (wrappedId: number): number => -wrappedId;

  // Set of cloned-halt ids that belong to some wrapper (= are inside a subgraph).
  const clonedHaltIds = new Set<number>();

  for (const w of wrappedNodes) {
    const clonedId = clonedHaltFor(w.id);

    if (clonedId in graph.nodes) {
      clonedHaltIds.add(clonedId);
    }
  }

  // Emit non-subgraph nodes first: real halt + regular non-wrapped nodes.
  for (const node of nodes) {
    if (node.isWrapped || clonedHaltIds.has(node.id)) {
      continue;
    }

    const id = mermaidIdFor(node.id);

    if (node.isHalt) {
      lines.push(`  ${id}(((halt)))`);
    } else if (node.id === graph.initialId) {
      lines.push(`  ${id}(("${node.name}"))`);
    } else {
      lines.push(`  ${id}["${node.name}"]`);
    }
  }

  // Emit one subgraph per wrapper, in sorted wrapped-id order.
  for (const wrapped of wrappedNodes) {
    const wrappedMid = mermaidIdFor(wrapped.id);
    const clonedId = clonedHaltFor(wrapped.id);
    const clonedMid = mermaidIdFor(clonedId);

    lines.push(`  subgraph w_${wrapped.id}["halt frame"]`);
    lines.push(`    ${wrappedMid}[["${wrapped.name}"]]`);

    if (clonedId in graph.nodes) {
      lines.push(`    ${clonedMid}(((halt)))`);
    }

    lines.push('  end');
  }

  // Emit transitions per-node in sorted node-id order. Within a node,
  // transitions emit in their stored array order (which mirrors the source
  // state's symbol-map insertion order — stable per State instance).
  for (const node of nodes) {
    if (node.isHalt && !node.isClonedHalt) {
      continue;
    }

    for (const t of node.transitions) {
      const cmd = t.command.map((c) => `${c.symbol}/${c.movement}`).join(',');
      const label = `${t.pattern} → ${cmd}`;

      lines.push(
        `  ${mermaidIdFor(node.id)} -- "${label}" --> ${mermaidIdFor(t.nextStateId)}`,
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
const initialNodeRegex = /^(s\d+)\(\("([^"]*)"\)\)$/;
const regularNodeRegex = /^(s\d+)\["([^"]*)"\]$/;
const wrappedNodeRegex = /^(s\d+)\[\["([^"]*)"\]\]$/;
const subgraphStartRegex = /^subgraph\s+w_\d+\["([^"]*)"\]$/;
const subgraphEndRegex = /^end$/;
const transitionRegex = /^([sc]\d+)\s+--\s+"(.*)"\s+-->\s+([sc]\d+)$/;
const onHaltRegex = /^([sc]\d+)\s+-\.\s+onHalt\s+\.->\s+([sc]\d+)$/;
// First capture char anchored as \S to avoid polynomial backtracking between
// the preceding \s* and a permissive (.+); see CodeQL js/polynomial-redos.
const alphabetsRegex = /^%%\s*alphabets:\s*(\S.*)$/;

export function fromMermaid(text: string): Graph {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let alphabets: string[][] = [];
  let initialId: number | null = null;
  const nodes: Record<number, GraphNode> = {};
  // Track the cloned-halt ids that appeared inside a subgraph — they should be
  // marked `isClonedHalt: true` even though they share the `(((halt)))` shape
  // with the real halt at the top level.
  const clonedHaltIds = new Set<number>();
  let inSubgraph = false;

  const ensureNode = (
    id: number,
    opts: {
      name?: string;
      isHalt?: boolean;
      isClonedHalt?: boolean;
      isWrapped?: boolean;
    } = {},
  ): GraphNode => {
    if (!nodes[id]) {
      nodes[id] = {
        id,
        name: opts.name ?? mermaidIdFor(id),
        isHalt: opts.isHalt ?? false,
        isClonedHalt: opts.isClonedHalt ?? false,
        isWrapped: opts.isWrapped ?? false,
        transitions: [],
        overriddenHaltStateId: null,
      };
    } else {
      if (opts.name !== undefined) nodes[id].name = opts.name;
      if (opts.isHalt !== undefined) nodes[id].isHalt = opts.isHalt;
      if (opts.isClonedHalt !== undefined) nodes[id].isClonedHalt = opts.isClonedHalt;
      if (opts.isWrapped !== undefined) nodes[id].isWrapped = opts.isWrapped;
    }

    return nodes[id];
  };

  // First pass: alphabets + nodes (track subgraph context to mark cloned halts).
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

    const hm = line.match(haltNodeRegex);

    if (hm) {
      const id = parseMermaidId(hm[1]);
      const isCloned = inSubgraph || id < 0;

      ensureNode(id, {name: 'halt', isHalt: true, isClonedHalt: isCloned});

      if (isCloned) {
        clonedHaltIds.add(id);
      }

      continue;
    }

    const wm = line.match(wrappedNodeRegex);

    if (wm) {
      const id = parseMermaidId(wm[1]);

      if (initialId === null) {
        initialId = id;
      }

      ensureNode(id, {name: wm[2], isWrapped: true});
      continue;
    }

    const im = line.match(initialNodeRegex);

    if (im) {
      const id = parseMermaidId(im[1]);

      initialId = id;
      ensureNode(id, {name: im[2]});
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
    const om = line.match(onHaltRegex);

    if (om) {
      ensureNode(parseMermaidId(om[1])).overriddenHaltStateId = parseMermaidId(om[2]);
      continue;
    }

    const tm = line.match(transitionRegex);

    if (tm) {
      const fromId = parseMermaidId(tm[1]);
      const label = tm[2];
      const toId = parseMermaidId(tm[3]);

      const arrowIx = label.indexOf(' → ');

      if (arrowIx === -1) {
        throw new Error(`fromMermaid: malformed edge label: "${label}"`);
      }

      const pattern = label.slice(0, arrowIx);
      const commandStr = label.slice(arrowIx + ' → '.length);
      const command: GraphCommand[] = commandStr.split(',').map((part) => {
        const slashIx = part.lastIndexOf('/');

        if (slashIx === -1) {
          throw new Error(`fromMermaid: malformed command part: "${part}"`);
        }

        return {
          symbol: part.slice(0, slashIx),
          movement: part.slice(slashIx + 1),
        };
      });

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
    throw new Error('fromMermaid: no initial state (round-or-wrapped node) found');
  }

  return {initialId, alphabets, nodes};
}
