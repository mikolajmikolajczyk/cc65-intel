# The madside contract

**Read this before adding any feature.** madside is the first consumer and the
proving ground. A feature is "done" when it works in madside; other hosts come
second. This doc is the precise contract between cc65-intel and madside so an
agent can implement a feature that madside can actually use.

## How madside consumes the LSP

madside (the in-browser IDE, AGPL, separate repo) wires the LSP into its
CodeMirror C editor:

```
madside src/ui/codemirror/lsp/cc65-lsp.worker.ts   →  import '@cc65-intel/lsp/browser'
madside src/ui/codemirror/lsp/client.ts            →  vscode-jsonrpc over the worker
                                                       + a CodeMirror completion source
madside src/ui/components/editor/Editor.tsx (~L246) →  the C-file branch wires the source,
                                                       behind flag VITE_MADSIDE_CC65_LSP=1
```

- Transport: a **Web Worker** running `@cc65-intel/lsp/browser`, JSON-RPC over the
  worker message port (`vscode-jsonrpc/browser` on the host side). No WebSocket.
- madside depends on `@cc65-intel/core` + `@cc65-intel/lsp` as **npm packages**
  (semver). Changes ship via a new npm release (`just release`), then madside
  bumps the dependency. Never assume a local path.
- The feature is currently **flag-gated and OFF by default**. The flip to
  default-on is gated on **parity** (below).

## What madside sends the server

- **`initialize`** with `initializationOptions: { sysrootHeaders?: SourceFile[] }`
  — the cc65 sysroot headers for the active target (e.g. `<c64.h>`, `<_vic2.h>`,
  `<conio.h>`). madside has these in its VFS (a mounted zip) and will feed them
  so the engine can index the cc65 stdlib + hardware register structs. **A
  feature that needs the sysroot must read it from here, not invent its own
  fetch.** (As of 0.1.0 madside does not yet send these — wiring them is part of
  the stdlib/registers issues; design the server to accept them now.)
- **`textDocument/didOpen` / `didChange`** — the active buffer's full text (sync
  kind is **Full**). The server reindexes on change.
- **`textDocument/completion`** at a position (line/character).
- Future: `hover`, `signatureHelp`, `definition`, etc. — only after the server
  advertises the capability.

## What the server must return (shape madside renders)

madside maps LSP results to CodeMirror. Keep results in standard LSP shapes:

- **Completion** → `CompletionItem[]` (or `{ items }`). madside reads:
  - `label` — inserted text.
  - `kind` — CompletionItemKind; madside maps Field→property, Function→function,
    Constant→constant (macros), Variable→variable, Struct→type. Use these kinds.
  - `detail` — one-line shown next to the label (e.g. a field's type, a
    function signature). Always set it where useful.
  - `additionalTextEdits` — **this is how auto-`#include` works.** When a
    completion comes from a header the buffer doesn't include yet, return an
    `additionalTextEdit` that inserts `#include <header>\n` at the top. madside's
    editor applies these on accept. (cLibrary does this today; the LSP must match
    it — see parity.)
- **Hover** → `Hover { contents }` (markdown ok).
- **Diagnostics** → see the diagnostics issue; madside already has its own cc65
  build diagnostics (#61 there), so LSP diagnostics are additive/optional.

Positions: the engine works in **character offsets**; the LSP layer converts
to/from LSP line/character (`TextDocument.offsetAt`/`positionAt`). Never put
line/column into core.

## Parity: what's needed to flip madside to default-ON

Today madside's non-LSP path (`cLibrary`) gives, for C files:

1. **cc65 stdlib completion** — `conio`/`stdlib` functions (e.g. `cputs`,
   `clrscr`) with the declaring header, sourced from the toolchain.
2. **auto-`#include`** — accepting a stdlib symbol inserts its `#include`.
3. **project symbol completion** — every `.c`/`.h` symbol across the project.
4. **buffer identifiers**.
5. **hover** for stdlib symbols.

The LSP **replaces** cLibrary when the flag is on (it's an `override` completion
source). So flipping default-ON **without regressing** requires the LSP to cover
1–5. Current 0.1.0 LSP covers 3 (project symbols) + member completion (new), but
**not** 1, 2, 5. Therefore the parity work is:

- **stdlib completion**: index the cc65 sysroot headers (sent via
  `initializationOptions.sysrootHeaders`) → their functions/macros become
  completions, each carrying its header.
- **auto-`#include`**: emit `additionalTextEdits` for symbols whose header isn't
  already included in the buffer.
- **hover**: `hoverAt` + the LSP hover handler.

Until parity, the flag stays OFF and the default-on flip is **out of scope** for
cc65-intel (it's tracked in madside #63). An alternative madside may choose is to
**run both sources** (LSP for member completion + cLibrary for stdlib) — but the
clean win is LSP parity.

## "Awesome" beyond parity (what madside wants next)

In rough priority for madside value:

1. **cc65 hardware register structs** — `VIC.bordercolor`, `SID`, `CIA1` complete.
   These live in sysroot headers behind a macro (`#define VIC (*(struct __vic2*)0xd000)`).
2. **hover** with type/signature/header.
3. **signature help** — `f(` shows parameters.
4. **diagnostics** from cc65 output.
5. **go-to-definition**, **find-references**, **rename**, **document symbols**.
6. **semantic tokens** (richer highlighting than lang-cpp's lexer).

Each is an issue; each must (a) work over the worker transport madside uses,
(b) return standard LSP shapes, (c) read the sysroot from `initializationOptions`
when needed, (d) have a protocol-roundtrip test (see [testing.md](testing.md)).

## Compatibility rules (madside first, others second)

- **Don't break the engine purity boundary** (no editor/LSP/DOM in core) — it's
  what lets madside run core in a worker and what lets VS Code reuse it.
- **Standard LSP only** — no madside-specific RPC. If madside needs something
  bespoke (e.g. receiving its own diagnostics), model it as a standard LSP
  notification or a documented custom method, never a hard dependency.
- **Browser-first**: every server feature must work in the Web Worker transport
  (no node-only APIs in the request path). node stdio is a second transport.
- **Semver discipline**: madside pins a version. Additive changes = minor;
  breaking the engine API or LSP capabilities = major + a heads-up in the
  changelog.
