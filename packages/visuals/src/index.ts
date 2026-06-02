// Public API — extracted modules + Snippet recording surface.
export type { NodeKey, HighlightClass, HighlightOps, IndicatorOps, RecordedOp } from './highlightOps';
export { recordingOps } from './highlightOps';
export { bareIdOf, highlightExpand, equivalentIds } from './graphUtils';
export type { GraphIndexes } from './graphIndexes';
export { indexGraph } from './graphIndexes';
export type { GraphHighlight, Frame, Snippet } from './types';
// Re-exported from @turing-machine-js/machine for consumer-import stability —
// the canonical home is the engine package (next to the `Tape` class).
export type { TapeSnapshot } from '@turing-machine-js/machine';
export { applyHighlight, applyIndicator } from './applyHighlight';
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
export { recordSnippet, type RecordSnippetOptions } from './recordSnippet';
export { SnippetPlayer } from './snippetPlayer';
// Re-exported from @turing-machine-js/machine for consumer-import stability —
// the canonical home is the engine package (next to the `Tape` class).
export { tapeViewport } from '@turing-machine-js/machine';
