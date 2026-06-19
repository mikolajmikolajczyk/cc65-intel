# Conventions

## The one rule that matters most

**`@cc65-intel/core` stays editor/LSP/DOM/Node-free.** Pure functions over plain
data. No `@codemirror/*`, no `vscode-languageserver`, no `vscode`, no DOM, no
`node:*`. This is machine-enforced: `eslint-plugin-boundaries` (core may import
only core) + `no-restricted-imports` in `eslint.config.js`. If the engine seems
to need a host type, the design is wrong — return plain data and let the LSP/host
adapt it. Positions in core are **character offsets**; line/column lives in the
LSP layer.

## TypeScript

- Strict (`typescript-eslint` strict + stylistic _type-checked_). ESM,
  `verbatimModuleSyntax` (use `import type` for types).
- `noUncheckedIndexedAccess` is on — array/record access is `T | undefined`;
  handle it (no `!` outside tests; `_`-prefix intentionally-unused).
- Shared AST helpers go in `packages/core/src/ast.ts`; don't duplicate tree
  walking.

## Tooling (all gated in CI + `just check`)

```sh
just check        # lint + format + typecheck + madge + build + test (the gate)
pnpm test         # vitest
pnpm lint         # eslint (type-aware + boundaries)
pnpm typecheck    # tsc -b + tsc -p tsconfig.eslint.json --noEmit
pnpm madge:circular
```

- **Prettier** house style (no semicolons, single quotes, width 100). Run
  `pnpm format`.
- **pre-commit** mirrors CI (`pre-commit install`). Hooks: whitespace/eof,
  prettier, eslint, tsc, madge, a gpg-uid guard.
- **Commits are signed** (`-S`), **Conventional Commits** (`feat:`/`fix:`/
  `chore:`/`docs:`/`test:`), straight to `main` (solo repo). The changelog is
  generated from them (`cliff.toml`). **Never** add a `Co-Authored-By` trailer.
- Lint resolves cross-package imports to **source** (via `tsconfig.eslint.json`
  paths) so it runs without a prior build. Don't add a build dependency to lint.

## Testing

- Tests colocated under each package's `test/`. Engine behaviour gets unit tests
  (fixtures of real C); LSP features get a **protocol-roundtrip** test. See
  [testing.md](testing.md).
- A package's test that needs node types must declare `@types/node` in **that
  package** (pnpm strict isolation — a root devDep isn't visible to it).

## Releases

`just release X.Y.Z` (lockstep bump of both packages) → changelog → signed tag →
push → CI publishes to npm via OIDC trusted publishing. See [`CONTRIBUTING.md`](../../CONTRIBUTING.md).

## Gotchas (these have bitten — see them coming)

- **Reproduce CI cleanly**: `rm -rf node_modules **/node_modules **/dist **/*.tsbuildinfo && pnpm install --frozen-lockfile && just check`. Local hoisting hides strict-isolation + build-order bugs.
- **pnpm `minimumReleaseAge`** can refuse a freshly-published dep ("not in registry" despite it being public); it's whitelisted in `pnpm-workspace.yaml` `minimumReleaseAgeExclude`.
- **gpg** sometimes times out signing — retry the commit.
