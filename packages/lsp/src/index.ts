// @cc65-intel/lsp — a thin LSP server over @cc65-intel/core.
//
// SCAFFOLD: wired up once the core engine answers real completions. The server
// will map LSP requests onto the engine:
//   textDocument/completion → completeAt
//   textDocument/hover      → hoverAt
//   textDocument/didChange  → indexC (reindex the changed file)
//   textDocument/publishDiagnostics ← cc65 build output
// Transport-agnostic: a node stdio entry (VS Code / Neovim) and a browser
// Web Worker entry both drive the same handlers.

export const CC65_LSP_PLACEHOLDER = true
