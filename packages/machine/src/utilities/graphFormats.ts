import {type Graph, type GraphCommand, type GraphNode} from './graph';

// Format converters between a Graph (the data model produced by State.toGraph
// and consumed by State.fromGraph) and external string representations.
//
// Currently only Mermaid flowchart syntax is supported. Future formats
// (Graphviz, JSON-LD, custom DSL) belong here too.

export function toMermaid(graph: Graph): string {
  const lines: string[] = [
    'flowchart TD',
    `%% alphabets: ${JSON.stringify(graph.alphabets)}`,
  ];

  for (const node of Object.values(graph.nodes)) {
    const id = `s${node.id}`;

    if (node.isHalt) {
      lines.push(`  ${id}(((halt)))`);
    } else if (node.id === graph.initialId) {
      lines.push(`  ${id}(("${node.name}"))`);
    } else {
      lines.push(`  ${id}["${node.name}"]`);
    }
  }

  for (const node of Object.values(graph.nodes)) {
    for (const t of node.transitions) {
      // Per-tape commands separated with ',' to mirror the pattern syntax.
      const cmd = t.command.map((c) => `${c.symbol}/${c.movement}`).join(',');
      const label = `${t.pattern} → ${cmd}`;

      lines.push(`  s${node.id} -- "${label}" --> s${t.nextStateId}`);
    }

    if (node.overrodeHaltStateId !== null) {
      lines.push(`  s${node.id} -. onHalt .-> s${node.overrodeHaltStateId}`);
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
const haltNodeRegex = /^s(\d+)\(\(\(halt\)\)\)$/;
const initialNodeRegex = /^s(\d+)\(\("([^"]*)"\)\)$/;
const regularNodeRegex = /^s(\d+)\["([^"]*)"\]$/;
const transitionRegex = /^s(\d+)\s+--\s+"(.*)"\s+-->\s+s(\d+)$/;
const onHaltRegex = /^s(\d+)\s+-\.\s+onHalt\s+\.->\s+s(\d+)$/;
// First capture char anchored as \S to avoid polynomial backtracking between
// the preceding \s* and a permissive (.+); see CodeQL js/polynomial-redos.
const alphabetsRegex = /^%%\s*alphabets:\s*(\S.*)$/;

export function fromMermaid(text: string): Graph {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let alphabets: string[][] = [];
  let initialId: number | null = null;
  const nodes: Record<number, GraphNode> = {};

  const ensureNode = (id: number, opts: { name?: string; isHalt?: boolean } = {}): GraphNode => {
    if (!nodes[id]) {
      nodes[id] = {
        id,
        name: opts.name ?? `s${id}`,
        isHalt: opts.isHalt ?? false,
        transitions: [],
        overrodeHaltStateId: null,
      };
    } else {
      if (opts.name !== undefined) {
        nodes[id].name = opts.name;
      }

      if (opts.isHalt !== undefined) {
        nodes[id].isHalt = opts.isHalt;
      }
    }

    return nodes[id];
  };

  // First pass: alphabets + nodes.
  for (const line of lines) {
    if (line === 'flowchart TD') {
      continue;
    }

    const am = line.match(alphabetsRegex);

    if (am) {
      alphabets = JSON.parse(am[1]);
      continue;
    }

    const hm = line.match(haltNodeRegex);

    if (hm) {
      ensureNode(Number(hm[1]), {name: 'halt', isHalt: true});
      continue;
    }

    const im = line.match(initialNodeRegex);

    if (im) {
      const id = Number(im[1]);

      initialId = id;
      ensureNode(id, {name: im[2]});
      continue;
    }

    const rm = line.match(regularNodeRegex);

    if (rm) {
      ensureNode(Number(rm[1]), {name: rm[2]});
      continue;
    }
  }

  // Second pass: edges.
  for (const line of lines) {
    const om = line.match(onHaltRegex);

    if (om) {
      ensureNode(Number(om[1])).overrodeHaltStateId = Number(om[2]);
      continue;
    }

    const tm = line.match(transitionRegex);

    if (tm) {
      const fromId = Number(tm[1]);
      const label = tm[2];
      const toId = Number(tm[3]);

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

      ensureNode(fromId).transitions.push({pattern, command, nextStateId: toId});
    }
  }

  if (initialId === null) {
    throw new Error('fromMermaid: no initial state (double-paren node) found');
  }

  return {initialId, alphabets, nodes};
}
