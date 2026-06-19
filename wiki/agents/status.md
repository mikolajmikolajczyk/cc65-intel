# Status

Snapshot of what works. Update when behaviour changes.

## Shipped (0.1.0, on npm)

- **Engine** (`@cc65-intel/core`):
  - parse via `@lezer/cpp`; type table (struct/union/typedef → fields, with each
    field's type); symbol table (functions, `#define` macros, globals).
  - `completeAt`: member completion (`.`/`->`, resolved from the live buffer) +
    identifier completion (project symbols + types) by prefix.
  - `hoverAt`: stub (returns null).
- **LSP** (`@cc65-intel/lsp`):
  - `startServer` + browser worker entry; `completionProvider` (trigger `.`/`>`);
    Full document sync; `sysrootHeaders` accepted in init options (not yet used
    by the index for stdlib/registers).
- **Consumed by madside** in its C editor behind `VITE_MADSIDE_CC65_LSP=1`
  (default off). Proven in-browser: `g.` → struct fields.

## Not yet (open issues)

- **Parity with madside cLibrary** (needed to flip madside default-on):
  - cc65 stdlib completion (index sysroot headers → `conio`/`stdlib`).
  - auto-`#include` via `additionalTextEdits`.
  - hover.
- **Awesome extras**: cc65 register structs (`VIC.`), signature help,
  diagnostics, go-to-definition / references / rename / document symbols,
  semantic tokens.
- **Transports**: node stdio; VS Code extension.
- **Quality**: completion-quality harness; resolver accuracy (nested chains,
  typedef-of-pointer, arrays, enums).

See `gh issue list` + [working-on-issues.md](working-on-issues.md).
