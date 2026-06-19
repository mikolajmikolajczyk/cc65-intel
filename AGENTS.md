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

## Agent guide (read these for your task)

The `wiki/agents/` docs are sized to be read one at a time. **Pick the one that
matches your task** — don't read them all up front.

| Your task                                     | Read                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Get oriented                                  | [wiki/agents/architecture.md](wiki/agents/architecture.md)                                                                               |
| **Anything user-facing** (completion/hover/…) | [wiki/agents/madside-contract.md](wiki/agents/madside-contract.md) — the spec for what madside needs + what shape to return. **Always.** |
| Add a feature                                 | [wiki/agents/adding-features.md](wiki/agents/adding-features.md)                                                                         |
| LSP capabilities / transports                 | [wiki/agents/lsp.md](wiki/agents/lsp.md)                                                                                                 |
| Write tests                                   | [wiki/agents/testing.md](wiki/agents/testing.md)                                                                                         |
| Code style / tooling / gotchas                | [wiki/agents/conventions.md](wiki/agents/conventions.md)                                                                                 |
| Pick up / hand off an issue                   | [wiki/agents/working-on-issues.md](wiki/agents/working-on-issues.md)                                                                     |
| What works today                              | [wiki/agents/status.md](wiki/agents/status.md)                                                                                           |

The roadmap is GitHub issues (`gh issue list`) — each is self-contained
(context, scope, steps, acceptance, tests, madside-compat, deps).

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

- **Never break the core purity boundary** — no editor/LSP/DOM/Node deps in
  `@cc65-intel/core`. `pnpm lint` enforces it; if it seems necessary, the design
  is wrong.
- Don't add a dependency to `core` beyond pure parsing/data libs.
- **Stay in the issue's scope** — one capability per issue, no unrelated
  refactors, don't pre-empt other milestones.
- **`just check` must be green** before you call an issue done (lint + format +
  types + madge + build + test).
- **Standard LSP only** — no madside-specific RPC. Browser-worker transport must
  always work (no node-only APIs on the request path).
- Every user-facing LSP capability ships with a protocol-roundtrip test.

## Agent autonomy

Unlike a typical "ask before committing" repo, this one is set up for agents to
**own an issue end-to-end**: implement (engine → LSP → tests), get `just check`
green, **commit** (Conventional Commits, signed, `Closes #<n>`), straight to
`main`. Cut a release (`just release X.Y.Z`) when madside needs the change. Leave
an issue comment if you pause mid-task. Never add a `Co-Authored-By` trailer.
