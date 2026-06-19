import { describe, expect, it } from 'vitest'
import { startServer } from '../src/index.js'

// The server's behaviour is exercised end-to-end through the engine tests
// (@cc65-intel/core) + the host integration. Here we assert the package's
// public shape so the transport entries have a stable handle to call.
describe('@cc65-intel/lsp', () => {
  it('exposes a startServer(connection) entry', () => {
    expect(typeof startServer).toBe('function')
    expect(startServer.length).toBe(1)
  })
})
