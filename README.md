# cc65-intel

> ⚠️ **Early release (0.x).** APIs may change before 1.0.

[![npm](https://img.shields.io/npm/v/@cc65-intel/core)](https://www.npmjs.com/package/@cc65-intel/core)

C-language intelligence for the [**cc65**](https://cc65.github.io/) 6502 C
toolchain (Atari 8-bit, C64, NES, Apple II, …). A lightweight, dependency-free
parser+resolver engine and an LSP server — built because a stock C language
server (clangd/ccls) doesn't fit cc65's non-standard dialect and its custom
hardware headers (`<c64.h>`, `<_vic2.h>`, `__fastcall__`, 16-bit `int`).

## Why

Editors get either **regex completion** (fragile, no type awareness) or a
**full clang frontend** (tens of MB, fights the cc65 dialect). cc65-intel sits in
between: a real parse tree (via [`@lezer/cpp`](https://github.com/lezer-parser/cpp))
plus a small, cc65-aware resolver that knows `var.field` / `ptr->field` and the
cc65 register structs (`VIC.bordercolor`, `SID`, `CIA1`).

Runs in the **browser** (Web Worker) and on **node** (stdio) — the same engine
behind both.

## Layout

```
packages/core   @cc65-intel/core   pure engine: indexC / completeAt / hoverAt
                                    no LSP, no editor, no DOM — just data in/out
packages/lsp    @cc65-intel/lsp    thin LSP server over core (browser + node)
```

## Install

```sh
npm add @cc65-intel/core      # the engine
npm add @cc65-intel/lsp       # the LSP server (browser worker + node)
```

## Status

- [x] Workspace scaffold + public API surface
- [x] core: parse (lezer) → struct/field/decl extraction
- [x] core: resolver — `var → type`, `.`/`->` member completion (Tier 1)
- [x] lsp: completion (browser worker transport) + protocol roundtrip test
- [ ] core: hover
- [ ] core: cc65 sysroot register structs (Tier 2 — `VIC.bordercolor`)
- [ ] lsp: diagnostics (cc65 error output)
- [ ] node transport + VS Code extension

First consumer + proving ground: the [madside](https://github.com/mikolajmikolajczyk/madside)
in-browser IDE — member completion runs in the browser today (`g.` → struct fields).

## Licence

MIT — © Mikołaj Mikołajczyk. Permissive on purpose: lift the engine into any
editor or tool.
