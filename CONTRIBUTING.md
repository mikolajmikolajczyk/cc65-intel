# Contributing to cc65-intel

Thanks for your interest! This is an early-stage project — see the
[issues](https://github.com/mikolajmikolajczyk/cc65-intel/issues) and
[milestones](https://github.com/mikolajmikolajczyk/cc65-intel/milestones) for
the roadmap.

## Setup

Easiest — the Nix flake gives you node/pnpm/just/pre-commit and **installs the
git hooks for you** (so commits run the same gate as CI and don't land red):

```sh
nix develop          # or `direnv allow` (auto-loads via .envrc)
pnpm install
just check           # lint + format + typecheck + madge + build + test
```

Without Nix:

```sh
pnpm install         # `prepare` best-effort-installs the pre-commit hooks
pre-commit install   # if you have pre-commit but the above didn't run it
just check
```

Requires Node ≥ 22 (see `.nvmrc`) and pnpm. **Install the pre-commit hooks** —
they run lint/format/types/madge locally so you don't push CI-breaking commits.

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
the gate in CI and **publishes the packages to npm** (`@cc65-intel/*`, public)
via **OIDC trusted publishing** — no token, provenance automatic.

**First publish (one-time bootstrap).** Trusted publishing can only be
configured after a package exists, so the very first release is published
locally:

```sh
npm login
just release 0.1.0          # bump + changelog + signed tag + push + gh release
pnpm -r publish --access public   # publish 0.1.0 from your logged-in session
```

Then, on npmjs.com, add a **Trusted Publisher** to each package
(`@cc65-intel/core`, `@cc65-intel/lsp`) → GitHub Actions →
`mikolajmikolajczyk/cc65-intel`, workflow `release.yml`. From the next release
on, `just release X.Y.Z` is enough — CI publishes via OIDC.

## Licence

By contributing you agree your contributions are licensed under the **MIT**
licence (see [`LICENSE`](LICENSE)).
