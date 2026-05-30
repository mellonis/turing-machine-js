# `@turing-machine-js/visuals` 7.0.0-alpha.6.1 — formatter enhancements

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** Extend visuals's string-formatter surface to cover the richness machines-demo's `format.ts` already provides, so the upcoming demo cleanup PR can drop `format.ts` and call visuals's primitives directly. Pure additive change to visuals.

**Tracks:** Unblocks the format.ts portion of the [machines-demo visuals-cleanup plan](../../../../machines-demo/docs/superpowers/plans/2026-05-30-visuals-cleanup.md). Owns the gap I missed when implementing the alpha.6 formatters (Task 10 of #220) — I designed minimal primitives in a vacuum when demo's `format.ts` was the de facto requirement spec.

**Branch:** `feat/visuals-alpha7-formatters` (off `v7`).

**Architecture:** Add the rich primitive (`formatStepNotation`) + `formatTape` to visuals's existing `format.ts`. alpha.6's `formatStep(m)` and `formatCommand(tapeCommand)` stay untouched (backward-compat for any caller). Mirror demo's `format.ts:formatStepNotation` verbatim — same encoding rules, same multi-tape join, same null-`reads` manual-Apply handling, same `K='X'` / `B` / `E` shortcuts. The demo-side migration in the cleanup PR becomes: drop local `formatStepNotation`, drop local `formatTape`, change two internal imports to consume from `@turing-machine-js/visuals`.

---

## Decisions (locked)

- **Visuals-only bump to `7.0.0-alpha.6.1`.** Engine + builder + library-binary-numbers + library-binary-numbers-bare stay at `7.0.0-alpha.6` — they have no changes; bumping them would create ghost releases (identical tarballs published under a new version). The workspace's lockstep convention exists for coordinated peer-dep widening when engine APIs break; an additive visuals-only release doesn't trigger it. Peer-dep coherence holds: visuals's `@turing-machine-js/machine: ^7.0.0-alpha.6` accepts alpha.6.1+ via semver-prerelease caret, so consumers don't need a coordinated upgrade.
- **alpha.6 surface stays intact.** `formatStep(m: MachineState): string` and `formatCommand(tapeCommand: TapeCommand): string` remain exactly as published. New primitives are added alongside. No deprecation in alpha.6.1.
- **New primitive: `formatStepNotation(reads, commands, blanks, matchKinds?)`** — verbatim port of demo's internal helper, now exported. Signature mirrors demo's: `reads: readonly string[] | null` (null = manual Apply), `commands: readonly Command[]` (per-tape), `blanks: readonly string[]` (per-tape blank symbols), `matchKinds?: readonly ('wildcard' | 'literal')[] | null` (per-tape; null = no transition fired).
- **New primitive: `formatTape(tape: TapeSnapshot)`** — verbatim port of demo's `formatTape`.
- **Demo migration is NOT in this PR.** That happens in the machines-demo cleanup PR, after alpha.6.1 publishes.
- **No new `Command` import dependency.** The engine's `Command` type is already in visuals's import surface (used by alpha.6's `formatCommand`). No new public API surface beyond what's strictly needed.

---

## File Structure

```
packages/visuals/
├── src/
│   ├── format.ts         # MODIFY — add formatStepNotation + formatTape; keep alpha.6 fns intact
│   ├── format.spec.ts    # MODIFY — add test cases for the new primitives
│   └── index.ts          # MODIFY — export formatStepNotation + formatTape
├── CHANGELOG.md          # MODIFY — new [7.0.0-alpha.6.1] entry
└── package.json          # MODIFY — version bump 7.0.0-alpha.6 → 7.0.0-alpha.6.1

package-lock.json         # MODIFY — auto-resync (visuals's lock entry only)
```

Note: `lerna.json`'s `version` field stays at the engine's `7.0.0-alpha.6` — this release intentionally diverges from lerna's single-version model. Per-package versions are the authoritative source for `lerna publish from-package`; the `lerna.json` version is informational only when `independent` mode isn't set, and is fine to leave stale for this kind of single-package release. (Reconsider if lerna emits a warning at publish time.)

Public API delta after this PR:

```ts
// Existing (alpha.6) — unchanged
export function formatCommand(tapeCommand: TapeCommand): string;
export function formatStep(m: MachineState): string;

// New (alpha.6.1)
export function formatStepNotation(
  reads: readonly string[] | null,
  commands: readonly Command[],
  blanks: readonly string[],
  matchKinds?: readonly ('wildcard' | 'literal')[] | null,
): string;
export function formatTape(tape: TapeSnapshot): string;
```

---

## Task 1: Add `formatStepNotation` + `formatTape` to `format.ts`

**Files:** `packages/visuals/src/format.ts`

- [ ] **Step 1: Read demo's `format.ts` as the source spec**

`../machines-demo/src/lib/format.ts:33-84` — the `formatStepNotation` function body + its JSDoc, plus the `formatTape` function. Port both verbatim into visuals.

- [ ] **Step 2: Add to `packages/visuals/src/format.ts`**

Append after the existing `formatStep` / `formatCommand`:

```ts
import type { Command, TapeSnapshot } from '@turing-machine-js/machine';   // adjust to existing imports

/**
 * Engine edge-label format — `[reads] → [writes]/[moves]`. Matches
 * `toMermaid` emit so a logged step's notation lines up byte-for-byte with
 * the same transition's edge label in the rendered state graph.
 *
 * Per-cell encoding:
 * - Read cell: `'X'` (literal) or `B` (blank, non-wildcard only). Wildcard
 *   reads render as `*='X'` (showing what `ifOtherSymbol` caught). When
 *   `matchKinds` is omitted (manual Apply), every position renders as a literal.
 * - Write cell: `'X'` (literal) | `K='X'` (keep with concrete kept symbol)
 *   | `K` (keep, no read context) | `E` (erase, write equals blank).
 * - Move cell: `L` | `R` | `S`.
 *
 * Multi-tape: per-tape entries comma-separated inside one outer bracket
 * per role: `['1','a'] → ['0','b']/[R,L]`.
 *
 * Pass `reads === null` for the manual-Apply path (no transition fired) —
 * output collapses to `[writes]/[moves]`.
 */
export function formatStepNotation(
  reads: readonly string[] | null,
  commands: readonly Command[],
  blanks: readonly string[],
  matchKinds?: readonly ('wildcard' | 'literal')[] | null,
): string {
  // VERBATIM port from machines-demo/src/lib/format.ts:formatStepNotation —
  // see that file for the per-cell encoding rationale. Do NOT alter shape.
  const writes = commands.map((c, i) => {
    if (c.symbol === null) {
      if (reads !== null) {
        const r = reads[i];
        if (r !== undefined) return r === blanks[i] ? 'K=B' : `K='${r}'`;
      }
      return 'K';
    }
    if (c.symbol === blanks[i]) return 'E';
    return `'${c.symbol}'`;
  }).join(',');
  const moves = commands.map((c) => c.movement).join(',');
  const writesPart = `[${writes}]/[${moves}]`;

  if (reads === null) return writesPart;

  const readsStr = reads.map((r, i) => {
    if (matchKinds?.[i] === 'wildcard') return `*='${r}'`;
    return r === blanks[i] ? 'B' : `'${r}'`;
  }).join(',');
  return `[${readsStr}] → ${writesPart}`;
}

/** Inline tape rendering: head bracketed in place. `[<blank>]` is fine —
 *  user controls the blank glyph. */
export function formatTape(tape: TapeSnapshot): string {
  return tape.symbols
    .map((sym, i) => (i === tape.position ? `[${sym}]` : sym))
    .join('');
}
```

**Verify before writing:** the `Command` type is already imported (it backs alpha.6's `formatCommand`); just add `TapeSnapshot` to the type import. If the existing file uses `c.movement` strings vs symbols, mirror demo exactly — demo treats `c.movement` as a `string` ('L'|'R'|'S') in this context (it comes from `Command` per demo's types, which may differ from engine `TapeCommand`). Read demo's `Command` type definition (`../machines-demo/src/lib/types.ts`) to confirm shape; if demo's `Command` is `{ movement: 'L'|'R'|'S'; symbol: string | null }` (string movement), and visuals's engine `Command` differs, you may need to adapt the port — but DO NOT change the output format.

> **If the engine `Command` shape differs enough that a verbatim port doesn't compile**, raise it as a DONE_WITH_CONCERNS. Two acceptable resolutions: (a) take the formatter's input type as the demo's shape (`{ movement: 'L'|'R'|'S'; symbol: string | null }[]`) instead of engine `Command[]`, since these formatters serve consumers who already have that shape from snippet frames / log lines; (b) keep engine `Command[]` and translate fields at the call site. (a) is likely cleaner — the formatter is a string producer over a fixed shape; coupling it to a specific engine class adds zero value.

- [ ] **Step 3: Typecheck**

```sh
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js run typecheck
```

Expected: clean.

---

## Task 2: Add tests for `formatStepNotation` + `formatTape`

**Files:** `packages/visuals/src/format.spec.ts`

- [ ] **Step 1: Add cases to format.spec.ts**

Mirror the encoding rules in tests. Each case asserts the exact output string. Recommended cases (8+ cases):

- Single-tape literal: `formatStepNotation(['a'], [{symbol: 'b', movement: 'R'}], [' '], ['literal'])` → `"['a'] → ['b']/[R]"`
- Single-tape blank read: `(['  '], [{...}], [' '], ['literal'])` → `[B] → ...` (blank shortcut on read)
- Single-tape wildcard read: `(['a'], [...], [' '], ['wildcard'])` → `"[*='a'] → ..."` (wildcard marker, NOT `B` shortcut)
- Single-tape keep with read: `(['a'], [{symbol: null, movement: 'S'}], [' '], ['literal'])` → `"['a'] → [K='a']/[S]"`
- Single-tape keep blank: same shape with `reads === blank` → `K=B`
- Single-tape erase: `(['a'], [{symbol: ' ', movement: 'L'}], [' '], ['literal'])` → `"['a'] → [E]/[L]"`
- Manual-Apply (no reads): `formatStepNotation(null, [{symbol: 'b', movement: 'R'}], [' '], null)` → `"['b']/[R]"` (no `[reads] →` prefix)
- Multi-tape: `(['a', 'b'], [{...}, {...}], [' ', ' '], ['literal', 'wildcard'])` → `"['a',*='b'] → [...]/[...]"`
- formatTape: `formatTape({symbols: ['a', 'b', 'c'], position: 1})` → `"a[b]c"`
- formatTape head at end: `formatTape({symbols: ['a'], position: 0})` → `"[a]"`

- [ ] **Step 2: Run the new tests**

```sh
npx --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js vitest run packages/visuals/src/format.spec.ts
```

Expected: all pass.

- [ ] **Step 3: Full verify**

```sh
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js test
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js run typecheck
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js run lint
```

All green. Test count grows by N (the cases you added).

---

## Task 3: Wire exports

**Files:** `packages/visuals/src/index.ts`

- [ ] **Step 1: Append exports**

After the existing alpha.6 exports:

```ts
export { formatCommand, formatStep, formatStepNotation, formatTape } from './format';
```

(Adjust to merge with the existing `formatCommand` / `formatStep` export line — single line, all four names.)

- [ ] **Step 2: Verify**

Re-run typecheck + a build to confirm `dist/` includes the new symbols:

```sh
npm --prefix /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js run build
```

Expected: clean, `dist/format.d.ts` exports the new functions, `dist/index.{cjs,mjs,d.ts}` re-export them.

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

- `formatStepNotation(reads, commands, blanks, matchKinds?)` — engine edge-label format primitive, matches `toMermaid` emit byte-for-byte. Per-cell encoding: literal `'X'`, blank shortcut `B`, wildcard `*='X'`, keep-with-concrete-symbol `K='X'`, erase `E`. Multi-tape comma-separated within one outer bracket per role. Pass `reads === null` for the manual-Apply path (no transition fired) — output collapses to `[writes]/[moves]`. Folds in the richness machines-demo's local `format.ts` had so demo can drop the local helper and call visuals's primitive directly.
- `formatTape(tape)` — inline tape rendering with the head bracketed in place (`a[b]c`).

### Compatibility

- alpha.6's `formatCommand(tapeCommand)` and `formatStep(m)` unchanged. Additive release.
- Engine + builder + library-binary-numbers + library-binary-numbers-bare stay at `7.0.0-alpha.6` — no functional changes there. Visuals-only release; the workspace's lockstep convention is for coordinated peer-dep widening when engine APIs break, not for additive consumer-package enhancements.
```

- [ ] **Step 3: Verify, then commit**

`git -C ... status` — should show: `packages/visuals/package.json`, `packages/visuals/CHANGELOG.md`, `package-lock.json`, plus the Task 1-3 source/test/index changes.

Commit in two focused commits for a clean bisect:
1. `feat(visuals): add formatStepNotation + formatTape primitives (alpha.6.1)` — Task 1-3 source/test/index changes
2. `release(visuals): 7.0.0-alpha.6.1 — formatter enhancements` — version bump + CHANGELOG + lockfile resync

Or fold into one. Either works.

For a tidy history, commit the work as several focused commits:
1. `feat(visuals): add formatStepNotation + formatTape primitives (alpha.6.1)`
2. `test(visuals): cover formatStepNotation + formatTape encoding cases`
3. `release(visuals): 7.0.0-alpha.6.1 — formatter enhancements`

Or fold into one. Either's fine; per-task commits read cleaner if someone bisects.

- [ ] **Step 4: Push**

```sh
git -C /Users/mellonis/Developer/mellonis-workspace/machines/turing-machine-js push -u origin feat/visuals-alpha7-formatters
```

---

## Task 5: Open PR

- [ ] **Step 1: Open PR against `v7`**

```sh
gh pr create --repo mellonis/turing-machine-js --base v7 --head feat/visuals-alpha7-formatters \
  --title "feat(visuals): alpha.6.1 formatter enhancements (formatStepNotation + formatTape)" \
  --body "$(cat <<'EOF'
## Summary

alpha.6.1 of \`@turing-machine-js/visuals\`. Folds the richness of machines-demo's local \`format.ts\` into visuals so the upcoming demo cleanup PR can drop the local helper and call visuals's primitives directly.

Pure additive change. alpha.6's \`formatCommand\` / \`formatStep\` unchanged.

## What's new

- **\`formatStepNotation(reads, commands, blanks, matchKinds?)\`** — engine edge-label format primitive matching \`toMermaid\` emit byte-for-byte. Per-cell encoding covers literal \`'X'\`, blank shortcut \`B\`, wildcard \`*='X'\` (showing what \`ifOtherSymbol\` caught), keep-with-concrete-symbol \`K='X'\` / \`K=B\`, erase \`E\`, and the manual-Apply path (\`reads === null\` collapses output to \`[writes]/[moves]\`).
- **\`formatTape(tape)\`** — inline tape rendering with the head bracketed in place.

## Versioning (visuals-only bump)

Bumps **visuals alone** to \`7.0.0-alpha.6.1\`. Engine + builder + library-binary-numbers + library-binary-numbers-bare stay at \`7.0.0-alpha.6\` — no functional changes there; bumping them would create ghost releases. Peer-dep ranges stay at \`^7.0.0-alpha.6\` (semver-prerelease caret already accepts alpha.6.1+). The workspace's lockstep convention exists for coordinated peer-dep widening when engine APIs break, not for additive consumer-package enhancements.

## Test plan

- [x] \`npm test\` — passes, +N tests in \`format.spec.ts\`.
- [x] \`npm run typecheck\` — clean.
- [x] \`npm run lint\` — clean.
- [x] \`npm run build\` — \`dist/format.d.ts\` exports the new symbols; \`Built @turing-machine-js/visuals Node entries\` confirms Rollup runs cleanly.

## Follow-ups

- Lockstep publish (or visuals-only publish) — \`npx lerna publish from-package --dist-tag next\` from the repo root after merge. Lerna's \`from-package\` mode publishes anything NOT yet on the registry; only visuals will publish.
- Then the [machines-demo visuals-cleanup PR](https://github.com/mellonis/machines-demo/blob/master/docs/superpowers/plans/2026-05-30-visuals-cleanup.md) becomes a clean drop: deletes \`format.ts\`'s \`formatStepNotation\` + \`formatTape\` and points \`commandsEntry\` / \`tapesEntry\` at visuals.

Per repo convention, this PR targets \`v7\`. CI doesn't run on v7 branches.
EOF
)"
```

---

## Self-review checklist

- [ ] `formatStepNotation` body matches demo's verbatim — same encoding paths, same multi-tape join, same null-`reads` handling.
- [ ] `formatTape` body matches demo's verbatim.
- [ ] alpha.6 surface (`formatCommand`, `formatStep`) unchanged.
- [ ] CHANGELOG entry under `[7.0.0-alpha.6.1]`, dated `2026-05-30`.
- [ ] package.json at `7.0.0-alpha.6.1`; peer dep unchanged.
- [ ] No Claude attribution footers in commits.
- [ ] Tests cover every encoding branch (literal, blank-B, wildcard, keep-with-read, keep-blank, erase, manual-Apply, multi-tape).

---

## After this lands

1. **Publish** — `cd turing-machine-js && npx lerna publish from-package --dist-tag next --yes`. Only visuals publishes (engine + builder + libs are already on the registry at alpha.6, lerna skips them). Same catch-up-publish flow as alpha.6's initial visuals publish.
2. **Tagging:** **no new GH release** for `v7.0.0-alpha.6.1`. The git tag scheme tracks engine versions; visuals-only releases ship under the existing engine tag (alpha.6 in this case). Optionally edit the `v7.0.0-alpha.6` GH release body to add a short note like "Visuals follow-up: alpha.6.1 adds `formatStepNotation` + `formatTape` — see [packages/visuals/CHANGELOG.md](https://github.com/mellonis/turing-machine-js/blob/v7/packages/visuals/CHANGELOG.md)."
3. **Resume the machines-demo cleanup PR plan.** With alpha.6.1 published, the cleanup PR additionally:
   - Bumps the demo's visuals dep to `^7.0.0-alpha.6.1` (via `npm install @turing-machine-js/visuals@next`).
   - Deletes demo's local `formatStepNotation` (was internal) — call sites in `commandsEntry` switch to importing from `@turing-machine-js/visuals`.
   - Deletes demo's local `formatTape` export — callers switch to visuals's.
   - Keeps `tapesEntry`, `commandsEntry`, `CommandsApplication` in demo (LogEntry assembly is demo-specific).

---

## Out of scope

- **Engine bump.** No engine changes in this alpha.
- **Backwards-compat shims for the alpha.6 formatters.** They stay live, unchanged. Future deprecation, if any, is a separate decision.
- **GH release for `v7.0.0-alpha.6.1`.** Skipped — tag scheme tracks engine versions, and the engine isn't bumping. Optionally edit the existing `v7.0.0-alpha.6` release body to note the visuals follow-up.
- **Demo migration.** That's the cleanup PR's job, after this publishes.
