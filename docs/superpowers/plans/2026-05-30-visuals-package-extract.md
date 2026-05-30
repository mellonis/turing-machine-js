# `@turing-machine-js/visuals` package extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract machines-demo's pure highlight/graph-indexing modules + rules doc into a new lockstep-published package `@turing-machine-js/visuals`. NO new functionality in this PR — pure code-move + scaffold. `recordSnippet` + Snippet/Frame schema lands as a follow-up plan (issue step 3).

**Architecture:** New `packages/visuals/` workspace, peer dep on `@turing-machine-js/machine` (`Graph` type only — no runtime dependency). Pure TypeScript, no DOM, no Svelte. Modules are line-for-line moves: `TuringGraph` local alias becomes `import { Graph } from '@turing-machine-js/machine'`; everything else unchanged. The rules doc moves under `packages/visuals/docs/`. machines-demo's local copies + the doc-source are deleted in a follow-up demo PR (issue step 2, **not** this PR — keeps the extract PR self-contained and reviewable against engine tests only).

**Tech Stack:** TypeScript (project references), Vitest, npm workspaces, Lerna. Standard repo commands (`npm test`, `npm run lint`, `npm run typecheck`, `npm run build`) automatically pick up the new workspace.

**Branch:** `feat/204-visuals-extract` (off `v7`). Issue: [mellonis/turing-machine-js#204](https://github.com/mellonis/turing-machine-js/issues/204).

**Coverage floor (must hold):** 100% statements / 100% branches / 100% functions / 100% lines. The extracted modules are pure logic with no I/O; demo's existing test suites already hit 100% on these files. Drop is unexpected and indicates an extraction error.

---

## Decisions (locked in this plan)

- **Package name: `@turing-machine-js/visuals`.** Issue #204 lists this as an open question between `visuals` / `highlight` / `graph-visuals`. Going with `visuals` — broadest, room for `recordSnippet` + future visual primitives without renaming.
- **No DOM applier sub-export in v1.** The package stays purely renderer-agnostic. A future `@turing-machine-js/visuals/dom` sub-path can be added non-breakingly when there's a concrete consumer asking for one. Out of scope here.
- **Snippet schema versioning policy (deferred to PR B).** This PR does NOT introduce the schema; recording the policy now keeps PR B short: additive fields don't bump `version`; breaking shape changes bump the integer. Will be documented in PR B's README addition.
- **`graphHighlightDerivation.ts` does NOT extract.** Its `ExecutionMode` union mirrors machines-demo's MachineView state machine (`'DEMO' | 'MANUAL' | 'RUNNING_AUTO' | …`) — demo orchestration, not engine semantics. Stays in machines-demo and imports `bareIdOf` from the published package post-extract.
- **`Snippet.engine` field is dropped (per #204 comment 2026-05-29).** Pinned here so PR B inherits the constraint. Engine identity lives at the caller bucket level (`{ turing: Snippet[], post: Snippet[] }`), not on the artifact.
- **No content rewrites during the move.** Rules doc moves verbatim — any rewording is a separate edit later. Keeps this PR's diff a clean move.
- **machines-demo cleanup (issue step 2) is a separate follow-up PR**, in the machines-demo repo, after this lands and lockstep-publishes with the next engine v7 alpha. This PR does NOT touch machines-demo.

---

## File Structure

```
packages/visuals/
├── package.json              # NEW — peer dep on @turing-machine-js/machine
├── tsconfig.json             # NEW — project references, extends repo conventions
├── README.md                 # NEW — what this package is, public API summary
├── src/
│   ├── index.ts              # NEW — re-exports public surface
│   ├── highlightOps.ts       # MOVED from machines-demo/src/lib/highlightOps.ts
│   ├── graphUtils.ts         # MOVED from machines-demo/src/lib/graphUtils.ts
│   ├── graphIndexes.ts       # MOVED from machines-demo/src/lib/graphIndexes.ts
│   └── applyHighlight.ts     # MOVED from machines-demo/src/lib/applyHighlight.ts
├── tests/
│   ├── graphUtils.spec.ts    # MOVED — renamed .test.ts → .spec.ts to match repo convention
│   ├── graphIndexes.spec.ts  # (no source test in demo; trivial test added if extraction warrants)
│   ├── applyHighlight.spec.ts # MOVED + renamed
│   ├── graphFixtures.spec.ts # MOVED + renamed
│   └── fixtures/             # MOVED — fixture JSONs (graphs/*.json) used by graphFixtures
└── docs/
    └── graph-highlight-and-breakpoints.md  # MOVED from machines-demo/docs/

tsconfig.build.json           # MODIFY — add reference to packages/visuals
package.json                  # MODIFY — extend "typecheck" script to include packages/visuals
```

Public API exported from `packages/visuals/src/index.ts`:

```ts
// Types
export type {
  NodeKey, HighlightClass, HighlightOps, IndicatorOps, RecordedOp,
} from './highlightOps';
export type { GraphIndexes } from './graphIndexes';

// Functions
export { recordingOps } from './highlightOps';
export { bareIdOf, highlightExpand, equivalentIds } from './graphUtils';
export { indexGraph } from './graphIndexes';
export { applyHighlight, applyIndicator } from './applyHighlight';
```

Note: machines-demo's local `TuringGraph` alias resolves to `Graph` from `@turing-machine-js/machine`. The move replaces every `import { …, type TuringGraph } from './types.ts'` with `import { type Graph } from '@turing-machine-js/machine'` and renames the type at use-sites. `TuringGraph` is NOT re-exported from visuals — callers import `Graph` directly from `@turing-machine-js/machine`.

---

## Task 1: Scaffold `packages/visuals/`

**Files:**
- Create: `packages/visuals/package.json`
- Create: `packages/visuals/tsconfig.json`
- Create: `packages/visuals/README.md`
- Create: `packages/visuals/src/index.ts`
- Modify: `tsconfig.build.json`
- Modify: `package.json` (root — extend `typecheck` script)

- [ ] **Step 1: Write `packages/visuals/package.json`**

```json
{
  "name": "@turing-machine-js/visuals",
  "version": "7.0.0-alpha.6",
  "description": "Pure highlight + graph-indexing logic for @turing-machine-js/machine — no DOM, no renderer.",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    }
  },
  "files": ["dist", "src", "docs", "README.md", "CHANGELOG.md", "LICENSE"],
  "scripts": {
    "prepublishOnly": "npm run --workspaces=false -w @turing-machine-js/visuals build"
  },
  "peerDependencies": {
    "@turing-machine-js/machine": "^7.0.0-alpha.6"
  },
  "publishConfig": {
    "access": "public"
  }
}
```

> **Verify before committing:** version field matches the current engine alpha tag. Cross-check `packages/machine/package.json`'s version. Lerna's `version` command keeps these in lockstep on the next bump.

- [ ] **Step 2: Write `packages/visuals/tsconfig.json`**

Mirror `packages/machine/tsconfig.json`'s structure. Read it first, then create:

```json
{
  "extends": "@tsconfig/recommended/tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "es2022",
    "strict": true
  },
  "references": [
    { "path": "../machine" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

> Adjust to match `packages/machine/tsconfig.json` exactly if it differs — repo convention overrides the example above.

- [ ] **Step 3: Write `packages/visuals/README.md`**

```markdown
# @turing-machine-js/visuals

Pure highlight + graph-indexing logic for [`@turing-machine-js/machine`](../machine). No DOM, no Svelte, no Mermaid — consumers bring their own renderer and DOM applier.

## Scope

Types and pure functions for:
- Indexing an engine `Graph` for wrapper/bare lookup (`indexGraph`, `bareIdOf`, `highlightExpand`).
- Applying highlight + indicator operations against a renderer-agnostic `HighlightOps` interface (`applyHighlight`, `applyIndicator`).

See [`docs/graph-highlight-and-breakpoints.md`](./docs/graph-highlight-and-breakpoints.md) for the full set of rules these functions satisfy.

## Versioning

Lockstep with `@turing-machine-js/machine`.

## Install

\`\`\`sh
npm install @turing-machine-js/visuals @turing-machine-js/machine
\`\`\`
```

- [ ] **Step 4: Write `packages/visuals/src/index.ts` (empty for now)**

```ts
// Public API — populated as modules are moved in Tasks 2–5.
export {};
```

- [ ] **Step 5: Modify `tsconfig.build.json` — add reference**

Read the file first; then append `{ "path": "packages/visuals" }` to its `references` array.

- [ ] **Step 6: Modify root `package.json` — extend `typecheck` script**

Read the current value:
```
"typecheck": "tsc --noEmit -p packages/machine/tsconfig.json && tsc --noEmit -p packages/builder/tsconfig.json && tsc --noEmit -p packages/library-binary-numbers/tsconfig.json && tsc --noEmit -p packages/library-binary-numbers-bare/tsconfig.json"
```

Add `&& tsc --noEmit -p packages/visuals/tsconfig.json` at the end.

- [ ] **Step 7: Verify scaffolding compiles**

Run: `npm install && npm run typecheck && npm run build`
Expected: green. No new tests yet; existing engine tests still pass.

- [ ] **Step 8: Commit**

```sh
git add packages/visuals tsconfig.build.json package.json package-lock.json
git commit -m "feat(visuals): scaffold @turing-machine-js/visuals package (#204)"
```

---

## Task 2: Move `highlightOps.ts`

**Files:**
- Read: `../machines-demo/src/lib/highlightOps.ts` (source — outside this repo; copy contents, do NOT modify the source from this repo)
- Create: `packages/visuals/src/highlightOps.ts`
- Modify: `packages/visuals/src/index.ts`

- [ ] **Step 1: Read source**

Read `../machines-demo/src/lib/highlightOps.ts` in full. It has no external imports beyond TypeScript stdlib types — a pure types + recordingOps module. Direct move.

- [ ] **Step 2: Create the file at the new location**

Write `packages/visuals/src/highlightOps.ts` with the source contents verbatim. No import changes needed (it has none).

- [ ] **Step 3: Add to public exports**

In `packages/visuals/src/index.ts`:
```ts
export type { NodeKey, HighlightClass, HighlightOps, IndicatorOps, RecordedOp } from './highlightOps';
export { recordingOps } from './highlightOps';
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: green.

- [ ] **Step 5: Commit**

```sh
git add packages/visuals/src
git commit -m "feat(visuals): move highlightOps from machines-demo (#204)"
```

---

## Task 3: Move `graphUtils.ts` + test

**Files:**
- Read: `../machines-demo/src/lib/graphUtils.ts`, `../machines-demo/src/lib/graphUtils.test.ts`
- Create: `packages/visuals/src/graphUtils.ts`
- Create: `packages/visuals/tests/graphUtils.spec.ts`
- Modify: `packages/visuals/src/index.ts`

- [ ] **Step 1: Read source files**

Read both `graphUtils.ts` and `graphUtils.test.ts` from machines-demo. Note imports:
- Source imports `type TuringGraph` from local `./types.ts` (demo-local alias).
- Test imports the source + may import test fixtures.

- [ ] **Step 2: Create `packages/visuals/src/graphUtils.ts`**

Copy source contents. Replace the line:
```ts
import type { TuringGraph } from './types.ts';
```
with:
```ts
import type { Graph } from '@turing-machine-js/machine';
```
Then rename `TuringGraph` → `Graph` at every use-site in this file.

- [ ] **Step 3: Create `packages/visuals/tests/graphUtils.spec.ts`**

Copy test contents. Update import paths:
- `from '../src/lib/graphUtils.ts'` → `from '../src/graphUtils'`
- Any `TuringGraph` → `Graph` from `@turing-machine-js/machine`

If the test references fixtures, defer their move to Task 5 (graphFixtures) — for now, gate any fixture-dependent test on the file existing or comment it out with a `// TODO Task 5: restore after fixtures move` marker. If no fixture deps, the test is self-contained.

- [ ] **Step 4: Add to public exports**

In `packages/visuals/src/index.ts`, append:
```ts
export { bareIdOf, highlightExpand, equivalentIds } from './graphUtils';
```

- [ ] **Step 5: Run the moved test**

Run: `npx vitest run packages/visuals/tests/graphUtils.spec.ts`
Expected: same passing count as the original in machines-demo (or skipped count for fixture-deferred tests).

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: green.

- [ ] **Step 7: Commit**

```sh
git add packages/visuals
git commit -m "feat(visuals): move graphUtils + test (#204)"
```

---

## Task 4: Move `graphIndexes.ts` (+ test if present)

**Files:**
- Read: `../machines-demo/src/lib/graphIndexes.ts`
- Create: `packages/visuals/src/graphIndexes.ts`
- Modify: `packages/visuals/src/index.ts`

- [ ] **Step 1: Read source**

Read `graphIndexes.ts`. Note the imports — likely `TuringGraph` from local types.

- [ ] **Step 2: Create `packages/visuals/src/graphIndexes.ts`**

Copy contents, replace `TuringGraph` import with `import type { Graph } from '@turing-machine-js/machine'`, rename use-sites.

- [ ] **Step 3: Add to public exports**

```ts
export type { GraphIndexes } from './graphIndexes';
export { indexGraph } from './graphIndexes';
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck`
Expected: green.

> **Note:** machines-demo does NOT ship a standalone `graphIndexes.test.ts` (only an `applyHighlight.test.ts` and `graphUtils.test.ts`). `indexGraph` is exercised transitively by the applyHighlight tests in Task 6. No dedicated test added in this PR — extraction parity is preserved.

- [ ] **Step 5: Commit**

```sh
git add packages/visuals
git commit -m "feat(visuals): move graphIndexes (#204)"
```

---

## Task 5: Move `graphFixtures.test.ts` + fixture JSONs

**Files:**
- Read: `../machines-demo/src/lib/graphFixtures.test.ts` + any `tests/fixtures/graphs/*.json` referenced
- Create: `packages/visuals/tests/graphFixtures.spec.ts`
- Create: `packages/visuals/tests/fixtures/graphs/*.json` (one file per fixture)

- [ ] **Step 1: Read test + identify fixture files**

Read `graphFixtures.test.ts`. Find every `import` or `readFileSync` / `JSON.parse` of a fixture path. List them.

- [ ] **Step 2: Copy each fixture JSON file verbatim**

For each fixture path discovered in Step 1, copy the file from machines-demo to `packages/visuals/tests/fixtures/graphs/<name>.json`. Do not modify the JSON — these are engine-emit snapshots and must roundtrip byte-for-byte.

- [ ] **Step 3: Create the test file**

Copy `graphFixtures.test.ts` contents to `packages/visuals/tests/graphFixtures.spec.ts`. Update:
- Source import paths (`from '../lib/...'` → `from '../src/...'`).
- Fixture path strings (`./fixtures/graphs/...` should already resolve from the new test location since fixtures are colocated under `tests/fixtures/`).
- Any `import * as turing from '@turing-machine-js/machine'` already correct.
- Type rename: `TuringGraph` → `Graph`.

- [ ] **Step 4: Run the fixture test**

Run: `npx vitest run packages/visuals/tests/graphFixtures.spec.ts`
Expected: same passing count as in machines-demo. Fixture roundtrip MUST pass — failure here indicates engine-emit drift OR an extraction-time corruption of the JSON.

- [ ] **Step 5: Commit**

```sh
git add packages/visuals/tests
git commit -m "feat(visuals): move graphFixtures test + fixture JSONs (#204)"
```

---

## Task 6: Move `applyHighlight.ts` + test

**Files:**
- Read: `../machines-demo/src/lib/applyHighlight.ts`, `../machines-demo/src/lib/applyHighlight.test.ts`
- Create: `packages/visuals/src/applyHighlight.ts`
- Create: `packages/visuals/tests/applyHighlight.spec.ts`
- Modify: `packages/visuals/src/index.ts`

- [ ] **Step 1: Read source files**

Read both. Note all imports — likely:
- `import type { TuringGraph } from './types.ts'`
- `import { ... } from './graphUtils.ts'`
- `import { ... } from './graphIndexes.ts'`
- `import { ... } from './highlightOps.ts'`

- [ ] **Step 2: Create `packages/visuals/src/applyHighlight.ts`**

Copy source. Replace:
- `TuringGraph` import → `import type { Graph } from '@turing-machine-js/machine'` + rename uses.
- Local imports from `./graphUtils.ts` / `./graphIndexes.ts` / `./highlightOps.ts` → drop the `.ts` extension only if needed for the package's resolution (match the convention used in Tasks 2–4).

- [ ] **Step 3: Create `packages/visuals/tests/applyHighlight.spec.ts`**

Copy test. Update import paths to point at `../src/...`. Rename `TuringGraph` → `Graph`.

- [ ] **Step 4: Add to public exports**

```ts
export { applyHighlight, applyIndicator } from './applyHighlight';
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run packages/visuals/tests/applyHighlight.spec.ts`
Expected: all original tests pass at new location. Same count as in machines-demo.

- [ ] **Step 6: Restore any fixture-deferred tests from Task 3**

If Task 3 commented out fixture-dependent graphUtils tests, uncomment them now and verify they pass. Fixtures are in place since Task 5.

- [ ] **Step 7: Full test + typecheck + lint**

Run: `npm test && npm run typecheck && npm run lint`
Expected: green across all four packages (machine, builder, library-binary-numbers, library-binary-numbers-bare) + the new visuals.

- [ ] **Step 8: Commit**

```sh
git add packages/visuals
git commit -m "feat(visuals): move applyHighlight + applyIndicator + test (#204)"
```

---

## Task 7: Move the rules doc

**Files:**
- Read: `../machines-demo/docs/graph-highlight-and-breakpoints.md`
- Create: `packages/visuals/docs/graph-highlight-and-breakpoints.md`

- [ ] **Step 1: Read the source doc**

Read `../machines-demo/docs/graph-highlight-and-breakpoints.md` fully (~272 lines).

- [ ] **Step 2: Copy verbatim**

Create `packages/visuals/docs/graph-highlight-and-breakpoints.md` with identical contents. NO rewrites, NO scope changes, NO reformatting. If any in-doc cross-link points to a machines-demo path (e.g., `../src/components/MachineGraph.svelte`), leave it intact — fixing those links is part of the follow-up machines-demo cleanup PR (issue step 2). A `git mv`-shaped change preserves blame across the move (run `git log --follow` on the new path to verify).

- [ ] **Step 3: Verify the README link resolves**

The `packages/visuals/README.md` from Task 1 links to `./docs/graph-highlight-and-breakpoints.md` — confirm the file is at that path.

- [ ] **Step 4: Commit**

```sh
git add packages/visuals/docs
git commit -m "docs(visuals): move highlight + breakpoints rules doc (#204)"
```

---

## Task 8: Coverage verify + CHANGELOG

**Files:**
- Create: `packages/visuals/CHANGELOG.md`

- [ ] **Step 1: Run coverage**

Run: `npm run test:coverage`
Expected: visuals package at **100% / 100% / 100% / 100%**. If any file is below 100%, identify the missing branch — likely a defensive `null` check from the demo's original code. Either:
- Add a missing test case if the branch is reachable.
- Document the unreachable branch in the file (one-line comment) and verify reviewers accept it.

> **Do NOT lower the floor.** A drop below 100% means extraction-time scope mismatch; investigate before committing.

- [ ] **Step 2: Write `packages/visuals/CHANGELOG.md`**

Per repo convention, every release-bound package needs a CHANGELOG entry up front:

```markdown
# Changelog

All notable changes to this package will be documented in this file.

## [Unreleased]

### Added

- Initial extraction from machines-demo: `Highlight`/`HighlightOps`/`GraphIndexes` types, `indexGraph`, `applyHighlight`, `applyIndicator`, `bareIdOf`, `highlightExpand`, `equivalentIds`, `recordingOps`. Rules doc moved into `docs/graph-highlight-and-breakpoints.md`. Closes mellonis/turing-machine-js#204 (extraction step; recordSnippet follows in a separate PR).
```

> The `[Unreleased]` heading converts to `[X.Y.Z] - YYYY-MM-DD` during the release-PR pass (per workspace `CLAUDE.md` "CHANGELOG.md is part of every v-bump PR" rule). Not bumped in this PR — version bump is part of the next engine alpha release PR that includes visuals.

- [ ] **Step 3: Commit**

```sh
git add packages/visuals/CHANGELOG.md
git commit -m "docs(visuals): add CHANGELOG with extraction entry (#204)"
```

---

## Task 9: Open PR

- [ ] **Step 1: Push the branch**

```sh
git push -u origin feat/204-visuals-extract
```

- [ ] **Step 2: Open the PR against `v7`**

```sh
gh pr create \
  --repo mellonis/turing-machine-js \
  --base v7 \
  --head feat/204-visuals-extract \
  --title "feat(visuals): extract @turing-machine-js/visuals (#204, step 1)" \
  --body "$(cat <<'EOF'
## Summary

Extracts pure highlight + graph-indexing modules from machines-demo into a new lockstep-published package `@turing-machine-js/visuals`. Step 1 of [#204](https://github.com/mellonis/turing-machine-js/issues/204) — extraction only. \`recordSnippet\` + Snippet/Frame schema lands in a follow-up PR (step 3). machines-demo consumption (step 2) lands in machines-demo as a separate PR after this publishes.

What's in:

- New \`packages/visuals/\` workspace (peer dep on \`@turing-machine-js/machine\`, no runtime dep, no DOM).
- Moves: \`highlightOps\`, \`graphUtils\`, \`graphIndexes\`, \`applyHighlight\` + their tests.
- Rules doc moves to \`packages/visuals/docs/graph-highlight-and-breakpoints.md\` verbatim.
- Public API exported from \`packages/visuals/src/index.ts\`.

What's NOT in (deliberate):

- \`graphHighlightDerivation.ts\` stays in machines-demo — its \`ExecutionMode\` union is demo-coupled, not engine semantics.
- \`recordSnippet\`, \`Snippet\`, \`Frame\` types — follow-up PR.
- machines-demo cleanup — separate PR in machines-demo.

Decisions locked in [\`docs/superpowers/plans/2026-05-30-visuals-package-extract.md\`](docs/superpowers/plans/2026-05-30-visuals-package-extract.md): package name = \`visuals\`; no DOM applier sub-export in v1; \`Snippet.engine\` field dropped (per #204 comment 2026-05-29).

## Test plan

- [x] \`npm test\` — all packages including new visuals.
- [x] \`npm run typecheck\` — clean across all 5 packages.
- [x] \`npm run lint\` — clean.
- [x] \`npm run test:coverage\` — visuals at 100% / 100% / 100% / 100%.
- [x] \`npm run build\` — clean.
- [x] Fixture roundtrip test passes — engine emit shape unchanged.

Note: v7-branch PRs do not run CI per repo convention; checks run on the eventual v7 → master integration PR.
EOF
)"
```

- [ ] **Step 3: Verify PR URL returned**

Capture the PR URL and report back. Done.

---

## Self-review checklist

Before opening the PR, walk this list one more time:

- [ ] Every moved file's `TuringGraph` references replaced with `Graph` from `@turing-machine-js/machine`.
- [ ] No source files still reference `./types.ts` (machines-demo-local).
- [ ] `packages/visuals/src/index.ts` exports the full public surface (5 types, 7 functions).
- [ ] No machines-demo source files were modified — this PR is engine-side only.
- [ ] Coverage at 100/100/100/100 for the visuals package.
- [ ] CHANGELOG entry under `[Unreleased]` exists and references the issue.
- [ ] All `Task N` commits have clear, scope-prefixed messages (`feat(visuals):` or `docs(visuals):`).
- [ ] No commit includes `🤖 Generated with Claude Code` or any Claude attribution footer (per global CLAUDE.md).
- [ ] No `--no-verify` or signature-skip flags used.

---

## What happens after this lands

1. **Lockstep publish** with the next engine v7 alpha (bump `7.0.0-alpha.6` → `7.0.0-alpha.7`, etc.) via `lerna publish from-package --dist-tag next`. Same release PR that bumps engine packages bumps visuals.
2. **Follow-up plan** for `recordSnippet` + Snippet/Frame schema (issue #204 step 3). Will be saved at `docs/superpowers/plans/<date>-visuals-recordsnippet.md`.
3. **Follow-up PR in machines-demo** (issue #204 step 2) — drop the local copies of the moved modules + rules doc; depend on `@turing-machine-js/visuals` from npm `next`.
4. **Tiny edit to merged machines-demo spec** (`docs/superpowers/specs/2026-05-27-landing-page-design.md`) — remove the stray `engine` field reference from the snippet-schema decision now that the upstream schema dropped it.
