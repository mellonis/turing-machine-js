import {
  haltState,
  type Graph,
  type MachineState,
  type State,
  type TuringMachine,
} from '@turing-machine-js/machine';
import { MOVEMENT_LETTER } from './format';
import { bareIdOf } from './graphUtils';
import type { Frame, GraphHighlight, Snippet, TapeSnapshot } from './types';

export type RecordSnippetOptions = {
  machine: TuringMachine;
  initialState: State;
  graph: Graph;
  alphabets: string[][];
  name?: string;
  /**
   * Maximum number of iteration steps to record. Defaults to 1000.
   * If the machine hasn't halted after `maxSteps` iters, recording stops
   * and the snippet contains `maxSteps + 1` frames (frame 0 plus one per iter).
   */
  maxSteps?: number;
  /**
   * Optional per-frame log formatter. Called with the current and previous
   * `MachineState`; return a string to attach as `frame.log`, or `undefined`
   * to omit. Not called for frame 0 (initial state — no transition has fired).
   */
  log?: (m: MachineState, prev: MachineState | null) => string | undefined;
};

const DEFAULT_MAX_STEPS = 1000;

function snapshotTapes(machine: TuringMachine): TapeSnapshot[] {
  return machine.tapeBlock.tapes.map((t) => ({
    symbols: [...t.symbols],
    position: t.position,
  }));
}

function deriveCommands(
  m: MachineState,
): NonNullable<Frame['commands']> {
  return m.movements.map((mv, i) => ({
    movement: MOVEMENT_LETTER.get(mv) ?? 'S',
    read: m.currentSymbols[i],
    // nextSymbols is already resolved (keep → current symbol, erase → blank);
    // when write === read the command was a keep (UI suppresses the flash).
    write: m.nextSymbols[i],
  }));
}

function deriveHighlight(m: MachineState, graph: Graph): GraphHighlight {
  return {
    fromId: bareIdOf(m.state.id, graph),
    toId: m.nextState === haltState ? 0 : m.nextState.id,
    strong: 'from',
    paused: false,
  };
}

/**
 * Record a full machine run into a `Snippet` — a self-contained playback
 * artifact suitable for embeds, articles, or landing-page panels.
 *
 * The returned snippet contains one frame per iteration plus a frame-0
 * initial-state snapshot. Recording stops when the machine halts or when
 * `maxSteps` iterations have been consumed (default 1000).
 *
 * Tape-timing note: `runStepByStep` yields BEFORE applying its command
 * (the command is applied after the yield resumes). The recorder uses a
 * one-step-delayed snapshot so each frame's `tape` reflects the
 * post-command state for that frame's iter.
 */
export function recordSnippet(opts: RecordSnippetOptions): Snippet {
  const {
    machine,
    initialState,
    graph,
    alphabets,
    name,
    maxSteps = DEFAULT_MAX_STEPS,
    log,
  } = opts;

  const frames: Frame[] = [
    { step: 0, tape: snapshotTapes(machine), highlight: null },
  ];

  // pending holds everything for the frame whose tape snapshot is not yet
  // available (because applyCommand hasn't fired yet). It is flushed at the
  // start of the NEXT iter (when the tape reflects the previous command) and
  // after the loop (when the final command has been applied).
  let pending: Omit<Frame, 'tape'> | null = null;
  let prev: MachineState | null = null;

  try {
    for (const m of machine.runStepByStep({ initialState, stepsLimit: maxSteps })) {
      // At this point applyCommand for the PREVIOUS iter has already run
      // (the generator called applyCommand before looping back to yield).
      // So the current tape state = post-command of the previous iter.
      if (pending !== null) {
        frames.push({ ...pending, tape: snapshotTapes(machine) });
      }

      const commands = deriveCommands(m);
      const highlight = deriveHighlight(m, graph);
      const logLine = log ? log(m, prev) : undefined;

      pending = {
        step: m.step,
        commands,
        highlight,
        ...(logLine !== undefined ? { log: logLine } : {}),
      };

      prev = m;
    }
  } catch (e) {
    // runStepByStep throws 'Long execution' when stepsLimit is hit.
    // At that point applyCommand for the last yielded iter has run, so the
    // tape is in the post-command state we want for the pending frame.
    if (!(e instanceof Error) || e.message !== 'Long execution') {
      throw e;
    }
  }

  // Flush the last pending frame. After the loop (or after the catch), the
  // tape reflects the post-command state of the final yielded iter.
  if (pending !== null) {
    frames.push({ ...pending, tape: snapshotTapes(machine) });
  }

  return {
    version: 1,
    ...(name !== undefined ? { name } : {}),
    graph,
    alphabets,
    frames,
  };
}
