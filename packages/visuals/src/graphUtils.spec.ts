import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bareIdOf, equivalentIds, highlightExpand } from './graphUtils';
import type { Graph } from '@turing-machine-js/machine';

/**
 * Tests for the pure breakpoint / highlight class helpers in
 * `graphUtils.ts`. These rules feed both the breakpoint indicator
 * (`applyIndicator`) and the context-menu "Shared with" info line
 * (`MachineGraph.svelte`); the upstream engine v7 collapses wrapper
 * states (`State.withOverriddenHaltState`) onto a shared `#debugRef`
 * with their bare, so the demo collapses them into one breakpoint per
 * equivalence class.
 *
 * Fixture: `turing-callable-subtree` has
 *   3  → bare `walkToBlank` (frameId 3)
 *   4  → `writeMarker` (override)
 *   5  → wrapper `walkToBlank(writeMarker)` (bareStateId 3)
 *   0  → halt singleton
 *   -6 → halt marker for frame 3 (id = -2 * frameId, #239)
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadGraph(name: string): Graph {
  const path = resolve(__dirname, './fixtures/graphs', `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8')) as Graph;
}

describe('bareIdOf', () => {
  const g = loadGraph('turing-callable-subtree');

  it('maps a wrapper id to its bareStateId', () => {
    expect(bareIdOf(5, g)).toBe(3);
  });

  it('returns the bare id unchanged for non-wrapper positive ids', () => {
    expect(bareIdOf(3, g)).toBe(3);
    expect(bareIdOf(4, g)).toBe(4);
  });

  it('collapses halt markers (even negative ids) to the halt singleton (0)', () => {
    expect(bareIdOf(-6, g)).toBe(0);
  });

  it('returns 0 for the halt singleton itself', () => {
    expect(bareIdOf(0, g)).toBe(0);
  });

  it('keeps engine sentinels (odd negative ids) as their own class — abort (-1) never folds into halt', () => {
    expect(bareIdOf(-1, g)).toBe(-1);
  });

  it('returns the id unchanged when graph is null', () => {
    expect(bareIdOf(5, null)).toBe(5);
    expect(bareIdOf(-6, null)).toBe(-6);
  });

  it('returns the id unchanged when no node entry exists', () => {
    expect(bareIdOf(999, g)).toBe(999);
  });
});

describe('highlightExpand (asymmetric)', () => {
  const g = loadGraph('turing-callable-subtree');

  it('expands wrapper → [wrapper, bare]', () => {
    expect(highlightExpand(5, g).sort()).toEqual([3, 5]);
  });

  it('does NOT expand bare → [bare] only (no wrapper sync from bare side)', () => {
    expect(highlightExpand(3, g)).toEqual([3]);
  });

  it('returns [id] for a non-wrapper non-bare id', () => {
    expect(highlightExpand(4, g)).toEqual([4]);
  });

  it('returns [id] when graph is null', () => {
    expect(highlightExpand(5, null)).toEqual([5]);
  });
});

describe('equivalentIds (symmetric class lookup)', () => {
  const g = loadGraph('turing-callable-subtree');

  it('returns [bare, ...wrappers] from a wrapper input', () => {
    expect(equivalentIds(5, g).sort()).toEqual([3, 5]);
  });

  it('returns [bare, ...wrappers] from the bare input — symmetric', () => {
    expect(equivalentIds(3, g).sort()).toEqual([3, 5]);
  });

  it('returns [singleton] for a stand-alone state', () => {
    expect(equivalentIds(4, g)).toEqual([4]);
  });

  it('halt singleton (0) → [0, ...all halt markers]', () => {
    const ids = equivalentIds(0, g).sort((a, b) => a - b);
    expect(ids).toEqual([-6, 0]);
  });

  it('halt marker (-6) → same class as halt singleton (symmetric)', () => {
    const ids = equivalentIds(-6, g).sort((a, b) => a - b);
    expect(ids).toEqual([-6, 0]);
  });

  it('abort sentinel (-1) → its own singleton class, never halt\'s', () => {
    expect(equivalentIds(-1, g)).toEqual([-1]);
  });

  it('returns [id] when graph is null', () => {
    expect(equivalentIds(5, null)).toEqual([5]);
    expect(equivalentIds(0, null)).toEqual([0]);
  });
});
