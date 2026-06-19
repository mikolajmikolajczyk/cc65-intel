import {
  type Connection,
  type InitializeResult,
  CompletionItemKind,
  MarkupKind,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  completeAt,
  hoverAt,
  indexC,
  type CIndex,
  type CSymbolKind,
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
  const reindex = (): void => {
    const files: SourceFile[] = documents.all().map((d) => ({ path: d.uri, text: d.getText() }))
    index = indexC(files, { sysrootHeaders })
  }

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

  connection.onHover((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return null
    const info = hoverAt(index, doc.getText(), doc.offsetAt(params.position))
    if (!info) return null
    return { contents: { kind: MarkupKind.Markdown, value: info.contents } }
  })

  documents.listen(connection)
  connection.listen()
}
