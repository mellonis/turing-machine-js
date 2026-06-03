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
  symbolCommands,
} from '@turing-machine-js/machine';
import { recordSnippet } from './recordSnippet';

/** Build a machine that converts each 'a' → 'b' (move right) until blank (halt). */
function buildTwoAMachine() {
  const alphabet = new Alphabet([' ', 'a', 'b']);
  const tape = new Tape({ alphabet, symbols: ['a', 'a'] });
  const tapeBlock = TapeBlock.fromTapes([tape]);
  const machine = new TuringMachine({ tapeBlock });

  const initialState = new State({
    [tapeBlock.symbol(['a'])]: {
      command: [{ symbol: 'b', movement: movements.right }],
    },
    [ifOtherSymbol]: {
      nextState: haltState,
    },
  });

  const graph = State.toGraph(initialState, tapeBlock);
  const alphabets = [alphabet.symbols.filter((s) => s !== alphabet.blankSymbol).concat(alphabet.blankSymbol)];

  return { machine, initialState, graph, alphabets, alphabet };
}

describe('recordSnippet', () => {
  describe('frame 0 (initial state)', () => {
    it('step is 0', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.frames[0].step).toBe(0);
    });

    it('commands is undefined', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.frames[0].commands).toBeUndefined();
    });

    it('highlight is null', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.frames[0].highlight).toBeNull();
    });

    it('tape reflects initial state (position 0, contains "a")', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      const frame0Tape = snippet.frames[0].tape[0];
      expect(frame0Tape.position).toBe(0);
      expect(frame0Tape.symbols).toContain('a');
    });
  });

  describe('frame count', () => {
    it('2 "a"s + halt iter = 3 iters → 4 frames (frame 0 + 3)', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      // iter 1: read 'a', write 'b', move R
      // iter 2: read 'a', write 'b', move R
      // iter 3: read blank, nextState = haltState
      expect(snippet.frames).toHaveLength(4);
    });
  });

  describe('per-iter frame commands', () => {
    it('frame 1: read "a", write "b", move R', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.frames[1].commands).toEqual([{ movement: 'R', read: 'a', write: 'b' }]);
    });

    it('frame 2: read "a", write "b", move R', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.frames[2].commands).toEqual([{ movement: 'R', read: 'a', write: 'b' }]);
    });

    it('frame 3 (halt iter): read===write (keep), movement S (stay)', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      // halt-bound transition has default command: keep + stay; blank cell read+written
      const blank = snippet.frames[3].commands![0].read;
      expect(snippet.frames[3].commands).toEqual([{ movement: 'S', read: blank, write: blank }]);
    });
  });

  describe('per-iter frame tape (post-command snapshots)', () => {
    it('frame 1 tape: "b" written at position 0, head at position 1', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      const tape = snippet.frames[1].tape[0];
      expect(tape.symbols[0]).toBe('b');
      expect(tape.position).toBe(1);
    });

    it('frame 2 tape: both cells "b", head at position 2', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      const tape = snippet.frames[2].tape[0];
      expect(tape.symbols[0]).toBe('b');
      expect(tape.symbols[1]).toBe('b');
      expect(tape.position).toBe(2);
    });
  });

  describe('snippet metadata', () => {
    it('version is 1', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.version).toBe(1);
    });

    it('graph is the passed-in graph (referential equality)', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.graph).toBe(graph);
    });

    it('alphabets is the passed-in alphabets (referential equality)', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.alphabets).toBe(alphabets);
    });

    it('name is set when provided', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets, name: 'test snippet' });
      expect(snippet.name).toBe('test snippet');
    });

    it('name is absent when not provided', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect('name' in snippet).toBe(false);
    });
  });

  describe('log option', () => {
    it('attaches log to non-frame-0 frames when log returns a string', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({
        machine,
        initialState,
        graph,
        alphabets,
        log: () => 'step line',
      });
      // frame 0 has no log
      expect(snippet.frames[0].log).toBeUndefined();
      // frames 1-3 all have log
      for (let i = 1; i < snippet.frames.length; i++) {
        expect(snippet.frames[i].log).toBe('step line');
      }
    });

    it('omits log when log returns undefined', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({
        machine,
        initialState,
        graph,
        alphabets,
        log: () => undefined,
      });
      for (const frame of snippet.frames) {
        expect('log' in frame).toBe(false);
      }
    });

    it('passes current and previous MachineState to log', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const calls: [unknown, unknown][] = [];
      recordSnippet({
        machine,
        initialState,
        graph,
        alphabets,
        log: (m, prev) => { calls.push([m.step, prev ? prev.step : null]); return undefined; },
      });
      // 3 iters → 3 log calls
      expect(calls).toHaveLength(3);
      expect(calls[0]).toEqual([1, null]);
      expect(calls[1]).toEqual([2, 1]);
      expect(calls[2]).toEqual([3, 2]);
    });
  });

  describe('maxSteps truncation', () => {
    it('with maxSteps: 1 → 2 frames (frame 0 + frame 1)', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets, maxSteps: 1 });
      expect(snippet.frames).toHaveLength(2);
    });

    it('with maxSteps: 1, frame 1 tape reflects the first command applied', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets, maxSteps: 1 });
      const tape = snippet.frames[1].tape[0];
      // 'a' was written to 'b', head moved right
      expect(tape.symbols[0]).toBe('b');
      expect(tape.position).toBe(1);
    });
  });

  describe('highlight', () => {
    it('non-frame-0 frames have a non-null highlight with strong: "from" and paused: false', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      for (let i = 1; i < snippet.frames.length; i++) {
        const h = snippet.frames[i].highlight;
        expect(h).not.toBeNull();
        expect(h!.strong).toBe('from');
        expect(h!.paused).toBe(false);
      }
    });

    it('halt-iter frame highlight has toId: 0 (haltState)', () => {
      const { machine, initialState, graph, alphabets } = buildTwoAMachine();
      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      const lastFrame = snippet.frames[snippet.frames.length - 1];
      expect(lastFrame.highlight!.toId).toBe(0);
    });
  });

  describe('single-step machine (halts immediately)', () => {
    it('produces 2 frames when machine halts on step 1', () => {
      const alphabet = new Alphabet([' ', 'x']);
      const tape = new Tape({ alphabet, symbols: ['x'] });
      const tapeBlock = TapeBlock.fromTapes([tape]);
      const machine = new TuringMachine({ tapeBlock });
      const initialState = new State({
        [ifOtherSymbol]: { nextState: haltState },
      });
      const graph = State.toGraph(initialState, tapeBlock);
      const alphabets = [['x', ' ']];

      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.frames).toHaveLength(2);
      expect(snippet.frames[0].commands).toBeUndefined();
      expect(snippet.frames[1].commands).toBeDefined();
    });
  });

  describe('keep command → read === write', () => {
    it('a keep+stay command yields read === write in commands', () => {
      const alphabet = new Alphabet([' ', 'a']);
      const tape = new Tape({ alphabet, symbols: ['a'] });
      const tapeBlock = TapeBlock.fromTapes([tape]);
      const machine = new TuringMachine({ tapeBlock });
      const initialState = new State({
        [tapeBlock.symbol(['a'])]: {
          command: [{ symbol: symbolCommands.keep, movement: movements.stay }],
          nextState: haltState,
        },
      });
      const graph = State.toGraph(initialState, tapeBlock);
      const alphabets = [['a', ' ']];

      const snippet = recordSnippet({ machine, initialState, graph, alphabets });
      expect(snippet.frames[1].commands![0]).toEqual({ movement: 'S', read: 'a', write: 'a' });
    });
  });
});
