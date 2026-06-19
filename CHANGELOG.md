## [0.1.0] - 2026-06-19

### 🚀 Features

- Scaffold cc65-intel — workspace + core engine (type extraction)
- *(core)* Symbol index + completeAt (member + identifier completion)
- *(lsp)* Minimal LSP server over the engine (browser worker transport)
- *(lsp)* Full document sync (simpler host client)

### 🐛 Bug Fixes

- *(ci)* @types/node in lsp package + first-release changelog
- *(ci)* Resolve workspace packages to source for lint (no build needed)

### 📚 Documentation

- AGENTS/CLAUDE guide, CONTRIBUTING, ADRs, issue/PR templates

### 🧪 Testing

- *(lsp)* End-to-end protocol roundtrip (struct field completion)

### ⚙️ Miscellaneous Tasks

- Type-aware eslint (+ boundaries) + prettier + editorconfig
- Pre-commit hooks, madge cycle guard, full CI pipeline
- Release flow — git-cliff changelog + signed release recipe
- Auto-publish to npm on tag (release workflow)
- Switch release to npm OIDC trusted publishing (no token)
# Changelog

