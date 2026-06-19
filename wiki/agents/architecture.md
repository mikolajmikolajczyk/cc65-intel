# Architecture

cc65-intel is C-language intelligence for the **cc65** 6502 C toolchain
(Atari 8-bit, C64, NES, Apple II, …), built so editors get real completion /
hover / diagnostics without a full clang frontend.

## Two packages

```
packages/core   @cc65-intel/core   PURE engine — parse + resolve + complete/hover
packages/lsp    @cc65-intel/lsp     thin LSP server over core (worker + node stdio)
```

- **core** is the brain: pure functions, data in / data out. No CodeMirror, no
  LSP, no DOM, no Node APIs. It must run unchanged in a browser worker and in
  node. This purity is the product — see [conventions](conventions.md) and
  ADR-0001.
- **lsp** is glue: it maps the [LSP protocol](lsp.md) onto core. Per-host
  transports (browser Web Worker, node stdio) share one `startServer(connection)`.

## Data flow (completion)

```
host editor ──(LSP didOpen/didChange + completion)──▶ @cc65-intel/lsp
                                                          │
                                  indexC(open docs + sysroot headers) → CIndex
                                                          │
                              completeAt(index, text, offset) → CompletionItem[]
                                                          │
host editor ◀──(LSP CompletionItem[])──────────────────────┘
```

- The **index** (`indexC`) is cross-file: it scans every open `.c`/`.h` doc plus
  the cc65 sysroot headers the host supplies, building a **type table**
  (struct/union/typedef → fields) and a **symbol table** (functions, macros,
  globals). It is rebuilt on document change (cheap — cc65 projects are small).
- **Member resolution** (`completeAt` on `.`/`->`) reads the _live buffer_, not
  the index: it finds the nearest declaration of the left-hand variable before
  the cursor (so locals, params, and unsaved edits resolve), takes its type, and
  lists that type's fields from the index.

## Parse, not regex

The parse layer is [`@lezer/cpp`](https://github.com/lezer-parser/cpp) — a real
C/C++ grammar producing a syntax tree. We extract declarations by walking the
tree (`packages/core/src/index-c.ts`, helpers in `ast.ts`), never by regex. cc65
dialect constructs degrade to local error nodes without breaking the surrounding
parse. We do **not** use clang/clangd: too heavy, and it fights the cc65 dialect
(custom headers, `__fastcall__`, 16-bit `int`). See ADR-0002.

## Source map

| Concern                         | File                                     |
| ------------------------------- | ---------------------------------------- |
| Public engine API + types       | `packages/core/src/index.ts`, `types.ts` |
| Parse (lezer wrapper)           | `packages/core/src/parse.ts`             |
| Index (types + symbols)         | `packages/core/src/index-c.ts`           |
| Shared AST helpers              | `packages/core/src/ast.ts`               |
| Completion                      | `packages/core/src/complete.ts`          |
| Hover                           | `packages/core/src/hover.ts`             |
| LSP server (transport-agnostic) | `packages/lsp/src/server.ts`             |
| Browser worker entry            | `packages/lsp/src/browser.ts`            |
| ADRs                            | `docs/adr/`                              |

## Who consumes it

**First consumer + proving ground: [madside](https://github.com/mikolajmikolajczyk/madside)**,
the in-browser IDE — it runs the LSP in a Web Worker. Every feature must work
for madside first; other hosts (VS Code, Neovim) second. The exact madside
integration contract is [madside-contract.md](madside-contract.md) — **read it
before adding any feature**.
