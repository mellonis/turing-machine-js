# `@turing-machine-js/visuals` 7.0.0-alpha.6.1 — formatter enhancements

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Extend visuals's formatter surface so it (a) covers the richness machines-demo's `format.ts` already provides — the upcoming demo cleanup PR can drop `format.ts` and call visuals's primitives directly — AND (b) ships a renderer-agnostic structured-token surface so UIs beyond the demo (article embeds, snippet panels, terminal tools) can render the same per-step data in their own format without re-implementing the per-cell encoding logic. Pure additive change to visuals.

**Tracks:** Unblocks the `format.ts` portion of the [machines-demo visuals-cleanup plan](../../../../machines-demo/docs/superpowers/plans/2026-05-30-visuals-cleanup.md). Owns two gaps I missed when implementing the alpha.6 formatters (Task 10 of #220):
1. I designed minimal primitives in a vacuum when demo's `format.ts` was the de facto requirement spec.
2. I made `formatStepNotation`-equivalent monolithic (returns one specific string format), so UIs wanting different rendering had to re-implement the per-cell logic from scratch. The `tokenizeStep` + `ReadToken`/`WriteToken` surface fixes that — string rendering is now ONE of many possible presentations.

**Branch:** `feat/visuals-alpha7-formatters` (off `v7`). Branch name reflects the initial alpha.7 draft; the version shipped is `7.0.0-alpha.6.1` after a mid-draft rename. Branch identifier doesn't matter; the version that ships is what counts.

**Architecture:** `tokenizeStep` is the primary primitive — takes `(reads, commands, blanks, matchKinds?)` and returns `StepTokens` (per-tape discriminated-union tokens for reads/writes/moves). `formatStepNotation` is a thin string renderer that consumes `tokenizeStep`'s output and joins it with the engine edge-label vocabulary (`[reads] → [writes]/[moves]`). UIs wanting different presentations call `tokenizeStep` and walk tokens themselves. alpha.6's `formatStep(m)` and `formatCommand(tapeCommand)` stay untouched (backward-compat for any caller). Mirror demo's `format.ts:formatStepNotation` byte-for-byte at the rendering layer — same encoding rules, same multi-tape join, same null-`reads` manual-Apply handling, same `K='X'` / `B` / `E` shortcuts. The demo-side migration in the cleanup PR becomes: drop local `formatStepNotation`, drop local `formatTape`, change two internal imports to consume from `@turing-machine-js/visuals`.

---

## Decisions (locked)

- **Visuals-only bump to `7.0.0-alpha.6.1`.** Engine + builder + library-binary-numbers + library-binary-numbers-bare stay at `7.0.0-alpha.6` — they have no changes; bumping them would create ghost releases (identical tarballs published under a new version). The workspace's lockstep convention exists for coordinated peer-dep widening when engine APIs break; an additive visuals-only release doesn't trigger it. Peer-dep coherence holds: visuals's `@turing-machine-js/machine: ^7.0.0-alpha.6` accepts alpha.6.1+ via semver-prerelease caret, so consumers don't need a coordinated upgrade.
- **Version name `alpha.6.1` (not `alpha.7`).** Communicates "additive follow-up patch on alpha.6," not "new alpha milestone." Reserves `alpha.7` for the next real engine bump. Semver ordering is correct (`alpha.6 < alpha.6.1 < alpha.7`) and caret ranges `^7.0.0-alpha.6` accept it.
- **alpha.6 surface stays intact.** `formatStep(m: MachineState): string` and `formatCommand(tapeCommand: TapeCommand): string` remain exactly as published. New primitives are added alongside. No deprecation in alpha.6.1.
- **Primary primitive: `tokenizeStep(reads, commands, blanks, matchKinds?)`** — renderer-agnostic structured-token output. Returns `StepTokens = { reads: ReadToken[] | null; writes: WriteToken[]; moves: ('L'|'R'|'S')[] }` where:
  - `ReadToken = { kind: 'literal'; symbol: string } | { kind: 'blank' } | { kind: 'wildcard'; symbol: string }`
  - `WriteToken = { kind: 'literal'; symbol: string } | { kind: 'erase' } | { kind: 'keep'; readContext?: { symbol: string; isBlank: boolean } }`
  UIs that want non-string rendering (HTML spans with CSS classes, ANSI escape codes, clickable cells, alternative move vocabulary, JSON for embeds) walk the tokens themselves. Same input contract as `formatStepNotation` — same engine vocabulary, same null-`reads` manual-Apply handling, same wildcard suppression of the blank shortcut.
- **`formatStepNotation` is now a thin string renderer over `tokenizeStep`.** Output is byte-identical to a from-scratch port of demo's `formatStepNotation` (verified — all 24 existing format-spec cases pass unchanged after the refactor). String rendering is one of many possible presentations of the same structured data.
- **New primitive: `formatTape(tape: TapeSnapshot)`** — verbatim port of demo's `formatTape`. No tokenizer variant (single-tape rendering is structurally trivial; no per-cell discrimination needed beyond head-vs-other, which the simple string form captures fine).
- **`StepCommand` parameter type defined locally in visuals.** Plain `{ movement: 'L'|'R'|'S'; symbol: string | null }` — distinct from engine's `TapeCommand` class. Coupling formatters/tokenizers to a specific engine class adds zero value; consumers passing plain data from snippet frames / log lines / worker boundaries don't have to construct engine class instances just to format a string.
- **Demo migration is NOT in this PR.** That happens in the machines-demo cleanup PR, after alpha.6.1 publishes.

---

## File Structure

```
packages/visuals/
├── src/
│   ├── format.ts         # MODIFY — add StepCommand + tokenizeStep + token types
│   │                                 + formatStepNotation (delegates to tokenizeStep)
│   │                                 + formatTape; keep alpha.6 fns intact
│   ├── format.spec.ts    # MODIFY — test cases for tokenizeStep, formatStepNotation, formatTape
│   └── index.ts          # MODIFY — export all new symbols
├── CHANGELOG.md          # MODIFY — new [7.0.0-alpha.6.1] entry
└── package.json          # MODIFY — version bump 7.0.0-alpha.6 → 7.0.0-alpha.6.1

package-lock.json         # MODIFY — auto-resync (visuals's lock entry only)
```

Note: `lerna.json`'s `version` field stays at the engine's `7.0.0-alpha.6` — this release intentionally diverges from lerna's single-version model. Per-package versions are the authoritative source for `lerna publish from-package`; the `lerna.json` version is informational when `independent` mode isn't set, and is fine to leave stale for this kind of single-package release. (Reconsider if lerna emits a warning at publish time.)

Public API delta after this PR:

```ts
// Existing (alpha.6) — unchanged
export function formatCommand(tapeCommand: TapeCommand): string;
export function formatStep(m: MachineState): string;

// New (alpha.6.1) — structured-token surface (primary primitive)
export type StepCommand = {
  movement: 'L' | 'R' | 'S';
  symbol: string | null;  // null = keep
};

export type ReadToken =
  | { kind: 'literal'; symbol: string }
  | { kind: 'blank' }
  | { kind: 'wildcard'; symbol: string };

export type WriteToken =
  | { kind: 'literal'; symbol: string }
  | { kind: 'erase' }
  | { kind: 'keep'; readContext?: { symbol: string; isBlank: boolean } };

export type StepTokens = {
  reads: readonly ReadToken[] | null;  // null = manual Apply
  writes: readonly WriteToken[];
  moves: readonly ('L' | 'R' | 'S')[];
};

export function tokenizeStep(
  reads: readonly string[] | null,
  commands: readonly StepCommand[],
  blanks: readonly string[],
  matchKinds?: readonly ('wildcard' | 'literal')[] | null,
): StepTokens;

// New (alpha.6.1) — string rendering (thin renderer over tokenizeStep)
export function formatStepNotation(
  reads: readonly string[] | null,
  commands: readonly StepCommand[],
  blanks: readonly string[],
  matchKinds?: readonly ('wildcard' | 'literal')[] | null,
): string;

// New (alpha.6.1) — tape rendering
export function formatTape(tape: TapeSnapshot): string;
```

---

## Task 1: Add tokens + tokenizer + renderers + tape formatter to `format.ts`

**Files:** `packages/visuals/src/format.ts`

- [ ] **Step 1: Read demo's `format.ts` as the source spec**

`../machines-demo/src/lib/format.ts:33-84` — the `formatStepNotation` function body + its JSDoc + the `formatTape` function. The port is a refactor (not a verbatim copy): demo's monolithic string function splits into `tokenizeStep` (structured output) + `formatStepNotation` (thin string renderer over tokens). Final string output is byte-identical.

- [ ] **Step 2: Define `StepCommand` + token types**

Add to `packages/visuals/src/format.ts`:

```ts
import type { TapeSnapshot } from './types';

export type StepCommand = {
  movement: 'L' | 'R' | 'S';
  symbol: string | null;
};

export type ReadToken =
  | { kind: 'literal'; symbol: string }
  | { kind: 'blank' }
  | { kind: 'wildcard'; symbol: string };

export type WriteToken =
  | { kind: 'literal'; symbol: string }
  | { kind: 'erase' }
  | { kind: 'keep'; readContext?: { symbol: string; isBlank: boolean } };

export type StepTokens = {
  reads: readonly ReadToken[] | null;
  writes: readonly WriteToken[];
  moves: readonly ('L' | 'R' | 'S')[];
};
```

`StepCommand` is the plain per-tape command shape (NOT engine's `TapeCommand` class). Lets callers pass data from snippet frames / log lines / worker boundaries without constructing engine class instances.

- [ ] **Step 3: Add `tokenizeStep`**

```ts
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

  if (reads === null) return { reads: null, writes, moves };

  const readTokens: ReadToken[] = reads.map((r, i) => {
    if (matchKinds?.[i] === 'wildcard') return { kind: 'wildcard', symbol: r };
    if (r === blanks[i]) return { kind: 'blank' };
    return { kind: 'literal', symbol: r };
  });

  return { reads: readTokens, writes, moves };
}
```

- [ ] **Step 4: Add `formatStepNotation` as a thin renderer over `tokenizeStep`**

```ts
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
```

`renderReadToken` / `renderWriteToken` are internal helpers — NOT exported. Consumers wanting custom rendering call `tokenizeStep` directly and write their own per-cell renderers (HTML spans, ANSI escape codes, etc.).

- [ ] **Step 5: Add `formatTape`**

```ts
export function formatTape(tape: TapeSnapshot): string {
  return tape.symbols
    .map((sym, i) => (i === tape.position ? `[${sym}]` : sym))
    .join('');
}
```

Verbatim port of demo's `formatTape`.

- [ ] **Step 6: Typecheck**

```sh
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js run typecheck
```

Expected: clean.

---

## Task 2: Add tests

**Files:** `packages/visuals/src/format.spec.ts`

Three test groups: `formatStepNotation` (string output assertions), `tokenizeStep` (structured-token assertions), `formatTape` (string output).

- [ ] **Step 1: `formatStepNotation` cases (10 cases)**

Each asserts the exact output string. Mirrors demo's encoding rules byte-for-byte; serves as the regression net that catches any drift in the token→string render path.

- Single-tape literal: `formatStepNotation(['a'], [{symbol: 'b', movement: 'R'}], [' '], ['literal'])` → `"['a'] → ['b']/[R]"`
- Single-tape blank read (non-wildcard): `([' '], [{...}], [' '], ['literal'])` → `[B] → ...`
- Single-tape wildcard read: `(['a'], [...], [' '], ['wildcard'])` → `"[*='a'] → ..."` (wildcard marker, NOT `B` shortcut)
- Single-tape wildcard read with blank: `([' '], [...], [' '], ['wildcard'])` → `"[*=' '] → ..."` (wildcard preserves literal even when blank)
- Single-tape keep with read: `(['a'], [{symbol: null, movement: 'S'}], [' '], ['literal'])` → `"['a'] → [K='a']/[S]"`
- Single-tape keep with blank read: `([' '], [{symbol: null, ...}], [' '], ['literal'])` → `"[B] → [K=B]/[S]"`
- Single-tape erase: `(['a'], [{symbol: ' ', movement: 'L'}], [' '], ['literal'])` → `"['a'] → [E]/[L]"`
- Manual-Apply (no reads): `formatStepNotation(null, [{symbol: 'b', movement: 'R'}], [' '], null)` → `"['b']/[R]"` (no `[reads] →` prefix)
- Manual-Apply with keep: `formatStepNotation(null, [{symbol: null, ...}], [' '], null)` → `"[K]/[S]"` (bare K — no read context)
- Multi-tape mixed wildcard + literal: `(['a','x'], [...,...], [' ',' '], ['wildcard','literal'])` → `"[*='a','x'] → ['b','y']/[R,S]"`
- Omitted matchKinds: defaults to literal everywhere, no wildcards.

- [ ] **Step 2: `tokenizeStep` cases (10 cases)**

Each asserts the structured shape. These prove the tokenizer is correct independently of the string renderer; consumers who skip the string renderer rely on these.

- Literal read + literal write: full `StepTokens` object with `{ kind: 'literal', symbol: ... }` variants.
- Blank read (non-wildcard) → `{ kind: 'blank' }`.
- Wildcard read → `{ kind: 'wildcard', symbol: ' ' }` (no blank shortcut).
- Keep with non-blank read → `{ kind: 'keep', readContext: { symbol: 'a', isBlank: false } }`.
- Keep with blank read → `{ kind: 'keep', readContext: { symbol: ' ', isBlank: true } }`.
- Erase → `{ kind: 'erase' }`.
- Manual Apply (`reads === null`): `tokens.reads === null`, `keep` writes carry no `readContext`.
- Omitted matchKinds: reads are all `{ kind: 'literal' | 'blank' }` (no wildcards).
- Multi-tape: arrays line up per index across reads/writes/moves; mixed wildcard + literal + blank tokens.
- Consistency invariant: `formatStepNotation(args)` for given args equals the manual string render of `tokenizeStep(args).{reads,writes,moves}` — confirms the two surfaces describe the same step. (One sentinel case is enough.)

- [ ] **Step 3: `formatTape` cases (5 cases)**

- Head in middle: `formatTape({symbols: ['a','b','c'], position: 1})` → `"a[b]c"`
- Head at start: `{symbols: ['a','b'], position: 0}` → `"[a]b"`
- Head at end: `{symbols: ['a','b'], position: 1}` → `"a[b]"`
- Single-cell: `{symbols: ['x'], position: 0}` → `"[x]"`
- Blank glyph rendered literally: `{symbols: [' ','a',' '], position: 0}` → `"[ ]a "` (spaces pass through literally, joined with empty string — NOT space-separated)

- [ ] **Step 4: Run the spec + full verify**

```sh
npx --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js vitest run packages/visuals/src/format.spec.ts
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js test
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js run typecheck
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js run lint
```

All green. Total visuals format spec count = 8 (alpha.6 `formatCommand` + `formatStep`) + 10 (`formatStepNotation`) + 10 (`tokenizeStep`) + 5 (`formatTape`) = **33**. Full repo test count goes from 616 → **642**.

---

## Task 3: Wire exports

**Files:** `packages/visuals/src/index.ts`

- [ ] **Step 1: Merge into the existing format export line**

Replace:
```ts
export { formatCommand, formatStep } from './format';
```

With:
```ts
export {
  formatCommand,
  formatStep,
  formatStepNotation,
  formatTape,
  tokenizeStep,
  type StepCommand,
  type ReadToken,
  type WriteToken,
  type StepTokens,
} from './format';
```

- [ ] **Step 2: Verify**

Re-run typecheck + a build to confirm `dist/` includes the new symbols:

```sh
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js run build
```

Expected: clean. `dist/format.d.ts` exports all new functions + types; `dist/index.{cjs,mjs,d.ts}` re-export them. `Built @turing-machine-js/visuals Node entries` confirms Rollup runs cleanly.

---

## Task 4: Bump visuals + CHANGELOG + commit

**Files:** `packages/visuals/package.json`, `packages/visuals/CHANGELOG.md`, `package-lock.json`.

- [ ] **Step 1: Bump version**

Edit `packages/visuals/package.json`:
```diff
-  "version": "7.0.0-alpha.6",
+  "version": "7.0.0-alpha.6.1",
```

Peer-dep range stays `"@turing-machine-js/machine": "^7.0.0-alpha.6"` — semver-prerelease caret already accepts alpha.6.1+.

Resync `package-lock.json`:
```sh
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js install --package-lock-only
```

Only the visuals workspace entry in `package-lock.json` should change.

- [ ] **Step 2: Add the CHANGELOG entry**

`packages/visuals/CHANGELOG.md` — add above `[7.0.0-alpha.6]`:

```markdown
## [7.0.0-alpha.6.1] - 2026-05-30

### Added

- `formatStepNotation(reads, commands, blanks, matchKinds?)` — engine edge-label format primitive, matches `toMermaid` emit byte-for-byte. Per-cell encoding: literal `'X'`, blank shortcut `B`, wildcard `*='X'` (shows what `ifOtherSymbol` caught), keep-with-concrete-symbol `K='X'` / `K=B`, erase `E`. Multi-tape comma-separated within one outer bracket per role. Pass `reads === null` for the manual-Apply path — output collapses to `[writes]/[moves]`. Folds in the richness machines-demo's local `format.ts` had so demo can drop the local helper and call visuals's primitive directly.
- `tokenizeStep(reads, commands, blanks, matchKinds?)` + `ReadToken` / `WriteToken` / `StepTokens` types — renderer-agnostic structured form of one step. Same input contract as `formatStepNotation`; returns discriminated-union tokens per cell. Consumers wanting custom rendering (HTML spans with CSS classes, ANSI-colored terminal output, alternative move vocabulary, clickable cells) walk the tokens themselves. `formatStepNotation` is refactored to be a thin string renderer over `tokenizeStep` (output byte-identical).
- `formatTape(tape)` — inline tape rendering with the head bracketed in place (`a[b]c`).
- `StepCommand` — plain per-tape command shape (`{ movement: 'L' | 'R' | 'S'; symbol: string | null }`) consumed by `formatStepNotation` and `tokenizeStep`. Distinct from engine's `TapeCommand` class; matches the shape machines-demo's worker boundary exposes.

### Compatibility

- alpha.6's `formatCommand(tapeCommand)` and `formatStep(m)` unchanged. Additive release.
- Engine + builder + library-binary-numbers + library-binary-numbers-bare stay at `7.0.0-alpha.6` — no functional changes there. Visuals-only follow-up patch; the workspace's lockstep convention is for coordinated peer-dep widening when engine APIs break, not for additive consumer-package enhancements.
- Peer dep `@turing-machine-js/machine: ^7.0.0-alpha.6` unchanged (semver-prerelease caret already accepts `alpha.6.1`).
```

- [ ] **Step 3: Verify, then commit**

`git -C ... status` — should show: `packages/visuals/package.json`, `packages/visuals/CHANGELOG.md`, `package-lock.json`, plus the Task 1-3 source/test/index changes.

Commit in two or three focused commits for a clean bisect. The actual PR (#221) used:

1. `feat(visuals): add formatStepNotation + formatTape primitives (#204)` — Task 1 (partial: types, formatStepNotation, formatTape) + Task 2 (tests for those) + Task 3 (export) + plan doc
2. `release(visuals): 7.0.0-alpha.6.1 — formatter enhancements` — Task 4 (version + CHANGELOG + lockfile)
3. `feat(visuals): add tokenizeStep + ReadToken/WriteToken/StepTokens for renderer-agnostic step rendering (#204)` — Task 1 (remainder: tokens, tokenizeStep, refactored formatStepNotation to delegate) + Task 2 (tokenizer tests) + Task 3 (extended export) + CHANGELOG amend

The 3rd commit is the tokenizer fold — added mid-execution after the design discussion landed on Option B (structured tokens) as the right shape. A clean redo of this plan would land all of it as commit (1), but per the user's no-amend rule the fold became its own commit.

- [ ] **Step 4: Push**

```sh
git -C /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js push -u origin feat/visuals-alpha7-formatters
```

---

## Task 5: Open PR

- [ ] **Step 1: Open PR against `v7`**

`gh pr create --repo mellonis/turing-machine-js --base v7 --head feat/visuals-alpha7-formatters --title "feat(visuals): alpha.6.1 — formatStepNotation + tokenizeStep + formatTape"` with a body covering: summary (formatter richness + structured-token surface), public API delta (the full block from this plan's File Structure section), versioning (visuals-only bump, alpha.6.1 over alpha.7), test plan, publish + follow-up notes pointing at the machines-demo cleanup plan.

The actual PR landed at https://github.com/mellonis/turing-machine-js/pull/221.

---

## Self-review checklist

- [ ] `formatStepNotation` output is byte-identical to a from-scratch port of demo's helper — verified by running demo's existing format-spec assertions against the refactored implementation (24/24 pass unchanged).
- [ ] `tokenizeStep` returns the expected discriminated-union shape for every encoding branch (literal, blank, wildcard reads; literal, erase, keep writes; keep carries `readContext` when reads available, omits when manual Apply).
- [ ] `formatTape` body matches demo's verbatim.
- [ ] alpha.6 surface (`formatCommand`, `formatStep`) unchanged.
- [ ] CHANGELOG entry under `[7.0.0-alpha.6.1]`, dated `2026-05-30`, lists all four new public symbols (`formatStepNotation`, `tokenizeStep`, `formatTape`, `StepCommand`) plus the three token types.
- [ ] package.json at `7.0.0-alpha.6.1`; peer dep unchanged at `^7.0.0-alpha.6`.
- [ ] No Claude attribution footers in commits.
- [ ] Tests cover both string output (10 `formatStepNotation` cases + 5 `formatTape`) AND structured tokens (10 `tokenizeStep` cases including a consistency invariant that ties the two surfaces together).

---

## After this lands

1. **Publish** — `cd turing-machine-js && npx lerna publish from-package --dist-tag next --yes`. Only visuals publishes (engine + builder + libs are already on the registry at alpha.6, lerna skips them). Same catch-up-publish flow as alpha.6's initial visuals publish.
2. **Tagging:** **no new GH release** for `v7.0.0-alpha.6.1`. The git tag scheme tracks engine versions; visuals-only releases ship under the existing engine tag (alpha.6 in this case). Optionally edit the `v7.0.0-alpha.6` GH release body to add a short follow-up note pointing at visuals's CHANGELOG.
3. **Resume the machines-demo cleanup PR plan.** With alpha.6.1 published, the cleanup PR additionally:
   - Bumps the demo's visuals dep to `^7.0.0-alpha.6.1` (via `npm install @turing-machine-js/visuals@next`).
   - Deletes demo's local `formatStepNotation` (was internal) — call sites in `commandsEntry` switch to importing from `@turing-machine-js/visuals`.
   - Deletes demo's local `formatTape` export — callers switch to visuals's.
   - Keeps `tapesEntry`, `commandsEntry`, `CommandsApplication` in demo (LogEntry assembly is demo-specific).
   - Could also adopt `tokenizeStep` for any demo paths that want richer rendering than the default string format — purely opportunistic, not required for the cleanup.

---

## Out of scope

- **Engine bump.** No engine changes in this alpha.
- **Backwards-compat shims for the alpha.6 formatters.** `formatCommand(tapeCommand)` and `formatStep(m)` stay live, unchanged. Future deprecation, if any, is a separate decision.
- **GH release for `v7.0.0-alpha.6.1`.** Skipped — tag scheme tracks engine versions, and the engine isn't bumping. Optionally edit the existing `v7.0.0-alpha.6` release body to note the visuals follow-up.
- **`renderReadToken` / `renderWriteToken` as public exports.** They're internal helpers backing `formatStepNotation`'s string rendering. Consumers wanting custom rendering call `tokenizeStep` and walk tokens themselves — exposing the per-cell string renderers would just be a confusing partial-customization API ("you can change the join but not the tokens? or the tokens but not the join?"). Add later only if a real consumer asks.
- **Demo migration.** That's the cleanup PR's job, after this publishes.
