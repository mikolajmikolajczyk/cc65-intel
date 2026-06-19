# AGENTS.md — cc65-intel

Repo guide for coding agents (and humans). C-language intelligence for the
**cc65** 6502 C toolchain: a pure analysis engine + a thin LSP server.

> **CLAUDE.md** is `@AGENTS.md` plus Claude-only notes. Other agents read this file.

## What this is

cc65-intel gives editors real C completion/hover/diagnostics for cc65 projects
(Atari 8-bit, C64, NES, …) **without** a full clang frontend. A stock C language
server (clangd) is tens of MB and fights cc65's non-standard dialect and custom
hardware headers. Instead: a real parse tree (`@lezer/cpp`) + a small,
cc65-aware resolver.

First consumer + proving ground: the [madside](https://github.com/mikolajmikolajczyk/madside)
in-browser IDE. Designed to also run as a node LSP (VS Code / Neovim).

## Architecture (the core rule)

```
packages/core   @cc65-intel/core   PURE engine: indexC / completeAt / hoverAt
                                    data in/out — NO editor, NO LSP, NO DOM
packages/lsp    @cc65-intel/lsp     thin LSP server over core (worker + stdio)
```

**The boundary is the product.** `core` must stay editor/LSP/DOM-free so any
host can reuse it. This is machine-enforced (`eslint-plugin-boundaries` +
`no-restricted-imports`): `core` may import only `core`; importing
`@codemirror/*`, `codemirror`, `vscode`, `vscode-languageserver*`, or
`@cc65-intel/lsp` from `core` fails lint. Positions in the engine are **offsets**
— line/column conversion belongs to the LSP/editor layer, not the engine. See
[ADR-0001](docs/adr/0001-two-package-architecture.md), [ADR-0002](docs/adr/0002-lezer-not-clangd.md).

## Where things live

| Need                           | Path                                        |
| ------------------------------ | ------------------------------------------- |
| Roadmap / milestones / backlog | GitHub issues — `gh issue list`             |
| Engine public API              | `packages/core/src/index.ts`                |
| Type/field extraction          | `packages/core/src/index-c.ts`              |
| Parse layer (Lezer wrapper)    | `packages/core/src/parse.ts`                |
| Completion / hover             | `packages/core/src/complete.ts`, `hover.ts` |
| LSP server                     | `packages/lsp/src/`                         |
| Architecture decisions         | `docs/adr/`                                 |

## Commands

```sh
just check        # the full gate: lint + format + types + madge + build + test
pnpm test         # vitest
pnpm lint         # eslint (type-aware + boundaries)
pnpm typecheck    # tsc -b + tsc -p tsconfig.eslint.json --noEmit
pnpm madge:circular
just release X.Y.Z
```

## Conventions

- **TypeScript strict** (typescript-eslint strict-type-checked). ESM, `verbatimModuleSyntax`.
- **Conventional Commits** — the changelog (`cliff.toml`) is generated from them.
- **Commits are signed**; `pre-commit` runs the same checks as CI (activate with `pre-commit install`).
- **Never break the core purity boundary.** If the engine seems to need an
  editor/LSP type, the design is wrong — keep core on plain data.
- Tests colocated under each package's `test/`, type-aware-linted via `tsconfig.eslint.json`.

## Hard rules

- Don't add a dependency to `core` beyond pure parsing/data libs.
- Don't commit without explicit request.
- Don't pre-empt later milestones — match the issue's scope.
