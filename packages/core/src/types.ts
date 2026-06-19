// Public data contract for cc65-intel/core. Pure data — NO CodeMirror, NO LSP,
// NO DOM. Positions are character offsets into the source text; line/column
// conversion is a transport concern (the LSP/editor adapter), deliberately kept
// out of the engine so the same core serves a CodeMirror client and an LSP
// server unchanged.

export interface SourceFile {
  /** Project-relative path — used for dedup + provenance in hover. */
  path: string
  text: string
}

export type CSymbolKind = 'function' | 'macro' | 'type' | 'global' | 'field'

/** Where a definition lives: the source file's path (as given to `indexC`, the
 *  LSP turns it into a document URI) and the character offset range of the
 *  defining identifier. Offsets, never line/column — conversion is the LSP's job. */
export interface CLocation {
  uri: string
  start: number
  end: number
}

export interface CField {
  name: string
  /** The field's type name as written, so nested `a.b.c` can resolve. */
  type: string
  /** Definition location of the field's declarator (go-to-definition). */
  loc?: CLocation
}

export interface CType {
  /** struct / union / enum tag or typedef name. */
  name: string
  kind: 'struct' | 'union' | 'enum' | 'typedef'
  fields: CField[]
  /** Source file basename the type was found in (hover provenance). */
  file: string
  /** Definition location of the type tag (go-to-definition). */
  loc?: CLocation
}

export interface CSymbol {
  label: string
  kind: CSymbolKind
  /** Declared type name when known (globals/locals) — drives member resolution. */
  type?: string
  /** One-line signature/detail for completion + hover. */
  detail?: string
  /** For functions: each parameter as written (drives signature help). A lone
   *  `void` parameter list is recorded as `[]`. */
  params?: string[]
  /** Header that declares it (cc65 stdlib), for editor auto-include. */
  header?: string
  /** Source file basename. */
  file: string
  /** Definition location of the symbol's defining identifier (go-to-definition). */
  loc?: CLocation
}

/** Built index for a project: types-by-name + top-level symbols + typedef
 *  aliases (`typedef struct S *SP` → `SP`→`S`). Rebuilt per-file cheaply (cc65
 *  projects are small), so a `didChange` reindex is fine. */
export interface CIndex {
  types: Map<string, CType>
  symbols: Map<string, CSymbol>
  /** Typedef alias → the underlying type name it resolves to (followed
   *  transitively during member resolution). */
  aliases: Map<string, string>
}

export interface CompletionItem {
  label: string
  kind: CSymbolKind
  detail?: string
  /** Header that declares the symbol, for editor auto-`#include`. */
  header?: string
}

export interface HoverInfo {
  /** Plain-text or markdown hover body. */
  contents: string
}

/** Signature help for the call enclosing the cursor: the function's one-line
 *  signature, its parameters (as written), and which one the cursor is on. */
export interface CSignatureHelp {
  label: string
  parameters: string[]
  activeParameter: number
}

export type CDocSymbolKind = 'function' | 'struct' | 'union' | 'enum' | 'typedef' | 'variable'

/** A top-level declaration for a file outline. Offsets, never line/column —
 *  `start`/`end` span the whole declaration, `selectionStart`/`selectionEnd`
 *  the name identifier (what an editor highlights on reveal). */
export interface CDocumentSymbol {
  name: string
  kind: CDocSymbolKind
  start: number
  end: number
  selectionStart: number
  selectionEnd: number
}

export type CDiagnosticSeverity = 'error' | 'warning' | 'note'

/** One parsed cc65/ca65/ld65 diagnostic. `line`/`column` are 1-based, exactly
 *  as the toolchain emits them — the LSP/editor converts to a 0-based Range.
 *  (Unlike the rest of the engine, which speaks offsets, this is parsed external
 *  tool output, so it carries the tool's own line/column.) */
export interface CDiagnostic {
  /** File path as the toolchain printed it (host maps it to a document URI). */
  file: string
  /** 1-based line. */
  line: number
  /** 1-based column; 1 when the tool omits it. */
  column: number
  severity: CDiagnosticSeverity
  message: string
}

export interface IndexOptions {
  /** cc65 sysroot headers (e.g. `<_vic2.h>`) so register structs (VIC/SID/CIA)
   *  resolve. Indexed read-only alongside the project files. */
  sysrootHeaders?: SourceFile[]
}
