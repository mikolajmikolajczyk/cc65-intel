import { createRequire } from 'node:module'
import * as vscode from 'vscode'
import { LanguageClient, type ServerOptions, TransportKind } from 'vscode-languageclient/node.js'
import { readSysrootHeaders } from './sysroot.js'

// Minimal VS Code extension: it launches the shared cc65-intel LSP over node
// stdio (the same `cc65-lsp` server the browser worker shares) and wires the
// cc65 sysroot from a config setting. All analysis lives in the server; this is
// only the editor glue.

const require = createRequire(import.meta.url)
let client: LanguageClient | undefined

export function activate(context: vscode.ExtensionContext): void {
  // The node stdio entry of @cc65-intel/lsp; the client forks it with node.
  const serverModule = require.resolve('@cc65-intel/lsp/node')
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.stdio },
    debug: { module: serverModule, transport: TransportKind.stdio },
  }

  const sysrootDir = vscode.workspace.getConfiguration('cc65').get<string>('sysrootDir', '')

  client = new LanguageClient('cc65', 'cc65-intel', serverOptions, {
    documentSelector: [
      { scheme: 'file', language: 'c' },
      { scheme: 'file', language: 'cpp' },
    ],
    initializationOptions: { sysrootHeaders: readSysrootHeaders(sysrootDir) },
  })

  context.subscriptions.push({ dispose: () => void client?.stop() })
  void client.start()
}

export function deactivate(): Thenable<void> | undefined {
  return client?.stop()
}
