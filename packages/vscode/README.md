# cc65-intel — VS Code extension

Minimal VS Code extension that launches the [`@cc65-intel/lsp`](../lsp) language
server (node stdio) for cc65 C projects, giving member/stdlib completion, hover,
go-to-definition, signature help, document symbols, find-references, rename,
semantic tokens, and cc65 build diagnostics.

It is the ecosystem proof (issue #8) — the same `startServer` the browser worker
runs, reached over stdio via `vscode-languageclient`.

## How it works

- On activating a C file, the extension forks `@cc65-intel/lsp/node` (the
  `cc65-lsp` stdio server) and connects with `vscode-languageclient`.
- The cc65 sysroot is read from the `cc65.sysrootDir` setting: every `*.h` in
  that directory is sent as `initializationOptions.sysrootHeaders`, so the cc65
  stdlib and register structs (`VIC.bordercolor`, …) resolve.

## Settings

| Setting           | Type     | Description                                                       |
| ----------------- | -------- | ----------------------------------------------------------------- |
| `cc65.sysrootDir` | `string` | Directory of cc65 sysroot headers (`*.h`) to index. Empty = none. |

## Status

Not published to the Marketplace (packaging is a stretch goal). Run from source:
`pnpm -C packages/vscode build`, then launch an Extension Development Host
pointing at this folder.
