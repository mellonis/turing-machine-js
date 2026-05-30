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

```sh
npm install @turing-machine-js/visuals @turing-machine-js/machine
```
