# CLAUDE.md — cc65-intel

Claude-specific entry point. Canonical content lives in [`AGENTS.md`](AGENTS.md).

@AGENTS.md

## Claude-only notes

- **Commits:** Conventional Commits, **signed** (`-S`), straight to `main`
  (solo repo). **Never** add `Co-Authored-By: Claude`. Ask before committing.
- **Boundary first:** before touching `packages/core`, re-read the purity rule
  in AGENTS.md — no editor/LSP/DOM imports. `pnpm lint` enforces it.
- **Verify before done:** `just check` must be green (lint + types + madge +
  build + test) before claiming a task complete.
