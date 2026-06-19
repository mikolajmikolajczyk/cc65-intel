import { describe, expect, it } from 'vitest'
import { PassThrough } from 'node:stream'
import {
  createMessageConnection,
  type MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node'
import { createConnection } from 'vscode-languageserver/node'
import { startServer } from '../src/index.js'

interface TextEdit {
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
  newText: string
}
interface Item {
  label: string
  kind?: number
  detail?: string
  data?: { header?: string }
  additionalTextEdits?: TextEdit[]
}

interface Position {
  line: number
  character: number
}

// Spins up the server over an in-memory stream pair, opens one document, and
// runs a completion — the same protocol the browser/worker host speaks.
async function complete(
  text: string,
  position: Position,
  initializationOptions: unknown = {},
): Promise<{ items: Item[]; client: MessageConnection }> {
  const c2s = new PassThrough()
  const s2c = new PassThrough()
  startServer(createConnection(new StreamMessageReader(c2s), new StreamMessageWriter(s2c)))
  const client = createMessageConnection(new StreamMessageReader(s2c), new StreamMessageWriter(c2s))
  client.listen()

  const uri = 'file:///active.c'
  await client.sendRequest('initialize', {
    processId: null,
    rootUri: null,
    capabilities: {},
    initializationOptions,
  })
  await client.sendNotification('initialized', {})
  await client.sendNotification('textDocument/didOpen', {
    textDocument: { uri, languageId: 'c', version: 1, text },
  })

  const res = await client.sendRequest<Item[] | { items: Item[] } | null>(
    'textDocument/completion',
    { textDocument: { uri }, position },
  )
  return { items: Array.isArray(res) ? res : (res?.items ?? []), client }
}

const CONIO = { sysrootHeaders: [{ path: 'include/conio.h', text: 'void cputs(const char* s);' }] }

// Validates the client↔server contract (method names + param/response shapes)
// end to end.
describe('@cc65-intel/lsp protocol', () => {
  it('serves struct-field completion after "." over LSP', async () => {
    const text = 'struct Foo { int x; char *name; };\nstruct Foo g;\ng.'
    const { items, client } = await complete(text, { line: 2, character: 2 })
    expect(items.map((i) => i.label).sort()).toEqual(['name', 'x'])
    client.dispose()
  })

  it('serves cc65 stdlib completion with header + detail via initializationOptions', async () => {
    const text = 'void main(void) {\n  cput\n}'
    const { items, client } = await complete(text, { line: 1, character: 6 }, CONIO)
    const cputs = items.find((i) => i.label === 'cputs')
    expect(cputs).toBeDefined()
    expect(cputs?.detail).toBe('void cputs(const char* s)')
    expect(cputs?.data?.header).toBe('conio.h')
    client.dispose()
  })

  it('attaches an auto-#include edit when the header is not yet included', async () => {
    const text = 'void main(void) {\n  cput\n}'
    const { items, client } = await complete(text, { line: 1, character: 6 }, CONIO)
    const cputs = items.find((i) => i.label === 'cputs')
    const edits = cputs?.additionalTextEdits
    expect(edits).toHaveLength(1)
    expect(edits![0]!.newText).toBe('#include <conio.h>\n')
    // top of the file, since there are no existing includes
    expect(edits![0]!.range.start).toEqual({ line: 0, character: 0 })
    client.dispose()
  })

  it('emits no auto-#include edit when the header is already included', async () => {
    const text = '#include <conio.h>\nvoid main(void) {\n  cput\n}'
    const { items, client } = await complete(text, { line: 2, character: 6 }, CONIO)
    const cputs = items.find((i) => i.label === 'cputs')
    expect(cputs).toBeDefined()
    expect(cputs?.additionalTextEdits).toBeUndefined()
    client.dispose()
  })
})
