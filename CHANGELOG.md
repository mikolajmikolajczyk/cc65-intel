## [0.6.0] - 2026-06-19

### 🚀 Features

- *(lsp)* Node stdio transport + cc65-lsp bin
- *(core,lsp)* Signature help with active parameter
- *(core,lsp)* Document symbols (file outline)
- *(core,lsp)* Find references across open documents
- *(core,lsp)* Rename symbol + semantic tokens
- *(vscode)* VS Code extension launching the stdio LSP

### 📚 Documentation

- Update status — M5 features, node stdio, harness shipped

### 🧪 Testing

- *(core)* Completion-quality harness over cc65 fixtures
## [0.5.0] - 2026-06-19

### 🚀 Features

- *(core,lsp)* Diagnostics from cc65 build output
## [0.4.0] - 2026-06-19

### 🚀 Features

- *(core,lsp)* Go-to-definition
## [0.3.0] - 2026-06-19

### 🚀 Features

- *(core)* Resolve cc65 register-struct macros (VIC/SID/CIA)
- *(core)* Resolver accuracy — chains, typedef-ptr, arrays, enums
## [0.2.1] - 2026-06-19

### 🐛 Bug Fixes

- *(core)* Index cc65 functions decorated with __fastcall__ / __cdecl__
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
