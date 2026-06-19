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

interface Hover {
  contents: { kind: string; value: string }
}

// Opens a document and runs a hover request at `position`.
async function hover(
  text: string,
  position: Position,
  initializationOptions: unknown = {},
): Promise<{ result: Hover | null; client: MessageConnection }> {
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

  const result = await client.sendRequest<Hover | null>('textDocument/hover', {
    textDocument: { uri },
    position,
  })
  return { result, client }
}

const CONIO = { sysrootHeaders: [{ path: 'include/conio.h', text: 'void cputs(const char* s);' }] }

interface SignatureHelp {
  signatures: { label: string; parameters: { label: string }[] }[]
  activeSignature: number
  activeParameter: number
}

// Opens a document and runs a signature-help request at `position`.
async function signatureHelp(
  text: string,
  position: Position,
): Promise<{ result: SignatureHelp | null; client: MessageConnection }> {
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
    initializationOptions: {},
  })
  await client.sendNotification('initialized', {})
  await client.sendNotification('textDocument/didOpen', {
    textDocument: { uri, languageId: 'c', version: 1, text },
  })

  const result = await client.sendRequest<SignatureHelp | null>('textDocument/signatureHelp', {
    textDocument: { uri },
    position,
  })
  return { result, client }
}

interface Location {
  uri: string
  range: { start: Position; end: Position }
}

// Opens one or more documents, then runs a go-to-definition at `position` in the
// first one. Exercises the cross-document path the host uses.
async function definition(
  docs: { uri: string; text: string }[],
  position: Position,
  initializationOptions: unknown = {},
): Promise<{ result: Location | Location[] | null; client: MessageConnection }> {
  const c2s = new PassThrough()
  const s2c = new PassThrough()
  startServer(createConnection(new StreamMessageReader(c2s), new StreamMessageWriter(s2c)))
  const client = createMessageConnection(new StreamMessageReader(s2c), new StreamMessageWriter(c2s))
  client.listen()

  await client.sendRequest('initialize', {
    processId: null,
    rootUri: null,
    capabilities: {},
    initializationOptions,
  })
  await client.sendNotification('initialized', {})
  for (const d of docs) {
    await client.sendNotification('textDocument/didOpen', {
      textDocument: { uri: d.uri, languageId: 'c', version: 1, text: d.text },
    })
  }

  const result = await client.sendRequest<Location | Location[] | null>('textDocument/definition', {
    textDocument: { uri: docs[0]!.uri },
    position,
  })
  return { result, client }
}

interface PublishParams {
  uri: string
  diagnostics: {
    range: { start: Position; end: Position }
    severity?: number
    source?: string
    message: string
  }[]
}

// Opens docs, pushes raw cc65 build output via the custom `cc65/buildOutput`
// notification, and collects every `textDocument/publishDiagnostics` the server
// emits in response (resolved once `settle` ms pass with no further publish).
async function pushBuildOutput(
  docs: { uri: string; text: string }[],
  output: string,
): Promise<{ published: PublishParams[]; client: MessageConnection }> {
  const c2s = new PassThrough()
  const s2c = new PassThrough()
  startServer(createConnection(new StreamMessageReader(c2s), new StreamMessageWriter(s2c)))
  const client = createMessageConnection(new StreamMessageReader(s2c), new StreamMessageWriter(c2s))
  client.listen()

  const published: PublishParams[] = []
  client.onNotification('textDocument/publishDiagnostics', (p: PublishParams) => {
    published.push(p)
  })

  await client.sendRequest('initialize', {
    processId: null,
    rootUri: null,
    capabilities: {},
    initializationOptions: {},
  })
  await client.sendNotification('initialized', {})
  for (const d of docs) {
    await client.sendNotification('textDocument/didOpen', {
      textDocument: { uri: d.uri, languageId: 'c', version: 1, text: d.text },
    })
  }

  await client.sendNotification('cc65/buildOutput', { output })
  // Let the server process the notification and flush publishDiagnostics.
  await new Promise((r) => setTimeout(r, 50))
  return { published, client }
}

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

  it('serves hover with markdown contents over LSP', async () => {
    const text = 'int add(int a, int b);\nvoid main(void) {\n  add(1, 2);\n}'
    const { result, client } = await hover(text, { line: 2, character: 3 })
    expect(result).not.toBeNull()
    expect(result!.contents.kind).toBe('markdown')
    expect(result!.contents.value).toContain('int add(int a, int b)')
    expect(result!.contents.value).toContain('*function*')
    client.dispose()
  })

  it('returns null hover on a miss', async () => {
    const text = 'int main(void) { return 0; }'
    const { result, client } = await hover(text, { line: 0, character: 22 })
    expect(result).toBeNull()
    client.dispose()
  })

  it('serves cross-file go-to-definition between open documents', async () => {
    const lib = { uri: 'file:///lib.c', text: 'int add(int a, int b) { return a + b; }' }
    const main = { uri: 'file:///main.c', text: 'void f(void) {\n  add(1, 2);\n}' }
    // cursor on `add` in main.c (line 1, char 2..5)
    const { result, client } = await definition([main, lib], { line: 1, character: 3 })
    const loc = Array.isArray(result) ? result[0] : result
    expect(loc?.uri).toBe('file:///lib.c')
    // `add` starts at offset 4 → line 0, char 4
    expect(loc?.range.start).toEqual({ line: 0, character: 4 })
    client.dispose()
  })

  it('serves go-to-definition into a sysroot header', async () => {
    const main = { uri: 'file:///main.c', text: 'void f(void) {\n  cputs("hi");\n}' }
    const { result, client } = await definition([main], { line: 1, character: 3 }, CONIO)
    const loc = Array.isArray(result) ? result[0] : result
    expect(loc?.uri).toBe('include/conio.h')
    expect(loc?.range.start).toEqual({ line: 0, character: 5 })
    client.dispose()
  })

  it('serves find-references across open documents over LSP', async () => {
    const lib = { uri: 'file:///lib.c', text: 'int counter;\nvoid bump(void) { counter++; }' }
    const main = {
      uri: 'file:///main.c',
      text: 'extern int counter;\nint get(void){return counter;}',
    }
    const c2s = new PassThrough()
    const s2c = new PassThrough()
    startServer(createConnection(new StreamMessageReader(c2s), new StreamMessageWriter(s2c)))
    const client = createMessageConnection(
      new StreamMessageReader(s2c),
      new StreamMessageWriter(c2s),
    )
    client.listen()
    await client.sendRequest('initialize', {
      processId: null,
      rootUri: null,
      capabilities: {},
      initializationOptions: {},
    })
    await client.sendNotification('initialized', {})
    for (const d of [lib, main]) {
      await client.sendNotification('textDocument/didOpen', {
        textDocument: { uri: d.uri, languageId: 'c', version: 1, text: d.text },
      })
    }
    // cursor on `counter` in lib.c line 0
    const res = await client.sendRequest<Location[]>('textDocument/references', {
      textDocument: { uri: lib.uri },
      position: { line: 0, character: 5 },
      context: { includeDeclaration: true },
    })
    expect(res.map((l) => l.uri).sort()).toEqual([
      'file:///lib.c',
      'file:///lib.c',
      'file:///main.c',
      'file:///main.c',
    ])
    client.dispose()
  })

  it('serves document symbols (file outline) over LSP', async () => {
    const text = 'struct Foo { int x; };\nint score;\nvoid run(void) {\n  int local;\n}'
    const c2s = new PassThrough()
    const s2c = new PassThrough()
    startServer(createConnection(new StreamMessageReader(c2s), new StreamMessageWriter(s2c)))
    const client = createMessageConnection(
      new StreamMessageReader(s2c),
      new StreamMessageWriter(c2s),
    )
    client.listen()
    const uri = 'file:///active.c'
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
    interface DocSym {
      name: string
      kind: number
      range: { start: Position; end: Position }
      selectionRange: { start: Position; end: Position }
    }
    const res = await client.sendRequest<DocSym[]>('textDocument/documentSymbol', {
      textDocument: { uri },
    })
    expect(res.map((s) => s.name)).toEqual(['Foo', 'score', 'run'])
    const foo = res.find((s) => s.name === 'Foo')!
    expect(foo.kind).toBe(23) // SymbolKind.Struct
    expect(foo.selectionRange.start).toEqual({ line: 0, character: 7 })
    // no `local` leaking from the function body
    expect(res.some((s) => s.name === 'local')).toBe(false)
    client.dispose()
  })

  it('serves signature help with the active parameter over LSP', async () => {
    const text = 'int add(int a, int b);\nvoid main(void) {\n  add(1, )\n}'
    // cursor right after the comma (line 2, char 9): `  add(1, |)`
    const { result, client } = await signatureHelp(text, { line: 2, character: 9 })
    expect(result).not.toBeNull()
    expect(result!.signatures[0]!.label).toBe('int add(int a, int b)')
    expect(result!.signatures[0]!.parameters.map((p) => p.label)).toEqual(['int a', 'int b'])
    expect(result!.activeParameter).toBe(1)
    client.dispose()
  })

  it('publishes diagnostics from pushed cc65 build output', async () => {
    const main = { uri: 'file:///proj/main.c', text: 'void main(void) {\n  undefined_fn();\n}' }
    const { published, client } = await pushBuildOutput(
      [main],
      'main.c:2:3: error: call to undefined function `undefined_fn`',
    )
    const forMain = published.find((p) => p.uri === main.uri)
    expect(forMain).toBeDefined()
    expect(forMain!.diagnostics).toHaveLength(1)
    const d = forMain!.diagnostics[0]!
    expect(d.severity).toBe(1) // DiagnosticSeverity.Error
    expect(d.source).toBe('cc65')
    expect(d.message).toContain('undefined_fn')
    expect(d.range.start).toEqual({ line: 1, character: 2 })
    client.dispose()
  })

  it('clears diagnostics when a later build no longer reports the file', async () => {
    const main = { uri: 'file:///proj/main.c', text: 'void main(void) {}' }
    const c2s = new PassThrough()
    const s2c = new PassThrough()
    startServer(createConnection(new StreamMessageReader(c2s), new StreamMessageWriter(s2c)))
    const client = createMessageConnection(
      new StreamMessageReader(s2c),
      new StreamMessageWriter(c2s),
    )
    client.listen()
    const published: PublishParams[] = []
    client.onNotification('textDocument/publishDiagnostics', (p: PublishParams) => {
      published.push(p)
    })
    await client.sendRequest('initialize', {
      processId: null,
      rootUri: null,
      capabilities: {},
      initializationOptions: {},
    })
    await client.sendNotification('initialized', {})
    await client.sendNotification('textDocument/didOpen', {
      textDocument: { uri: main.uri, languageId: 'c', version: 1, text: main.text },
    })
    await client.sendNotification('cc65/buildOutput', {
      output: 'main.c:1:1: error: boom',
    })
    await client.sendNotification('cc65/buildOutput', { output: '' })
    await new Promise((r) => setTimeout(r, 50))
    const last = published.filter((p) => p.uri === main.uri).at(-1)
    expect(last?.diagnostics).toEqual([])
    client.dispose()
  })
})
