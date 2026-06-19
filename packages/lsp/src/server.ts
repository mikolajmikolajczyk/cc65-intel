import {
  type Connection,
  type InitializeResult,
  CompletionItemKind,
  TextDocuments,
  TextDocumentSyncKind,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import {
  completeAt,
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
      },
    }
  })

  connection.onInitialized(reindex)
  documents.onDidChangeContent(reindex)
  documents.onDidClose(reindex)

  connection.onCompletion((params) => {
    const doc = documents.get(params.textDocument.uri)
    if (!doc) return []
    const offset = doc.offsetAt(params.position)
    return completeAt(index, doc.getText(), offset).map((item) => ({
      label: item.label,
      kind: KIND[item.kind],
      detail: item.detail,
      // The declaring header rides along in `data` for the client / the
      // auto-`#include` resolver (issue #19) to turn into additionalTextEdits.
      ...(item.header ? { data: { header: item.header } } : {}),
    }))
  })

  documents.listen(connection)
  connection.listen()
}
