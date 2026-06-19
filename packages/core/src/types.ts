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

export interface CField {
  name: string
  /** The field's type name as written, so nested `a.b.c` can resolve. */
  type: string
}

export interface CType {
  /** struct / union / enum tag or typedef name. */
  name: string
  kind: 'struct' | 'union' | 'enum' | 'typedef'
  fields: CField[]
  /** Source file basename the type was found in (hover provenance). */
  file: string
}

export interface CSymbol {
  label: string
  kind: CSymbolKind
  /** Declared type name when known (globals/locals) — drives member resolution. */
  type?: string
  /** One-line signature/detail for completion + hover. */
  detail?: string
  /** Header that declares it (cc65 stdlib), for editor auto-include. */
  header?: string
  /** Source file basename. */
  file: string
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

export interface IndexOptions {
  /** cc65 sysroot headers (e.g. `<_vic2.h>`) so register structs (VIC/SID/CIA)
   *  resolve. Indexed read-only alongside the project files. */
  sysrootHeaders?: SourceFile[]
}
