import {
  type Connection,
  type Diagnostic,
  type InitializeResult,
  type SemanticTokensLegend,
  CompletionItemKind,
  DiagnosticSeverity,
  MarkupKind,
  SemanticTokensBuilder,
  SymbolKind,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  completeAt,
  definitionAt,
  documentSymbols,
  hoverAt,
  indexC,
  parseBuildOutput,
  prepareRenameAt,
  referencesAt,
  renameAt,
  semanticTokens,
  signatureHelpAt,
  type CDiagnostic,
  type CDiagnosticSeverity,
  type CDocSymbolKind,
  type CIndex,
  type CLocation,
  type CSymbolKind,
  type CTokenType,
  type SourceFile,
} from '@cc65-intel/core'

// Transport-agnostic LSP server over the cc65-intel engine. A browser (Web
// Worker) entry and — later — a node stdio entry both call startServer with a
// connection; all the handlers live here.

const KIND: Record<CSymbolKind, CompletionItemKind> = {
  function: CompletionItemKind.Function,
  macro: CompletionItemKind.Constant,
  type: CompletionItemKind.Struct,
  global: CompletionItemKind.Variable,
  field: CompletionItemKind.Field,
}

interface InitOptions {
  /** cc65 sysroot headers (e.g. <_vic2.h>) the host mounts, so register structs
   *  resolve. Sent once at initialize. */
  sysrootHeaders?: SourceFile[]
}

/** Custom notification: the host pushes raw cc65/ca65/ld65 build output, the
 *  server parses it and publishes standard `textDocument/publishDiagnostics`.
 *  Host-agnostic (any editor with a build step uses it) — the browser worker
 *  has no compiler, so it pushes; a node host could also run cc65 itself. */
const BUILD_OUTPUT = 'cc65/buildOutput'
interface BuildOutputParams {
  output: string
}

const SEVERITY: Record<CDiagnosticSeverity, DiagnosticSeverity> = {
  error: DiagnosticSeverity.Error,
  warning: DiagnosticSeverity.Warning,
  note: DiagnosticSeverity.Information,
}

const SYMBOL_KIND: Record<CDocSymbolKind, SymbolKind> = {
  function: SymbolKind.Function,
  struct: SymbolKind.Struct,
  union: SymbolKind.Struct, // LSP has no Union kind
  enum: SymbolKind.Enum,
  typedef: SymbolKind.Class,
  variable: SymbolKind.Variable,
}

// Semantic-token legend: standard LSP token-type names (cc65 `field` maps to the
// standard `property`). The token-type number a client receives is the index
// into `tokenTypes`.
const SEMANTIC_LEGEND: SemanticTokensLegend = {
  tokenTypes: ['type', 'function', 'macro', 'parameter', 'property', 'variable'],
  tokenModifiers: [],
}
const TOKEN_INDEX: Record<CTokenType, number> = {
  type: 0,
  function: 1,
  macro: 2,
  parameter: 3,
  field: 4, // → property
  variable: 5,
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Any `#include <h>` / `#include "h"` line.
const INCLUDE_RE = /^[ \t]*#[ \t]*include[ \t]*[<"]([^>"]+)[>"].*$/gm

/** Where (offset into `text`) and what to insert so `header` is `#include`d,
 *  or null if it already is. The edit goes after the last existing `#include`
 *  (else at the top of the file). Pure host-side text logic — no engine. */
function includeInsert(text: string, header: string): { offset: number; newText: string } | null {
  if (new RegExp(`^[ \\t]*#[ \\t]*include[ \\t]*[<"]${escapeRe(header)}[>"]`, 'm').test(text)) {
    return null
  }
  let last: RegExpExecArray | null = null
  INCLUDE_RE.lastIndex = 0
  for (let m = INCLUDE_RE.exec(text); m; m = INCLUDE_RE.exec(text)) last = m
  if (!last) return { offset: 0, newText: `#include <${header}>\n` }
  const lineEnd = text.indexOf('\n', last.index + last[0].length)
  if (lineEnd === -1) return { offset: text.length, newText: `\n#include <${header}>` }
  return { offset: lineEnd + 1, newText: `#include <${header}>\n` }
}

export function startServer(connection: Connection): void {
  const documents = new TextDocuments(TextDocument)
  let sysrootHeaders: SourceFile[] = []
  let index: CIndex = indexC([])

  // cc65 projects are small — a full reindex on every change is cheap and keeps
  // cross-file types fresh. (Incremental reindex is a later optimisation.)
  const allFiles = (): SourceFile[] =>
    documents.all().map((d) => ({ path: d.uri, text: d.getText() }))

  const reindex = (): void => {
    index = indexC(allFiles(), { sysrootHeaders })
  }

  // An engine offset range → an LSP Location against its (open) document.
  const toLocation = (
    loc: CLocation,
  ): { uri: string; range: ReturnType<typeof rangeOf> } | null => {
    const target = documents.get(loc.uri)
    return target ? { uri: loc.uri, range: rangeOf(target, loc.start, loc.end) } : null
  }
  const rangeOf = (doc: TextDocument, start: number, end: number) => ({
    start: doc.positionAt(start),
    end: doc.positionAt(end),
  })

  connection.onInitialize((params): InitializeResult => {
    const opts = params.initializationOptions as InitOptions | undefined
    if (opts?.sysrootHeaders) sysrootHeaders = opts.sysrootHeaders
    return {
      capabilities: {
        // Full document sync — small cc65 files, simplest client. The host
        // sends the whole buffer on each change.
        textDocumentSync: TextDocumentSyncKind.Full,
        completionProvider: { triggerCharacters: ['.', '>'] },
        hoverProvider: true,
        definitionProvider: true,
        signatureHelpProvider: { triggerCharacters: ['(', ','] },
        documentSymbolProvider: true,
        referencesProvider: true,
        renameProvider: { prepareProvider: true },
        semanticTokensProvider: { legend: SEMANTIC_LEGEND, full: true },
      },
    }
  })

  connection.onInitialized(reindex)
  documents.onDidChangeContent(reindex)
  documents.onDidClose(reindex)

  connection.onCompletion((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []
    const text = doc.getText()
    const offset = doc.offsetAt(params.position)
    return completeAt(index, text, offset).map((item) => {
      // A symbol from a sysroot header that the buffer doesn't include yet gets
      // an auto-`#include` edit the host applies on accept (madside parity).
      const ins = item.header ? includeInsert(text, item.header) : null
      const pos = ins ? doc.positionAt(ins.offset) : null
      return {
        label: item.label,
        kind: KIND[item.kind],
        detail: item.detail,
        // The declaring header rides along in `data` for clients that want it.
        ...(item.header ? { data: { header: item.header } } : {}),
        ...(ins && pos
          ? { additionalTextEdits: [{ range: { start: pos, end: pos }, newText: ins.newText }] }
          : {}),
      }
    })
  })

  connection.onSignatureHelp((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    const help = signatureHelpAt(index, doc.getText(), doc.offsetAt(params.position))
    if (!help) return null
    return {
      signatures: [{ label: help.label, parameters: help.parameters.map((p) => ({ label: p })) }],
      activeSignature: 0,
      activeParameter: help.activeParameter,
    }
  })

  connection.onReferences((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []
    const offset = doc.offsetAt(params.position)
    let refs = referencesAt(allFiles(), doc.getText(), offset)
    if (!params.context.includeDeclaration) {
      const def = definitionAt(index, doc.getText(), offset)
      if (def) {
        refs = refs.filter(
          (r) => !(r.uri === def.uri && r.start === def.start && r.end === def.end),
        )
      }
    }
    return refs.map(toLocation).filter((l): l is NonNullable<typeof l> => l !== null)
  })

  connection.languages.semanticTokens.on((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return { data: [] }
    const builder = new SemanticTokensBuilder()
    for (const t of semanticTokens(index, doc.getText())) {
      const pos = doc.positionAt(t.start)
      builder.push(pos.line, pos.character, t.end - t.start, TOKEN_INDEX[t.type], 0)
    }
    return builder.build()
  })

  connection.onPrepareRename((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    const r = prepareRenameAt(doc.getText(), doc.offsetAt(params.position))
    return r ? rangeOf(doc, r.start, r.end) : null
  })

  connection.onRenameRequest((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    const edits = renameAt(allFiles(), doc.getText(), doc.offsetAt(params.position), params.newName)
    if (edits.length === 0) return null
    const changes: Record<string, { range: ReturnType<typeof rangeOf>; newText: string }[]> = {}
    for (const e of edits) {
      const target = documents.get(e.uri)
      if (!target) continue
      ;(changes[e.uri] ??= []).push({ range: rangeOf(target, e.start, e.end), newText: e.newText })
    }
    return { changes }
  })

  connection.onDocumentSymbol((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []
    return documentSymbols(doc.getText()).map((s) => ({
      name: s.name,
      kind: SYMBOL_KIND[s.kind],
      range: { start: doc.positionAt(s.start), end: doc.positionAt(s.end) },
      selectionRange: {
        start: doc.positionAt(s.selectionStart),
        end: doc.positionAt(s.selectionEnd),
      },
    }))
  })

  connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    const info = hoverAt(index, doc.getText(), doc.offsetAt(params.position))
    if (!info) return null
    return { contents: { kind: MarkupKind.Markdown, value: info.contents } }
  })

  connection.onDefinition((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    const loc = definitionAt(index, doc.getText(), doc.offsetAt(params.position))
    if (!loc) return null
    // Convert the engine's offset range to a line/column range against the
    // target file — an open document, else a sysroot header from init options.
    const targetText =
      documents.get(loc.uri)?.getText() ?? sysrootHeaders.find((h) => h.path === loc.uri)?.text
    if (targetText === undefined) return null
    const td = TextDocument.create(loc.uri, 'c', 0, targetText)
    return {
      uri: loc.uri,
      range: { start: td.positionAt(loc.start), end: td.positionAt(loc.end) },
    }
  })

  // Match a toolchain-printed path to an open document's URI by suffix
  // (`main.c` ↔ `file:///proj/main.c`). Unmatched files fall back to a `file://`
  // URI so non-open files (headers pulled into the build) still get squiggles.
  const resolveUri = (file: string): string => {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(file)) return file
    const norm = file.replace(/\\/g, '/')
    const open = documents
      .all()
      .find((d) => d.uri === norm || decodeURIComponent(d.uri).endsWith('/' + norm))
    return open ? open.uri : 'file://' + (norm.startsWith('/') ? norm : '/' + norm)
  }

  // A parsed diagnostic's 1-based line/col → a 0-based Range. When the target
  // document is open, extend the range to the end of the line so the squiggle is
  // visible; otherwise mark a zero-width point at the reported column.
  const toDiagnostic = (d: CDiagnostic, uri: string): Diagnostic => {
    const start = { line: Math.max(0, d.line - 1), character: Math.max(0, d.column - 1) }
    const lineText = documents.get(uri)?.getText().split(/\r?\n/)[start.line]
    const end =
      lineText !== undefined ? { line: start.line, character: lineText.length } : { ...start }
    return {
      range: { start, end },
      severity: SEVERITY[d.severity],
      source: 'cc65',
      message: d.message,
    }
  }

  // URIs we last published diagnostics to, so a fresh build that no longer
  // mentions a file clears its stale squiggles.
  let publishedUris = new Set<string>()

  connection.onNotification(BUILD_OUTPUT, (params: BuildOutputParams) => {
    const byUri = new Map<string, Diagnostic[]>()
    for (const d of parseBuildOutput(params.output)) {
      const uri = resolveUri(d.file)
      const list = byUri.get(uri) ?? []
      list.push(toDiagnostic(d, uri))
      byUri.set(uri, list)
    }
    for (const [uri, diagnostics] of byUri) void connection.sendDiagnostics({ uri, diagnostics })
    for (const uri of publishedUris) {
      if (!byUri.has(uri)) void connection.sendDiagnostics({ uri, diagnostics: [] })
    }
    publishedUris = new Set(byUri.keys())
  })

  documents.listen(connection)
  connection.listen()
}
