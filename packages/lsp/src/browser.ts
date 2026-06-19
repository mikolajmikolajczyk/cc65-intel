import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from 'vscode-languageserver/browser'
import { startServer } from './server.js'

// Web Worker entry: the host runs this module as a worker; the LSP speaks
// JSON-RPC over the worker's message port. Pair with a CodeMirror language
// client on the main thread.

const worker = self as DedicatedWorkerGlobalScope
startServer(createConnection(new BrowserMessageReader(worker), new BrowserMessageWriter(worker)))
