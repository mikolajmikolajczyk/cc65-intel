import { describe, expect, it } from 'vitest'
import { PassThrough } from 'node:stream'
import {
  createMessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node'
import { createConnection } from 'vscode-languageserver/node'
import { startServer } from '../src/index.js'

interface Item {
  label: string
  kind?: number
}

// Drives the server over an in-memory stream pair with a plain JSON-RPC client —
// the same protocol the browser/worker host speaks. Validates the
// client↔server contract (method names + param/response shapes) end to end.
describe('@cc65-intel/lsp protocol', () => {
  it('serves struct-field completion after "." over LSP', async () => {
    const c2s = new PassThrough()
    const s2c = new PassThrough()
    startServer(createConnection(new StreamMessageReader(c2s), new StreamMessageWriter(s2c)))
    const client = createMessageConnection(
      new StreamMessageReader(s2c),
      new StreamMessageWriter(c2s),
    )
    client.listen()

    const uri = 'file:///active.c'
    const text = 'struct Foo { int x; char *name; };\nstruct Foo g;\ng.'
    await client.sendRequest('initialize', {
      processId: null,
      rootUri: null,
      capabilities: {},
      initializationOptions: {},
    })
    await client.sendNotification('initialized', {})
    await client.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: 'c', version: 1, text },
    })

    const res = await client.sendRequest<Item[] | { items: Item[] } | null>(
      'textDocument/completion',
      { textDocument: { uri }, position: { line: 2, character: 2 } },
    )
    const items = Array.isArray(res) ? res : (res?.items ?? [])
    expect(items.map((i) => i.label).sort()).toEqual(['name', 'x'])

    client.dispose()
  })
})
