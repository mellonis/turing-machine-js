import State from '../classes/State';
import Tape from '../classes/Tape';
import TapeBlock from '../classes/TapeBlock';
import TuringMachine from '../classes/TuringMachine';

// equivalentOn — behavioral equivalence checking, the typical "is the
// student's machine correct against my reference?" tool. This is a *testing*
// utility (runs both machines, compares outputs) — distinct from introspection
// (which looks at structure without running).

// A runnable specification: the start state and a factory that yields a fresh
// (uncontaminated) TapeBlock per test case. Mirrors the
// `binaryNumbers.getTapeBlock()` convention.
export type Runnable = {
  state: State;
  getTapeBlock: () => TapeBlock;
};

// One test case. Use the string shorthand when both sides share the same
// alphabet; pass an explicit { reference, candidate } pair when the alphabets
// differ (e.g. one student wrote the algorithm with '01' and another with 'AB').
export type EquivalenceCase = string | { reference: string; candidate: string };

export type EquivalenceResult = {
  case: { reference: string; candidate: string };
  agree: boolean;
  referenceOutput: string;
  candidateOutput: string;
  referenceSteps: number;
  candidateSteps: number;
  // Step at which the per-step tape snapshots first diverged. null when they
  // never diverged before halt (i.e. agree === true) or when the supplied
  // compareSnapshots could not detect divergence (e.g. cross-alphabet without
  // a snapshot comparator). 1-indexed: a value of k means "after step k's
  // command, the tapes differed."
  firstDivergenceStep: number | null;
};

export type EquivalenceReport = {
  results: EquivalenceResult[];
  allAgree: boolean;
};

const defaultCompare = (a: string, b: string): boolean => a === b;

export function equivalentOn(
  reference: Runnable,
  candidate: Runnable,
  cases: EquivalenceCase[],
  options: {
    compareOutputs?: (refOutput: string, candOutput: string) => boolean;
    compareSnapshots?: ((refSnap: string, candSnap: string) => boolean) | null;
    stepsLimit?: number;
  } = {},
): EquivalenceReport {
  const compareOutputs = options.compareOutputs ?? defaultCompare;
  const compareSnapshots = options.compareSnapshots === undefined
    ? defaultCompare
    : options.compareSnapshots;
  const stepsLimit = options.stepsLimit ?? 1e5;

  const results: EquivalenceResult[] = cases.map((c) => {
    const pair = typeof c === 'string' ? {reference: c, candidate: c} : c;
    const refRun = runOnce(reference, pair.reference, stepsLimit);
    const candRun = runOnce(candidate, pair.candidate, stepsLimit);
    const agree = compareOutputs(refRun.finalOutput, candRun.finalOutput);

    let firstDivergenceStep: number | null = null;

    if (!agree && compareSnapshots !== null) {
      const minLen = Math.min(refRun.snapshots.length, candRun.snapshots.length);

      for (let i = 0; i < minLen; i += 1) {
        if (!compareSnapshots(refRun.snapshots[i], candRun.snapshots[i])) {
          firstDivergenceStep = i;
          break;
        }
      }

      if (firstDivergenceStep === null && refRun.snapshots.length !== candRun.snapshots.length) {
        firstDivergenceStep = minLen;
      }
    }

    return {
      case: pair,
      agree,
      referenceOutput: refRun.finalOutput,
      candidateOutput: candRun.finalOutput,
      referenceSteps: refRun.stepCount,
      candidateSteps: candRun.stepCount,
      firstDivergenceStep,
    };
  });

  return {
    results,
    allAgree: results.every((r) => r.agree),
  };
}

// Single-machine runner: snapshots the tape after each step and returns the
// final output, the snapshot list, and the step count.
function runOnce(
  runnable: Runnable,
  input: string,
  stepsLimit: number,
): { finalOutput: string; snapshots: string[]; stepCount: number } {
  const tapeBlock = runnable.getTapeBlock();
  const tape = new Tape({
    alphabet: tapeBlock.tapes[0].alphabet,
    symbols: input.split(''),
  });

  tapeBlock.replaceTape(tape);

  const machine = new TuringMachine({tapeBlock});
  const snapshots: string[] = [];
  let stepCount = 0;

  // Iterate the generator manually (the yielded MachineState isn't needed —
  // we only care about the side effects on the tape). At each yield the tape
  // reflects the state BEFORE the current step's command; after the loop
  // exits the tape has had every command applied.
  const generator = machine.runStepByStep({initialState: runnable.state, stepsLimit});
  let result = generator.next();

  while (!result.done) {
    snapshots.push(tape.symbols.join(''));
    stepCount += 1;
    result = generator.next();
  }

  snapshots.push(tape.symbols.join(''));

  return {
    finalOutput: tape.symbols.join('').trim(),
    snapshots,
    stepCount,
  };
}
