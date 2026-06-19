import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  createMessageConnection,
  type MessageConnection,
  StreamMessageReader,
  StreamMessageWriter,
} from 'vscode-jsonrpc/node'

// Drives the real `cc65-lsp --stdio` binary as a child process over stdio — the
// transport Neovim / VS Code use — proving the node entry shares the same
// handlers as the browser worker.

const distEntry = fileURLToPath(new URL('../dist/node.js', import.meta.url))
const lspDir = fileURLToPath(new URL('..', import.meta.url))

interface Item {
  label: string
  detail?: string
}
interface Hover {
  contents: { kind: string; value: string }
}
interface Publish {
  uri: string
  diagnostics: { message: string }[]
}

describe('@cc65-intel/lsp node stdio transport', () => {
  let child: ChildProcessWithoutNullStreams
  let client: MessageConnection

  beforeAll(async () => {
    // Ensure the bin is built (also builds the core dependency it references).
    if (!existsSync(distEntry)) execFileSync('pnpm', ['-C', lspDir, 'build'], { stdio: 'inherit' })

    child = spawn(process.execPath, [distEntry, '--stdio'], { stdio: 'pipe' })
    client = createMessageConnection(
      new StreamMessageReader(child.stdout),
      new StreamMessageWriter(child.stdin),
    )
    client.listen()
    await client.sendRequest('initialize', {
      processId: null,
      rootUri: null,
      capabilities: {},
      initializationOptions: {},
    })
    await client.sendNotification('initialized', {})
  })

  afterAll(() => {
    client.dispose()
    child.kill()
  })

  it('serves completion over stdio', async () => {
    const uri = 'file:///main.c'
    const text = 'struct Foo { int x; char *name; };\nstruct Foo g;\ng.'
    await client.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: 'c', version: 1, text },
    })
    const res = await client.sendRequest<Item[] | { items: Item[] } | null>(
      'textDocument/completion',
      { textDocument: { uri }, position: { line: 2, character: 2 } },
    )
    const items = Array.isArray(res) ? res : (res?.items ?? [])
    expect(items.map((i) => i.label).sort()).toEqual(['name', 'x'])
  })

  it('serves hover over stdio', async () => {
    const uri = 'file:///h.c'
    const text = 'int add(int a, int b);\nvoid main(void) {\n  add(1, 2);\n}'
    await client.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: 'c', version: 1, text },
    })
    const res = await client.sendRequest<Hover | null>('textDocument/hover', {
      textDocument: { uri },
      position: { line: 2, character: 3 },
    })
    expect(res?.contents.value).toContain('int add(int a, int b)')
  })

  it('publishes diagnostics from pushed build output over stdio', async () => {
    const uri = 'file:///proj/diag.c'
    await client.sendNotification('textDocument/didOpen', {
      textDocument: { uri, languageId: 'c', version: 1, text: 'void main(void) {}' },
    })
    const published = await new Promise<Publish>((resolve) => {
      // didOpen publishes empty semantic diagnostics first; wait for the build push.
      client.onNotification('textDocument/publishDiagnostics', (p: Publish) => {
        if (p.uri === uri && p.diagnostics.length > 0) resolve(p)
      })
      void client.sendNotification('cc65/buildOutput', { output: 'diag.c:1:1: error: boom' })
    })
    expect(published.diagnostics[0]?.message).toContain('boom')
  })
})
