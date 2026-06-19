// Public entrypoint for @cc65-intel/core. The ONLY surface consumers import —
// editors via a thin adapter, the LSP server, or any other tool. Pure data
// in/out; no editor/LSP/DOM types leak across this boundary.

export type {
  SourceFile,
  CSymbolKind,
  CField,
  CType,
  CSymbol,
  CIndex,
  CompletionItem,
  HoverInfo,
  IndexOptions,
} from './types'

export { parseC } from './parse'
export { indexC } from './index-c'
export { completeAt } from './complete'
export { hoverAt } from './hover'
