import { describe, it, expect } from 'vitest';
import {
  Alphabet,
  State,
  Tape,
  TapeBlock,
  TuringMachine,
  haltState,
  ifOtherSymbol,
  movements,
} from '@turing-machine-js/machine';
import { recordSnippet } from './recordSnippet';
import { SnippetPlayer } from './snippetPlayer';
import type { Snippet } from './types';

function buildTwoAMachine() {
  const alphabet = new Alphabet([' ', 'a', 'b']);
  const tape = new Tape({ alphabet, symbols: ['a', 'a'] });
  const tapeBlock = TapeBlock.fromTapes([tape]);
  const machine = new TuringMachine({ tapeBlock });
  const initialState = new State({
    [tapeBlock.symbol(['a'])]: {
      command: [{ symbol: 'b', movement: movements.right }],
    },
    [ifOtherSymbol]: { nextState: haltState },
  });
  const graph = State.toGraph(initialState, tapeBlock);
  const alphabets = [alphabet.symbols.filter((s) => s !== alphabet.blankSymbol).concat(alphabet.blankSymbol)];
  return { machine, initialState, graph, alphabets };
}

function buildSnippet(): Snippet {
  const { machine, initialState, graph, alphabets } = buildTwoAMachine();
  return recordSnippet({ machine, initialState, graph, alphabets });
}

describe('SnippetPlayer', () => {
  it('throws if the snippet has no frames', () => {
    const empty: Snippet = { version: 1, graph: {} as never, alphabets: [], frames: [] };
    expect(() => new SnippetPlayer(empty)).toThrow(/no frames/);
  });

  it('starts at frame 0', () => {
    const p = new SnippetPlayer(buildSnippet());
    expect(p.frameIndex).toBe(0);
    expect(p.currentFrame.step).toBe(0);
  });

  it('done is true only at the last frame', () => {
    const snippet = buildSnippet();
    const p = new SnippetPlayer(snippet);
    expect(p.done).toBe(false);
    while (p.forward()) { /* advance */ }
    expect(p.frameIndex).toBe(snippet.frames.length - 1);
    expect(p.done).toBe(true);
  });

  it('forward advances and returns true; returns false at end', () => {
    const snippet = buildSnippet();
    const p = new SnippetPlayer(snippet);
    for (let i = 1; i < snippet.frames.length; i += 1) {
      expect(p.forward()).toBe(true);
      expect(p.frameIndex).toBe(i);
    }
    expect(p.forward()).toBe(false);
    expect(p.frameIndex).toBe(snippet.frames.length - 1);
  });

  it('back retreats and returns true; returns false at start', () => {
    const snippet = buildSnippet();
    const p = new SnippetPlayer(snippet);
    p.goTo(snippet.frames.length - 1);
    for (let i = snippet.frames.length - 2; i >= 0; i -= 1) {
      expect(p.back()).toBe(true);
      expect(p.frameIndex).toBe(i);
    }
    expect(p.back()).toBe(false);
    expect(p.frameIndex).toBe(0);
  });

  it('reset returns to frame 0', () => {
    const p = new SnippetPlayer(buildSnippet());
    p.forward();
    p.forward();
    p.reset();
    expect(p.frameIndex).toBe(0);
    expect(p.done).toBe(false);
  });

  it('goTo jumps to a specific frame', () => {
    const snippet = buildSnippet();
    const p = new SnippetPlayer(snippet);
    p.goTo(snippet.frames.length - 1);
    expect(p.frameIndex).toBe(snippet.frames.length - 1);
    expect(p.currentFrame).toBe(snippet.frames[snippet.frames.length - 1]);
    p.goTo(0);
    expect(p.frameIndex).toBe(0);
  });

  it('goTo throws RangeError on out-of-bounds index', () => {
    const snippet = buildSnippet();
    const p = new SnippetPlayer(snippet);
    expect(() => p.goTo(-1)).toThrow(RangeError);
    expect(() => p.goTo(snippet.frames.length)).toThrow(RangeError);
    expect(() => p.goTo(1.5)).toThrow(RangeError);
  });

  it('currentFrame is a live getter — reflects index changes', () => {
    const snippet = buildSnippet();
    const p = new SnippetPlayer(snippet);
    const first = p.currentFrame;
    p.forward();
    const second = p.currentFrame;
    expect(first).not.toBe(second);
    expect(second).toBe(snippet.frames[1]);
  });

  it('two players over the same snippet are independent', () => {
    const snippet = buildSnippet();
    const a = new SnippetPlayer(snippet);
    const b = new SnippetPlayer(snippet);
    a.forward();
    a.forward();
    expect(a.frameIndex).toBe(2);
    expect(b.frameIndex).toBe(0);
  });
});
