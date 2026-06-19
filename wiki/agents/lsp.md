# The LSP server

`@cc65-intel/lsp` wraps the engine in the Language Server Protocol. One
transport-agnostic `startServer(connection)` (`packages/lsp/src/server.ts`); each
host supplies a connection.

## Transports

- **Browser Web Worker** — `packages/lsp/src/browser.ts` (`@cc65-intel/lsp/browser`).
  `BrowserMessageReader/Writer(self)` + `createConnection`. **This is the
  transport madside uses; it must always work.**
- **node stdio** — planned (`@cc65-intel/lsp/node`), for VS Code / Neovim. Shares
  the same `startServer`.

## Capabilities (advertised in `onInitialize`)

| Capability               | Status   | Notes                             |
| ------------------------ | -------- | --------------------------------- |
| `textDocumentSync`       | **Full** | host sends whole buffer on change |
| `completionProvider`     | **done** | trigger chars `.` and `>`         |
| `hoverProvider`          | **done** | markdown field/symbol/type/enum   |
| `definitionProvider`     | **done** | cross-file + into sysroot headers |
| `signatureHelpProvider`  | TODO     | trigger `(` `,`                   |
| `referencesProvider`     | TODO     |                                   |
| `renameProvider`         | TODO     |                                   |
| `documentSymbolProvider` | TODO     |                                   |
| `semanticTokensProvider` | TODO     |                                   |

When you add a capability: advertise it in `onInitialize`, add the handler, map
engine output → LSP types, and write a [protocol-roundtrip test](testing.md).

### Diagnostics (push model)

The browser worker has no compiler, so diagnostics flow the other way: the host
pushes raw build output, the server parses + republishes it as standard LSP.

- **Inbound** — custom notification `cc65/buildOutput`, param `{ output: string }`:
  the host sends raw cc65/ca65/ld65 stderr (gcc-style `file:line:col: error: msg`
  and cc65-native `file(line): Error: msg` are both understood).
- **Parsing** — pure `parseBuildOutput` lives in `@cc65-intel/core`, so any host
  reuses it without the LSP.
- **Outbound** — the server maps each diagnostic's toolchain path to an open
  document's URI (suffix match; else a `file://` fallback) and emits standard
  `textDocument/publishDiagnostics`, clearing files a later build no longer
  mentions. `cc65/buildOutput` is the one inbound custom notification; everything
  the server emits is standard LSP, so non-madside hosts work unchanged.

## Server responsibilities

- Keep a `TextDocuments` manager; reindex (`indexC`) on `didOpen`/`didChange`/
  `didClose`. cc65 projects are small — full reindex is fine.
- Store `sysrootHeaders` from `initializationOptions` and pass them into `indexC`
  (see [madside-contract](madside-contract.md)).
- Convert LSP position ↔ engine offset at the boundary (`doc.offsetAt` /
  `positionAt`). The engine never sees line/column.
- Map engine `CSymbolKind` → `CompletionItemKind` (see `server.ts` `KIND` map);
  set `detail`; emit `additionalTextEdits` for auto-`#include`.

## Initialize options

```ts
interface InitOptions {
  sysrootHeaders?: { path: string; text: string }[] // cc65 headers (conio.h, _vic2.h, …)
}
```

The host (madside) supplies these so the engine can index the cc65 stdlib +
register structs. Design new features to read the sysroot from here.

## What NOT to do

- No node-only APIs on the request path (must run in the browser worker).
- No bespoke madside RPC — standard LSP methods only.
- Don't move logic into the server that belongs in the engine. The server is a
  thin adapter; resolution/analysis lives in `@cc65-intel/core`.
