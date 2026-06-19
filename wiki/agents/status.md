# Status

Snapshot of what works. Update when behaviour changes.

## Shipped (0.4.x, on npm)

- **Engine** (`@cc65-intel/core`):
  - parse via `@lezer/cpp`; type table (struct/union/typedef/**enum** → fields,
    with each field's type) + typedef **alias** table; symbol table (functions
    with signatures, `#define` macros, globals, **enum constants**).
  - cc65 dialect: calling-convention decorators (`__fastcall__`/`__cdecl__`)
    stripped before parsing so the stdlib indexes; register macros
    (`#define VIC (*(struct __vic2*)…)`) indexed as typed globals.
  - `completeAt`: member completion over a full access chain (`a.b.c`,
    `arr[0].x`, `p->q`, register `VIC.`), resolved from the live buffer + index
    (typedef aliases followed); identifier completion (symbols + types) by prefix.
  - `hoverAt`: field / symbol / type / enum info as markdown.
- **LSP** (`@cc65-intel/lsp`):
  - `startServer` + browser worker entry; `completionProvider` (trigger `.`/`>`)
    with auto-`#include` `additionalTextEdits`; `hoverProvider`;
    `definitionProvider` (cross-file + into sysroot headers); Full document
    sync; `sysrootHeaders` indexed from init options (stdlib + registers).
  - **Diagnostics** (#6): the host pushes raw cc65/ca65/ld65 build output via the
    `cc65/buildOutput` notification (`{ output: string }`); the server parses it
    (pure `parseBuildOutput` in core) and emits standard
    `textDocument/publishDiagnostics`, clearing files a later build no longer
    reports. Browser-friendly (no compiler in the worker).
- **Consumed by madside** in its C editor behind `VITE_MADSIDE_CC65_LSP=1`.
  Parity (stdlib completion + auto-include + hover) is shipped engine-side; the
  default-on flip is wired on the madside side (madside #63).

## Resolver accuracy (#11)

Resolves: nested chains `a.b.c`; typedef-of-pointer (`typedef struct S *SP`) and
plain typedef aliases; array element access (`arr[0].`); const/volatile-qualified
and pointer field chains; multiple declarators per declaration (`struct Foo a, b;`);
enum constants (completion + hover).

Documented misses (lezer/dialect limits, tracked for later):

- **Function-call results** — `getThing().field` (no return-type resolution).
- **Casts / compound literals** — `((struct Foo*)p)->`, `(Foo){…}.`.
- **Macros expanding to a type** — only the register-cast `#define` form is
  understood; arbitrary type-producing macros are not.
- **Subscript is treated as identity** — `arr[i].` assumes `arr`'s element type;
  a wrong-arity or pointer-arithmetic base may mis-resolve.
- **lezer error nodes** — cc65-only constructs that degrade to error nodes
  locally can hide a declaration from the index.

## Not yet (open issues)

- **Awesome extras**: signature help, references / rename / document symbols,
  semantic tokens.
- **Transports**: node stdio; VS Code extension.
- **Quality**: completion-quality harness (#4).

See `gh issue list` + [working-on-issues.md](working-on-issues.md).
