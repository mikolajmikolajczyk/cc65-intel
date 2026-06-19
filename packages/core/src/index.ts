// Public entrypoint for @cc65-intel/core. The ONLY surface consumers import —
// editors via a thin adapter, the LSP server, or any other tool. Pure data
// in/out; no editor/LSP/DOM types leak across this boundary.

export type {
  SourceFile,
  CSymbolKind,
  CLocation,
  CField,
  CType,
  CSymbol,
  CIndex,
  CompletionItem,
  HoverInfo,
  IndexOptions,
  CDiagnostic,
  CDiagnosticSeverity,
  CSignatureHelp,
  CDocSymbolKind,
  CDocumentSymbol,
} from './types.js'

export { parseC } from './parse.js'
export { indexC } from './index-c.js'
export { completeAt } from './complete.js'
export { hoverAt } from './hover.js'
export { definitionAt } from './definition.js'
export { parseBuildOutput } from './diagnostics.js'
export { signatureHelpAt } from './signature.js'
export { documentSymbols } from './outline.js'
export { findReferences, referencesAt } from './references.js'
