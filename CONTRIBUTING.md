# Contributing to cc65-intel

Thanks for your interest! This is an early-stage project — see the
[issues](https://github.com/mikolajmikolajczyk/cc65-intel/issues) and
[milestones](https://github.com/mikolajmikolajczyk/cc65-intel/milestones) for
the roadmap.

## Setup

```sh
pnpm install
pre-commit install     # optional: run the CI checks on every commit
just check             # lint + format + typecheck + madge + build + test
```

Requires Node ≥ 22 (see `.nvmrc`) and pnpm.

## Project layout

Two packages (see [`AGENTS.md`](AGENTS.md) and [`docs/adr/`](docs/adr/)):

- **`@cc65-intel/core`** — the pure engine. **No editor / LSP / DOM
  dependencies** — this is enforced by ESLint and is the whole point: the
  engine must be reusable by any host.
- **`@cc65-intel/lsp`** — a thin LSP server over the engine.

## Pull requests

- Branch from `main`, open a PR. CI must pass (lint, format, types, madge,
  build, test).
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`, …) — the
  changelog is generated from them.
- Keep changes scoped to one issue. Don't break the core purity boundary.
- Add tests for engine behaviour (fixtures under each package's `test/`).

## Releases

Maintainer-only: `just release X.Y.Z` runs the gates, bumps every package
(lockstep), generates the changelog (git-cliff), creates a signed tag, pushes,
and publishes a GitHub release.

Pushing the `vX.Y.Z` tag triggers `.github/workflows/release.yml`, which re-runs
the gate in CI and **publishes the packages to npm** (`@cc65-intel/*`, public,
with provenance). Requires an `NPM_TOKEN` repository secret — an npm
**automation** token for the `cc65-intel` org.

## Licence

By contributing you agree your contributions are licensed under the **MIT**
licence (see [`LICENSE`](LICENSE)).
