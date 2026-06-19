# ADR-0002 — Parse with Lezer + a heuristic resolver, not clangd

**Status:** accepted

## Context

C member completion (`var.field`, `ptr->field`, cc65 register structs like
`VIC.bordercolor`) needs more than regex but does not require a full C frontend.
Two extremes:

- **Regex** — fragile, no type awareness, breaks on comments/strings/nesting.
- **clangd / libclang (in wasm)** — accurate, but tens of MB, needs the full
  include graph + compile flags, and **fights the cc65 dialect**: cc65 is not
  ISO C (custom headers, `__fastcall__`, 16-bit `int`, non-standard pragmas), so
  a stock clang frontend mis-parses or errors on real cc65 sources.

## Decision

Sit in the middle:

- **Parse** with [`@lezer/cpp`](https://github.com/lezer-parser/cpp) — a real,
  dependency-light C/C++ grammar (the parser behind CodeMirror's lang-cpp). It
  produces an accurate syntax tree; cc65 dialect constructs degrade to local
  error nodes without breaking the surrounding parse.
- **Resolve** with a small, **cc65-aware** layer of our own: build a type table
  (struct/union/typedef → fields) and a `var → type` table from the tree, then
  answer `.`/`->` by resolving the left-hand expression's type to its fields.

## Consequences

- Robust extraction without clang's weight or dialect friction.
- ~80% of the real value (project structs + cc65 registers) is reachable;
  documented misses (deeply nested chains, typedef-of-pointer, macro-defined
  types, casts) are addressed incrementally and individually tested.
- The resolver is ours, but it's small and sits on a solid tree — and being
  cc65-aware is an advantage clangd can't match.
- If a second host needs an LSP, we wrap this engine in our own lightweight,
  cc65-aware server (ADR-0001) rather than shipping clangd.
