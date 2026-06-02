import { describe, it, expect } from 'vitest';
import { tapeViewport } from './tapeViewport';

const BLANK = ' ';

describe('tapeViewport', () => {
  it('returns full tape centered when width === symbols length and head is centered', () => {
    const r = tapeViewport({ symbols: ['a', 'b', 'c', 'd', 'e'], position: 2 }, 5, BLANK);
    expect(r.cells).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(r.headIndex).toBe(2);
  });

  it('pads with blank on the left when head is near the left edge', () => {
    const r = tapeViewport({ symbols: ['a', 'b', 'c'], position: 0 }, 5, BLANK);
    expect(r.cells).toEqual([' ', ' ', 'a', 'b', 'c']);
    expect(r.headIndex).toBe(2);
    expect(r.cells[r.headIndex]).toBe('a');
  });

  it('pads with blank on the right when head is near the right edge', () => {
    const r = tapeViewport({ symbols: ['a', 'b', 'c'], position: 2 }, 5, BLANK);
    expect(r.cells).toEqual(['a', 'b', 'c', ' ', ' ']);
    expect(r.headIndex).toBe(2);
    expect(r.cells[r.headIndex]).toBe('c');
  });

  it('pads with blank on both sides when tape is shorter than the window', () => {
    const r = tapeViewport({ symbols: ['x'], position: 0 }, 5, BLANK);
    expect(r.cells).toEqual([' ', ' ', 'x', ' ', ' ']);
    expect(r.headIndex).toBe(2);
  });

  it('returns all blanks when the head is far past the tape end', () => {
    const r = tapeViewport({ symbols: ['a'], position: 100 }, 5, BLANK);
    expect(r.cells).toEqual([' ', ' ', ' ', ' ', ' ']);
    expect(r.headIndex).toBe(2);
  });

  it('uses the provided blank symbol (not space)', () => {
    const r = tapeViewport({ symbols: ['x'], position: 0 }, 5, '␣');
    expect(r.cells).toEqual(['␣', '␣', 'x', '␣', '␣']);
  });

  it('handles width === 1 (head-only window)', () => {
    const r = tapeViewport({ symbols: ['a', 'b', 'c'], position: 1 }, 1, BLANK);
    expect(r.cells).toEqual(['b']);
    expect(r.headIndex).toBe(0);
  });

  it('handles even width with head at floor(width / 2)', () => {
    const r = tapeViewport({ symbols: ['a', 'b', 'c', 'd'], position: 1 }, 4, BLANK);
    expect(r.cells).toEqual([' ', 'a', 'b', 'c']);
    expect(r.headIndex).toBe(2);
    expect(r.cells[r.headIndex]).toBe('b');
  });

  it('throws RangeError on non-positive width', () => {
    const snap = { symbols: ['a'], position: 0 };
    expect(() => tapeViewport(snap, 0, BLANK)).toThrow(RangeError);
    expect(() => tapeViewport(snap, -1, BLANK)).toThrow(RangeError);
  });

  it('throws RangeError on non-integer width', () => {
    const snap = { symbols: ['a'], position: 0 };
    expect(() => tapeViewport(snap, 1.5, BLANK)).toThrow(RangeError);
    expect(() => tapeViewport(snap, NaN, BLANK)).toThrow(RangeError);
  });
});
