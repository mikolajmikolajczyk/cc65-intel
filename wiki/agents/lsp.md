# The LSP server

`@cc65-intel/lsp` wraps the engine in the Language Server Protocol. One
transport-agnostic `startServer(connection)` (`packages/lsp/src/server.ts`); each
host supplies a connection.

## Transports

- **Browser Web Worker** — `packages/lsp/src/browser.ts` (`@cc65-intel/lsp/browser`).
  `BrowserMessageReader/Writer(self)` + `createConnection`. **This is the
  transport madside uses; it must always work.**
- **node stdio** — `packages/lsp/src/node.ts` (`@cc65-intel/lsp/node`), for
  VS Code / Neovim. `createConnection(ProposedFeatures.all)` reads `--stdio` from
  argv; shipped as the `cc65-lsp` bin (`cc65-lsp --stdio`). Shares the same
  `startServer` — no node-only logic on the request path.

> **ESM gotcha:** the node entry runs under node's own ESM loader (not a
> bundler), so every relative import in `core` carries an explicit `.js`
> extension and `vscode-languageserver/node.js` is imported with the extension —
> `moduleResolution: bundler` accepts the `.js` while node requires it. Keep new
> relative imports `.js`-suffixed or the published bin breaks.

## Capabilities (advertised in `onInitialize`)

| Capability               | Status   | Notes                               |
| ------------------------ | -------- | ----------------------------------- |
| `textDocumentSync`       | **Full** | host sends whole buffer on change   |
| `completionProvider`     | **done** | trigger chars `.` and `>`           |
| `hoverProvider`          | **done** | markdown field/symbol/type/enum     |
| `definitionProvider`     | **done** | cross-file + into sysroot headers   |
| `signatureHelpProvider`  | **done** | trigger `(` `,`; active param       |
| `documentSymbolProvider` | **done** | top-level outline + ranges          |
| `referencesProvider`     | **done** | name-based, across open docs        |
| `renameProvider`         | **done** | prepare + cross-file WorkspaceEdit  |
| `semanticTokensProvider` | **done** | full; type/fn/macro/param/field/var |

When you add a capability: advertise it in `onInitialize`, add the handler, map
engine output → LSP types, and write a [protocol-roundtrip test](testing.md).

### Diagnostics (two streams, merged per URI)

`publishDiagnostics` replaces a document's whole list, so the server **merges**
two sources into each publish; a host tells them apart by `source`:

- **Semantic** (`source: cc65-intel`, #29) — engine-computed by `diagnoseC(index,
text)`, recomputed on every `didOpen`/`didChange`, no build needed. High-confidence
  checks only (bad member access on a resolved struct/union; unknown struct tag
  used by value) — it stays silent when it can't resolve, to avoid false positives.
- **Build-output** (`source: cc65`, #6) — the host pushes raw cc65/ca65/ld65 stderr
  via the custom `cc65/buildOutput` notification (`{ output: string }`); pure
  `parseBuildOutput` (in core) handles gcc-style `file:line:col: error: msg` and
  cc65-native `file(line): Error: msg`. The server maps each path to an open
  document's URI (suffix match; else a `file://` fallback) and clears files a later
  build no longer mentions.

`cc65/buildOutput` is the one inbound custom notification; everything the server
emits is standard LSP, so non-madside hosts work unchanged.

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
