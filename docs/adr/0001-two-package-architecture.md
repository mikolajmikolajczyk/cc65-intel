# ADR-0001 — Two-package architecture + core purity boundary

**Status:** accepted

## Context

cc65-intel must serve several hosts: an in-browser editor (madside, via
CodeMirror in a Web Worker), and — later — a node LSP for VS Code / Neovim. If
the analysis logic is tangled with any one host's API (CodeMirror types, the LSP
protocol, the DOM), it can't be reused by the others, and it can't be lifted out
as a standalone library.

## Decision

Split into two packages:

- **`@cc65-intel/core`** — the analysis engine. Pure functions over plain data:
  `indexC(files) → CIndex`, `completeAt(index, text, offset)`,
  `hoverAt(index, text, offset)`. It depends only on parsing/data libraries.
  **No CodeMirror, no LSP, no DOM.** Positions are character **offsets**;
  line/column conversion is a host concern.
- **`@cc65-intel/lsp`** — a thin server mapping the LSP protocol onto the engine.
  Transport-agnostic (Web Worker + node stdio).

The boundary is **machine-enforced** (`eslint-plugin-boundaries` +
`no-restricted-imports`): `core` may import only `core`; any editor/LSP/DOM
import in `core` fails CI.

## Consequences

- The same engine drives the CodeMirror client, the LSP server, and any future
  tool — no reimplementation.
- The engine is trivially extractable / publishable (`@cc65-intel/core` on npm).
- Hosts must convert their position model to offsets at the boundary — a tiny,
  one-place cost.
- A host that wants editor-specific behaviour (auto-`#include`, trigger
  characters) implements it in its adapter, not the engine.
