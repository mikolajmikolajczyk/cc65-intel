#!/usr/bin/env node
// Explicit `.js`: vscode-languageserver ships no `exports` map, so node's ESM
// loader needs the extension on this subpath (the browser entry is only ever
// bundled, never run by node directly, so it can omit it).
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js'
import { startServer } from './server.js'

// Node stdio entry — `cc65-lsp --stdio` for Neovim / VS Code / any LSP client.
// It shares the exact `startServer` the browser worker runs, so no node-only
// logic creeps onto the request path. `createConnection(ProposedFeatures.all)`
// reads the transport flag (`--stdio`) from argv.
startServer(createConnection(ProposedFeatures.all))
