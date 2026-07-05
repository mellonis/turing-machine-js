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
//   - Each frame has exactly one halt marker `s0-${frameId}(((halt)))`
//     inside its subgraph; halt-bound transitions from in-frame states
//     retarget to it. Always emitted (orphan signals dead wrapper).
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
//   - The `abortState` sentinel (#239), when referenced, emits as a single
//     top-level stadium node `s1(((abort)))` with a dashed-red `classDef`
//     (never inside a frame — see the `GraphNode.isAbort` doc in ./graph.ts).

// Maps a graph node id to its Mermaid id. Namespaced by prefix with a total
// parsing rule (#239): 'u' user state / 's0-' halt marker / other 's' sentinel.
//   - positive id N            → "uN"          (user state)
//   - id 0                     → "s0"          (haltState)
//   - odd negative id          → "s{(1-id)/2}" (sentinel: -1 → s1 abort, -3 → s2, …)
//   - even negative id -2f     → "s0-{f}"      (frame f's halt marker — a
//                                               frame-local stand-in for s0)
export function mermaidIdFor(id: number): string {
  if (id > 0) return `u${id}`;
  if (id === 0) return 's0';
  if (id % 2 === 0) return `s0-${-id / 2}`;
  return `s${(1 - id) / 2}`;
}

// Inverse of mermaidIdFor. Check 's0-' BEFORE the generic 's' branch.
export function parseMermaidId(s: string): number {
  if (s.startsWith('u')) return Number(s.slice(1));
  if (s.startsWith('s0-')) return -2 * Number(s.slice(3));
  const ordinal = Number(s.slice(1));
  return ordinal === 0 ? 0 : -(2 * ordinal - 1);
}

function frameSubgraphId(frameId: number): string {
  return `w_${frameId}`;
}

// User-controlled content (state names, tag names, alphabet symbols inside
// edge labels) is interpolated into Mermaid label strings (`"..."` wrappers
// on nodes, wrappers, subgraphs, and edges). Mermaid's grammar terminates
// the string on a literal `"`, and labels render via HTML/foreignObject so
// `<`, `>`, `&` get interpreted as markup. Statement terminators (`\n`,
// `\r`), C0 controls (except `\t`), DEL, bidi controls, and lone UTF-16
// surrogates are encoded as numeric entities so they can't confuse the
// tokenizer or flip text direction silently (#194).
//
// Printable Unicode (Cyrillic, CJK, emoji, accented Latin, etc.) passes
// through unchanged — a tape alphabet of Cyrillic or Brainfuck glyphs
// stays readable in the emitted `.mmd`.
//
// Escape is applied at the leaf — to each user-supplied fragment BEFORE
// it's composed into a label. Structural pieces this module emits (`<br>`
// tag separator, ` ∪ ` bare-name join, `[`, `]`, `,`, `|`, `/`, ` → `,
// the `callable subtree of `/`callable scope: ` prefixes) are NOT escaped;
// only user-controlled content is. fromMermaid mirrors with
// `unescapeMermaidLabel` on each extracted leaf AFTER structural parsing,
// so a literal `<br>` inside a state name (encoded as `&lt;br&gt;`)
// survives the tag-split and decodes back at the leaf.
const MERMAID_LABEL_ESCAPE_RE = /[&"<>\n\r\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069\uD800-\uDFFF]/g;
function escapeMermaidLabel(s: string): string {
  return s.replace(MERMAID_LABEL_ESCAPE_RE, (ch) => {
    switch (ch) {
      case '&': return '&amp;';
      case '"': return '&quot;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '\n': return '&#10;';
      case '\r': return '&#13;';
      default: return `&#${ch.charCodeAt(0)};`;
    }
  });
}

// Inverse of escapeMermaidLabel. Decodes the four named entities the
// encoder emits (`&amp;`, `&quot;`, `&lt;`, `&gt;`) plus arbitrary
// numeric entities (`&#NN;`, `&#xHH;`) — the latter to round-trip the
// control / bidi / lone-surrogate cases from encode. Other named entities
// pass through unchanged: fromMermaid is strict to the dialect toMermaid
// emits, and a future-proof full HTML-entity decoder would muddle that.
//
// Replacement is single-pass: each `&...;` match is consumed once with
// no re-scanning of the substitution, so nested-looking inputs like
// `&amp;quot;` (literal `&quot;` as user text) decode to `&quot;` not `"`.
const MERMAID_LABEL_UNESCAPE_RE = /&(?:(amp|quot|lt|gt)|#(\d+)|#x([0-9a-fA-F]+));/g;
function unescapeMermaidLabel(s: string): string {
  return s.replace(MERMAID_LABEL_UNESCAPE_RE, (match, named, dec, hex) => {
    switch (named) {
      case 'amp': return '&';
      case 'quot': return '"';
      case 'lt': return '<';
      case 'gt': return '>';
      default: {
        // Code units up to U+FFFF decode via fromCharCode so lone
        // surrogates we encoded by UTF-16 code unit round-trip exactly.
        // Hand-edited supplementary code points (`&#x1F600;`) use
        // fromCodePoint to produce the right surrogate pair — but only
        // when we didn't emit them ourselves, since encode runs per code
        // unit.
        if (dec !== undefined) {
          const n = Number.parseInt(dec, 10);
          return n <= 0xFFFF ? String.fromCharCode(n) : String.fromCodePoint(n);
        }
        if (hex !== undefined) {
          const n = Number.parseInt(hex, 16);
          return n <= 0xFFFF ? String.fromCharCode(n) : String.fromCodePoint(n);
        }
        /* c8 ignore next 2 — defensive: the regex shape guarantees one of
           named / dec / hex is always set, so this fallback is unreachable. */
        return match;
      }
    }
  });
}

export function toMermaid(graph: Graph): string {
  const lines: string[] = [
    'flowchart TD',
    `%% alphabets: ${JSON.stringify(graph.alphabets)}`,
  ];

  // Sort nodes by id ascending. With halt markers at -2f and sentinels
  // (abortState at -1, any future sentinel at further odd negatives, #239)
  // sharing the negative range with real halt (0), ascending id order is no
  // longer "halt first" — it's halt markers (most negative, largest frameId
  // first) ⟶ odd-negative sentinels ⟶ real halt (0) ⟶ positive regular/bare/
  // wrapper states. Markers are bucketed separately below (haltMarkerByFrame)
  // and never appear in topLevelNodes (frameId !== null), so this reorder is
  // invisible to callers — what matters is that the order is FIXED, not which
  // one it is: toMermaid → fromMermaid → toMermaid still round-trips stably
  // (#139) because the same deterministic sort runs both times.
  const nodes = Object.values(graph.nodes).slice().sort((a, b) => a.id - b.id);

  // Bucket nodes for emit order.
  const topLevelNodes = nodes.filter((n) => n.frameId === null && !n.isWrapper);
  // All wrappers — needed by the call / return / wrapper-to-override
  // arrow emit passes below regardless of where the wrapper renders.
  const wrapperNodes = nodes.filter((n) => n.isWrapper);
  // Top-level wrappers: wrappers whose caller has no frame (the caller is
  // the top-level program). Framed wrappers (whose caller IS a subroutine
  // with its own frame) render INSIDE that frame's subgraph below.
  const topLevelWrapperNodes = wrapperNodes.filter((w) => w.frameId === null);
  // Bares-bodies-and-framed-wrappers inside frames, grouped by frameId.
  const nodesByFrame = new Map<number, GraphNode[]>();
  // Halt-marker per frame (kept separate so it always emits LAST inside the
  // subgraph for deterministic shape).
  const haltMarkerByFrame = new Map<number, GraphNode>();

  for (const node of nodes) {
    if (node.frameId === null) continue;

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

  // Build the visible-label string for a node — name plus, if tagged, a
  // `<br>tag1, tag2, ...` suffix so the rendered Mermaid shows both. Tags
  // are the source of truth on the GraphNode; `<br>` is the universal
  // Mermaid line-break that works across renderers without `classDef`-
  // pseudo-element hacks (#186).
  const labelOf = (node: GraphNode): string => {
    const name = escapeMermaidLabel(node.name);
    if (node.tags.length === 0) return name;
    // Per-tag escape that ALSO encodes `,` — tags are joined with `, ` and
    // split on `,` in `splitLabelTags`, so a literal comma in user tag
    // content would be mistaken for a separator on the way back. `,` isn't
    // in the base escape set because it's structural in edge labels
    // (between per-tape cells in `writes`/`moves`), where the encode pass
    // happens after composition — different context, different escape.
    const tagFragments = node.tags
      .map((t) => escapeMermaidLabel(t).replace(/,/g, '&#44;'));
    return `${name}<br>${tagFragments.join(', ')}`;
  };

  // 1. Emit top-level nodes (real halt, non-wrapper regulars outside any frame).
  for (const node of topLevelNodes) {
    const mid = mermaidIdFor(node.id);

    if (node.isHalt) {
      lines.push(`  ${mid}(((halt)))`);
    } else if (node.isAbort) {
      lines.push(`  ${mid}(((abort)))`);
    } else {
      lines.push(`  ${mid}["${labelOf(node)}"]`);
    }
  }

  // 2. Emit top-level wrappers (wrappers owned by the top-level program;
  // wrappers owned by a subroutine emit inside that subroutine's subgraph).
  for (const wrapper of topLevelWrapperNodes) {
    lines.push(`  ${mermaidIdFor(wrapper.id)}[["${labelOf(wrapper)}"]]`);
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
      .map((n) => escapeMermaidLabel(n.name));
    const label = frameBareNames.length > 1
      ? `callable scope: ${frameBareNames.join(' ∪ ')}`
      : `callable subtree of ${frameBareNames[0] ?? frameId}`;

    lines.push(`  subgraph ${frameSubgraphId(frameId)}["${label}"]`);

    // Inner nodes — sort by id for determinism. Framed wrappers (call sites
    // owned by this frame) render with the `[[name]]` wrapper shape; bares
    // and body states render with the regular `["name"]` shape.
    for (const node of (nodesByFrame.get(frameId) ?? []).slice().sort((a, b) => a.id - b.id)) {
      if (node.isWrapper) {
        lines.push(`    ${mermaidIdFor(node.id)}[["${labelOf(node)}"]]`);
      } else {
        lines.push(`    ${mermaidIdFor(node.id)}["${labelOf(node)}"]`);
      }
    }

    // Every frame has a halt marker — `State.toGraph`'s frame-emit pass
    // creates one for each frame. Non-null assertion is safe; a defensive
    // null check would be dead.
    const haltMarker = haltMarkerByFrame.get(frameId)!;

    lines.push(`    ${mermaidIdFor(haltMarker.id)}(((halt)))`);

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

    // Return arrow — collapsed `&` ribbon over all wrappers calling this
    // frame. Frames only exist because at least one wrapper's bareStateId
    // points to a bare in the frame, so `callingWrappers` is always
    // non-empty for any frame that reached this code path.
    const callingWrappers = wrapperNodes.filter((w) => {
      const bare = graph.nodes[w.bareStateId!];

      return bare.frameId === frameId;
    });

    const targets = callingWrappers
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((w) => mermaidIdFor(w.id))
      .join(' & ');

    lines.push(`  ${frameSubgraphId(frameId)} -. "return" .-> ${targets}`);

    if (hasNonWrapperEntry.get(frameId)) {
      lines.push(`  ${frameSubgraphId(frameId)} -. "halt" .-> s0`);
    }
  }

  // 8. Wrapper-to-override arrows (regular solid).
  //
  // `wrapper.overriddenHaltStateId` is always non-null on wrapper nodes
  // (set by `State.toGraph` for every `isWrapper: true` node — it's the
  // wrapper's override target, which a wrapper by definition has). The
  // non-null assertion is safe; a defensive null check would be dead.
  for (const wrapper of wrapperNodes) {
    lines.push(
      `  ${mermaidIdFor(wrapper.id)} --> ${mermaidIdFor(wrapper.overriddenHaltStateId!)}`,
    );
  }

  // 9. Regular transitions for non-wrapper non-halt-marker non-halt non-abort
  // nodes. `isAbort` is defensive here — abort's `transitions` is always `[]`
  // (#239), so the inner loop below is a no-op for it either way; the guard
  // just documents the invariant rather than changing behavior.
  for (const node of nodes) {
    if (node.isHalt || node.isHaltMarker || node.isWrapper || node.isAbort) continue;

    for (const t of node.transitions) {
      const alternatives = t.pattern.split('|');
      const reads = alternatives.map((alt) => `[${alt}]`).join('|');
      const writes = `[${t.command.map((c) => c.symbol).join(',')}]`;
      const moves = `[${t.command.map((c) => c.movement).join(',')}]`;
      // Escape the WHOLE composed label — structural separators ([, ], ,,
      // |, /, ' → ') are all in our safe ASCII set and pass through
      // unchanged; only embedded user alphabet symbols inside `'...'` get
      // entity-encoded. fromMermaid unescapes the captured label as the
      // first step before structural parsing.
      const label = escapeMermaidLabel(`${reads} → ${writes}/${moves}`);

      lines.push(
        `  ${mermaidIdFor(node.id)} -- "${label}" --> ${mermaidIdFor(t.nextStateId)}`,
      );
    }
  }

  // 10. Abort sentinel classDef (#239) — demand-emit only when the graph
  //     actually references abortState (mirrors the always-vs-demand-emit
  //     split documented on `GraphNode.isAbort` in ./graph.ts). Dashed red
  //     stroke visually sets the terminal-error sentinel apart from the
  //     plain stadium-shaped halt node. There is at most one abort node —
  //     `mermaidIdFor(-1)` is safe to compute directly rather than looking
  //     up the node's own id.
  if (nodes.some((n) => n.isAbort)) {
    lines.push('  classDef abortSentinel stroke:#c0392b,stroke-width:2px,stroke-dasharray:4 3');
    lines.push(`  class ${mermaidIdFor(-1)} abortSentinel`);
  }

  // 11. Tags (#186) — emit one `classDef tag_<name> fill:#...` per unique
  //     tag across all nodes, then one `class <ids> tag_<name>` line per
  //     tag listing every node that carries it (comma-joined for compact
  //     emit). Tag-name → CSS-class identifier sanitization replaces any
  //     char outside `[A-Za-z0-9_-]` with `_`; tag-name uniqueness in the
  //     emit assumes user tags are already distinct after sanitization
  //     (collisions are user error).
  emitTagAnnotations(lines, nodes);

  return lines.join('\n');
}

// Default Mermaid `classDef` palette — 6 visually distinct fill+stroke pairs,
// selected by tag-name hash so multi-tag diagrams look readable out of the
// box without user configuration. Users who want different colors can edit
// the emitted Mermaid before rendering or override post-emit.
const TAG_PALETTE: ReadonlyArray<readonly [string, string]> = [
  ['#fef3c7', '#92400e'], // amber
  ['#dbeafe', '#1e40af'], // blue
  ['#dcfce7', '#166534'], // green
  ['#fce7f3', '#9d174d'], // pink
  ['#ede9fe', '#5b21b6'], // violet
  ['#fee2e2', '#991b1b'], // red
];

function sanitizeTagName(tag: string): string {
  return tag.replace(/[^A-Za-z0-9_-]/g, '_');
}

function tagColor(tag: string): readonly [string, string] {
  // Cheap deterministic hash — sum of char codes mod palette length. Stable
  // across runs; same tag name always picks the same color.
  let h = 0;

  for (let i = 0; i < tag.length; i += 1) {
    h = (h + tag.charCodeAt(i)) % TAG_PALETTE.length;
  }

  return TAG_PALETTE[h];
}

function emitTagAnnotations(lines: string[], nodes: GraphNode[]): void {
  // Collect nodes per tag in node-id order so output is deterministic.
  const nodesByTag = new Map<string, number[]>();

  for (const node of nodes) {
    for (const tag of node.tags) {
      let list = nodesByTag.get(tag);

      if (!list) {
        list = [];
        nodesByTag.set(tag, list);
      }

      list.push(node.id);
    }
  }

  if (nodesByTag.size === 0) return;

  const sortedTags = [...nodesByTag.keys()].sort();

  for (const tag of sortedTags) {
    const sanitized = sanitizeTagName(tag);
    const [fill, stroke] = tagColor(tag);

    lines.push(`  classDef tag_${sanitized} fill:${fill},stroke:${stroke}`);
  }

  for (const tag of sortedTags) {
    const sanitized = sanitizeTagName(tag);
    const ids = nodesByTag.get(tag)!.map((id) => mermaidIdFor(id)).join(',');

    lines.push(`  class ${ids} tag_${sanitized}`);
  }
}

// Helper: identify "the bare states" that anchor a frame's name. A bare is a
// node referenced as some wrapper's `bareStateId`. Body states (also in-frame
// but not bare) are excluded from the frame label.
//
// The caller in `toMermaid` only passes non-wrapper, non-halt-marker nodes
// (wrappers go to a separate bucket; halt markers go to `haltMarkerByFrame`).
// No defensive `isHalt` / `isWrapper` guards needed here.
function isFrameBare(node: GraphNode, graph: Graph): boolean {
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
// Any valid Mermaid node id under the new namespacing (#239): positive user
// states ("u{n}"), the real-halt / per-frame-halt-marker family ("s0",
// "s0-{f}"), or an odd-negative sentinel ("s{k}", e.g. abortState at "s1").
// Reused as a fragment wherever a generic node id may appear — mirrors the
// old scheme's uniform `[sc]\d+` use in the same contexts. Where a specific
// context can only ever hold one kind of id (e.g. a wrapper's own id, always
// positive), the narrower literal (`u\d+`) is used directly instead.
const MERMAID_ID_SRC = 'u\\d+|s\\d+(?:-\\d+)?';

const haltNodeRegex = new RegExp(`^(${MERMAID_ID_SRC})\\(\\(\\(halt\\)\\)\\)$`);
// Abort terminal (#239) — mirrors haltNodeRegex's shape one-for-one.
const abortNodeRegex = new RegExp(`^(${MERMAID_ID_SRC})\\(\\(\\(abort\\)\\)\\)$`);
const regularNodeRegex = /^(u\d+)\["([^"]*)"\]$/;
const wrappedNodeRegex = /^(u\d+)\[\["([^"]*)"\]\]$/;
const subgraphStartRegex = /^subgraph\s+w_(\d+)\["([^"]*)"\]$/;
const subgraphEndRegex = /^end$/;
const idleNodeRegex = /^idle\(\[idle\]\)$/;
const enterArrowRegex = new RegExp(`^idle\\s+-\\.\\s+enter\\s+\\.->\\s+(${MERMAID_ID_SRC})$`);
// Regular labeled transition (solid `-->`). Source is always a regular/bare
// state (positive id) in real toMermaid output, but the target can be any
// node kind (another state, real halt, a frame's halt marker, or abort) —
// both capture groups use the general id fragment for parity with the old
// scheme's `[sc]\d+` breadth here.
const labeledTransitionRegex = new RegExp(`^(${MERMAID_ID_SRC})\\s+--\\s+"(.*)"\\s+-->\\s+(${MERMAID_ID_SRC})$`);
// Wrapper → override (unlabeled solid `-->`).
const wrapperOverrideRegex = new RegExp(`^(${MERMAID_ID_SRC})\\s+-->\\s+(${MERMAID_ID_SRC})$`);
// Call arrow (bold `==>`), with optional `&`-joined source ribbon. Wrapper
// and bare ids are always positive (`u\d+`) — never halt/abort/marker ids.
// Ribbon separator is fixed at " & " (single spaces around &) — toMermaid
// emits exactly that form, so the parser is strict to it. The literal-space
// form avoids CodeQL's polynomial-ReDoS flag on a `\s+&\s+` shape.
const callArrowRegex = /^(u\d+(?: & u\d+)*)\s+==\s+"call"\s+==>\s+(u\d+)$/;
// Return arrow (`w_N -. return .-> u_W` with optional `&` target ribbon).
// Targets are always wrapper ids (positive, `u\d+`).
const returnArrowRegex = /^w_(\d+)\s+-\.\s+"return"\s+\.->\s+(u\d+(?: & u\d+)*)$/;
// Halt arrow (`w_N -. halt .-> s0`) — target is always the literal real-halt
// id, unaffected by the namespacing change.
const haltArrowRegex = /^w_(\d+)\s+-\.\s+"halt"\s+\.->\s+s0$/;
// First capture char anchored as \S to avoid polynomial backtracking between
// the preceding \s* and a permissive (.+); see CodeQL js/polynomial-redos.
const alphabetsRegex = /^%%\s*alphabets:\s*(\S.*)$/;
// Tag annotation lines (#186). Matches both `classDef tag_<sanitized>` and
// `class <id-list> tag_<sanitized>`. ClassDef declarations are decorative
// (palette) and discarded on parse — toMermaid will regenerate them from
// the tag set on re-emit. `class` lines carry the actual graph-node
// assignments; we strip the `tag_` prefix and assign each tag to each
// listed node's `tags` array.
//
// Inter-token gaps are fixed at single literal spaces (matching toMermaid's
// canonical emit) rather than `\s+`. This avoids the polynomial-ReDoS
// pattern CodeQL flags when `\s+` surrounds a content group (see also
// `callArrowRegex` / `returnArrowRegex` tightening in PR #182).
const classDefTagRegex = /^classDef tag_([A-Za-z0-9_-]+) .+$/;
const classAssignTagRegex = new RegExp(`^class ((?:${MERMAID_ID_SRC})(?:,(?:${MERMAID_ID_SRC}))*) tag_([A-Za-z0-9_-]+)$`);
// Abort classDef/class lines (#239) — decorative, like the tag lines above:
// toMermaid regenerates both from `GraphNode.isAbort` on re-emit, so parse
// just skips them rather than round-tripping their literal text.
const classDefAbortRegex = /^classDef abortSentinel .+$/;
const classAssignAbortRegex = new RegExp(`^class (?:${MERMAID_ID_SRC}) abortSentinel$`);

// Splits a node label like `"A<br>hot, sampled"` into its name and tags (#186).
// Labels without `<br>` have no tags. Tags are comma-joined; trimmed of
// whitespace. The `<br>` is the single source of truth for tag-name parsing —
// `class` lines are decorative-only and not consulted here.
//
// Mermaid-label entities (`&lt;`, `&quot;`, etc., #194) are decoded AFTER
// structural splitting: the `<br>` separator and `,` tag delimiter survive
// encode unchanged, and a user state name / tag containing a literal `<br>`
// or `,` was encoded leaf-side so it can't be confused with the structural
// form. Decode at the leaves recovers the original characters.
function splitLabelTags(label: string): {name: string; tags: string[]} {
  const brIx = label.indexOf('<br>');

  if (brIx < 0) {
    return {name: unescapeMermaidLabel(label), tags: []};
  }

  const name = unescapeMermaidLabel(label.slice(0, brIx));
  const tagsStr = label.slice(brIx + '<br>'.length);
  const tags = tagsStr
    .split(',')
    .map((t) => unescapeMermaidLabel(t.trim()))
    .filter((t) => t.length > 0);

  return {name, tags};
}

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
      isAbort?: boolean;
      isHaltMarker?: boolean;
      isWrapper?: boolean;
      bareStateId?: number | null;
      frameId?: number | null;
      tags?: string[];
    } = {},
  ): GraphNode => {
    if (!nodes[id]) {
      nodes[id] = {
        id,
        name: opts.name ?? mermaidIdFor(id),
        isHalt: opts.isHalt ?? false,
        isAbort: opts.isAbort ?? false,
        isHaltMarker: opts.isHaltMarker ?? false,
        isWrapper: opts.isWrapper ?? false,
        bareStateId: opts.bareStateId ?? null,
        frameId: opts.frameId ?? null,
        transitions: [],
        overriddenHaltStateId: null,
        tags: opts.tags ? [...opts.tags] : [],
      };
    } else {
      if (opts.name !== undefined) nodes[id].name = opts.name;
      if (opts.isHalt !== undefined) nodes[id].isHalt = opts.isHalt;
      if (opts.isAbort !== undefined) nodes[id].isAbort = opts.isAbort;
      if (opts.isHaltMarker !== undefined) nodes[id].isHaltMarker = opts.isHaltMarker;
      if (opts.isWrapper !== undefined) nodes[id].isWrapper = opts.isWrapper;
      if (opts.bareStateId !== undefined) nodes[id].bareStateId = opts.bareStateId;
      if (opts.frameId !== undefined) nodes[id].frameId = opts.frameId;
      if (opts.tags !== undefined) {
        for (const t of opts.tags) {
          if (!nodes[id].tags.includes(t)) nodes[id].tags.push(t);
        }
      }
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

    // Tag annotations (#186) — classDef lines are decorative and skipped;
    // `class` lines are parsed in the edge pass since they reference nodes
    // by id and need those nodes already created in the first pass.
    if (classDefTagRegex.test(line)) continue;

    // Abort sentinel classDef (#239) — same decorative-skip treatment.
    if (classDefAbortRegex.test(line)) continue;

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

    // Abort terminal (#239) — mirrors the halt-node parse above. Always
    // top-level (frameId null): abort is never a bare or an override target
    // (see the `GraphNode.isAbort` doc in ./graph.ts), so — unlike halt —
    // there's no in-frame "marker" variant to distinguish here.
    const abm = line.match(abortNodeRegex);

    if (abm) {
      ensureNode(parseMermaidId(abm[1]), {
        name: 'abort',
        isAbort: true,
      });

      continue;
    }

    const wm = line.match(wrappedNodeRegex);

    if (wm) {
      const {name, tags} = splitLabelTags(wm[2]);

      ensureNode(parseMermaidId(wm[1]), {
        name,
        isWrapper: true,
        tags,
      });

      continue;
    }

    const rm = line.match(regularNodeRegex);

    if (rm) {
      const {name, tags} = splitLabelTags(rm[2]);

      ensureNode(parseMermaidId(rm[1]), {
        name,
        frameId: currentFrameId,
        tags,
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

    // Abort sentinel classDef/class lines (#239) — decorative, like the tag
    // classDef lines skipped in the first pass; `GraphNode.isAbort` is
    // already set from the `(((abort)))` node declaration, so there's
    // nothing left for this line to contribute.
    if (classDefAbortRegex.test(line) || classAssignAbortRegex.test(line)) {
      continue;
    }

    // Tag class-assignment line (#186): `class u1,u5 tag_hot` — adds
    // the tag to each listed node. Tag-name preserved as written
    // (sanitization on emit is lossy in principle; on parse we don't
    // un-sanitize, since the original could have any characters).
    const tagMatch = line.match(classAssignTagRegex);

    if (tagMatch) {
      const ids = tagMatch[1].split(',');
      const tagName = tagMatch[2];

      for (const idStr of ids) {
        ensureNode(parseMermaidId(idStr), {tags: [tagName]});
      }

      continue;
    }

    // `call` arrow — sets bareStateId on each source wrapper.
    const cm = line.match(callArrowRegex);

    if (cm) {
      const sources = cm[1].split(' & ');
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

      // The wrapper-override regex only matches an unlabeled solid arrow
      // (`X --> Y`); since `toMermaid` only emits this shape from wrappers,
      // the source is guaranteed to be a wrapper if `fromMermaid`'s input
      // came from `toMermaid`. `nodes[fromId]` is always populated (first
      // pass emits node declarations before any edge parsing).
      if (nodes[fromId].isWrapper) {
        nodes[fromId].overriddenHaltStateId = toId;
        continue;
      }
      // Fall through — unlabeled solid from a non-wrapper is unexpected;
      // treated as a malformed line and ignored by the labeled-regex below.
    }

    const tm = line.match(labeledTransitionRegex);

    if (tm) {
      const fromId = parseMermaidId(tm[1]);
      // Decode the WHOLE captured label up front (#194). Structural
      // separators (`[`, `]`, `,`, `|`, `/`, ` → `) are all safe ASCII
      // outside the escape set and pass through encode unchanged, so it's
      // safe to decode before structural parsing; only embedded alphabet
      // symbols inside `'...'` get reconstituted.
      const label = unescapeMermaidLabel(tm[2]);
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
