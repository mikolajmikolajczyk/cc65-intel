// Transport-agnostic server entry. Pair it with a connection:
//   - browser/worker → import '@cc65-intel/lsp/browser' (runs as a Web Worker)
//   - node/stdio     → (planned) a node entry passing a stdio connection
export { startServer } from './server.js'
