import {equivalentOn} from './equivalence';
import binaryNumbers from '@turing-machine-js/library-binary-numbers';
import binaryNumbersBare from '@turing-machine-js/library-binary-numbers-bare';

describe('equivalentOn', () => {
  test('agrees when reference and candidate produce identical results (same alphabet)', () => {
    // minusOne and minusOneFast should agree on every case in the test suite.
    const report = equivalentOn(
      {state: binaryNumbers.states.minusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      {state: binaryNumbers.states.minusOneFast, getTapeBlock: binaryNumbers.getTapeBlock},
      ['^1$', '^10$', '^11$', '^110$', '^111$', '^1000$'],
    );

    expect(report.allAgree).toBe(true);
    expect(report.results.every((r) => r.firstDivergenceStep === null)).toBe(true);
  });

  test('reports disagreement and first divergence step', () => {
    // plusOne vs minusOne — these will produce different outputs.
    const report = equivalentOn(
      {state: binaryNumbers.states.plusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      {state: binaryNumbers.states.minusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      ['^10$'],
    );

    expect(report.allAgree).toBe(false);
    expect(report.results[0].agree).toBe(false);
    expect(report.results[0].referenceOutput).toBe('^11$');   // 2+1=3
    expect(report.results[0].candidateOutput).toBe('^1$');    // 2-1=1
    expect(report.results[0].firstDivergenceStep).not.toBeNull();
  });

  test('also exposes per-side step counts', () => {
    // minusOne (heavy: 4-deep composition) vs minusOneFast (direct borrow)
    // should agree on output but minusOne should run more steps.
    const report = equivalentOn(
      {state: binaryNumbers.states.minusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      {state: binaryNumbers.states.minusOneFast, getTapeBlock: binaryNumbers.getTapeBlock},
      ['^1000$'],
    );

    expect(report.results[0].agree).toBe(true);
    expect(report.results[0].referenceSteps).toBeGreaterThan(report.results[0].candidateSteps);
  });

  test('cross-alphabet equivalence with paired cases + comparators', () => {
    // plusOne in marker library uses '^…$' delimiters; bare uses raw digits.
    // Cross-alphabet output comparison: strip markers from the marker output
    // and compare against the bare output.
    const stripMarkers = (s: string): string => s.replace(/^\^/, '').replace(/\$$/, '');

    const report = equivalentOn(
      {state: binaryNumbers.states.plusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      {state: binaryNumbersBare.states.plusOne, getTapeBlock: binaryNumbersBare.getTapeBlock},
      [
        {reference: '^1$', candidate: '1'},
        {reference: '^10$', candidate: '10'},
        {reference: '^111$', candidate: '111'},
      ],
      {
        compareOutputs: (refOut, candOut) => stripMarkers(refOut) === candOut,
        compareSnapshots: null,  // skip mid-run divergence detection across alphabets
      },
    );

    expect(report.allAgree).toBe(true);
  });

  test('cross-alphabet disagreement', () => {
    // Compare plusOne (marker) against minusOne (bare) — same input shape but
    // different operations, so they should disagree.
    const stripMarkers = (s: string): string => s.replace(/^\^/, '').replace(/\$$/, '');

    const report = equivalentOn(
      {state: binaryNumbers.states.plusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      {state: binaryNumbersBare.states.minusOne, getTapeBlock: binaryNumbersBare.getTapeBlock},
      [{reference: '^10$', candidate: '10'}],
      {
        compareOutputs: (refOut, candOut) => stripMarkers(refOut) === candOut,
        compareSnapshots: null,
      },
    );

    expect(report.allAgree).toBe(false);
  });

  test('firstDivergenceStep falls back to minLen when snapshots agree but step counts differ', () => {
    // minusOne (4-deep composition) and minusOneFast produce the same output but
    // run for different step counts. To exercise the "snapshots agree at every
    // comparable step but lengths differ" fallback path, force outputs to disagree
    // (compareOutputs: () => false) and snapshots to always agree
    // (compareSnapshots: () => true). The post-loop length-mismatch branch then
    // sets firstDivergenceStep = minLen (the smaller of the two step counts).
    const report = equivalentOn(
      {state: binaryNumbers.states.minusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      {state: binaryNumbers.states.minusOneFast, getTapeBlock: binaryNumbers.getTapeBlock},
      ['^1000$'],
      {
        compareOutputs: () => false,
        compareSnapshots: () => true,
      },
    );

    const {referenceSteps, candidateSteps, firstDivergenceStep} = report.results[0];

    expect(report.results[0].agree).toBe(false);
    // Pin the exact fallback value: 1-indexed step number at which the
    // SHORTER side ran out of comparable iterations, i.e. minLen + 1
    // (the first step the longer side took without a reference snapshot
    // to compare against).
    expect(firstDivergenceStep).toBe(Math.min(referenceSteps, candidateSteps) + 1);
    // Sanity: the heavy composition really does run more steps than the
    // direct-borrow variant on this input.
    expect(referenceSteps).toBeGreaterThan(candidateSteps);
  });

  test('compareSnapshots: null skips mid-run divergence detection on same alphabet', () => {
    // Audit gap: the `compareSnapshots: null` branch was exercised only in
    // cross-alphabet tests. This test pins the same-alphabet contract:
    // when outputs disagree but compareSnapshots is null, firstDivergenceStep
    // is null (the engine doesn't probe step-by-step).
    const report = equivalentOn(
      {state: binaryNumbers.states.plusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      {state: binaryNumbers.states.minusOne, getTapeBlock: binaryNumbers.getTapeBlock},
      ['^10$'],
      {
        compareSnapshots: null,
      },
    );

    expect(report.results[0].agree).toBe(false);
    expect(report.results[0].firstDivergenceStep).toBeNull();
  });
});
