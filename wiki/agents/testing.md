# Testing

Two kinds of test, both with `vitest` (`pnpm test`):

## 1. Engine unit tests (fixtures of real C)

Drive `indexC` / `completeAt` / `hoverAt` directly with C source strings; assert
the result. Cursor positions use a `|` marker convention (see
`packages/core/test/complete.test.ts`):

```ts
function at(fixture: string) {
  const offset = fixture.indexOf('|')
  return { text: fixture.replace('|', ''), offset }
}
const { text, offset } = at('struct Foo { int x; };\nstruct Foo g;\ng.|')
expect(completeAt(indexC([{ path: 'main.c', text }]), text, offset).map((i) => i.label)).toEqual([
  'x',
])
```

Use **real cc65 idioms** in fixtures (and, for sysroot features, snippets of the
actual cc65 headers). Favour precision: prove the case, document the misses.

## 2. LSP protocol-roundtrip tests

The contract madside relies on. Drive the server over an in-memory stream pair
with a JSON-RPC client — the same protocol the worker host speaks
(`packages/lsp/test/protocol.test.ts`):

```ts
const c2s = new PassThrough(),
  s2c = new PassThrough()
startServer(createConnection(new StreamMessageReader(c2s), new StreamMessageWriter(s2c)))
const client = createMessageConnection(new StreamMessageReader(s2c), new StreamMessageWriter(c2s))
client.listen()
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
const res = await client.sendRequest('textDocument/completion', { textDocument: { uri }, position })
```

**Every new LSP capability gets one of these.** It proves the method name, params,
and response shape match what a host (madside) will send/receive.

## Completion-quality harness (issue #4)

A fixtures-based harness over real cc65 headers + sample programs, asserting a
measurable pass-rate, so resolver changes don't silently regress. Build this
before scaling accuracy work.

## Before claiming done

`just check` must be green (lint + format + typecheck + madge + build + test).
Reproduce CI cleanly if anything is suspicious (see [conventions](conventions.md)
gotchas).
