// Public API — extracted modules + Snippet recording surface.
export type { NodeKey, HighlightClass, HighlightOps, IndicatorOps, RecordedOp } from './highlightOps';
export { recordingOps } from './highlightOps';
export { bareIdOf, highlightExpand, equivalentIds } from './graphUtils';
export type { GraphIndexes } from './graphIndexes';
export { indexGraph } from './graphIndexes';
export type { GraphHighlight, TapeSnapshot, Frame, Snippet } from './types';
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
export { tapeViewport } from './tapeViewport';
