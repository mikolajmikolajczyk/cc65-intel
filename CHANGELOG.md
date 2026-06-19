## [0.2.0] - 2026-06-19

### 🚀 Features

- *(core,lsp)* Cc65 stdlib completion — tag header-sourced symbols
- *(lsp)* Auto-#include accepted stdlib completions
- *(core,lsp)* HoverAt — type / field / symbol info

### 📚 Documentation

- Agent-facing wiki + AGENTS guide for autonomous feature work

### 🎨 Styling

- Fix prettier formatting in CLAUDE.md and repoctx SKILL.md

### ⚙️ Miscellaneous Tasks

- Added repoctx guidance
- Nix dev shell + auto-installed pre-commit hooks
- Add flake.lock; normalize CHANGELOG trailing newline
- Exclude .direnv copy from vitest discovery
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
