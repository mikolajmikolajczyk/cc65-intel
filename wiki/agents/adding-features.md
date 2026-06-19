# Adding a feature

The shape of almost every cc65-intel feature is the same: **extend the engine,
expose it through the LSP, prove it with a roundtrip test, keep madside able to
use it.**

## Recipe

1. **Read** [madside-contract.md](madside-contract.md) — confirm what shape the
   result must take and whether it needs the sysroot.
2. **Engine first** (`packages/core`):
   - Need new data from the source? Extend `indexC` (walk the lezer tree — learn
     node names by parsing a snippet and dumping the cursor; see `index-c.ts`).
   - New query? Add a pure function (e.g. alongside `completeAt`/`hoverAt`),
     export it from `packages/core/src/index.ts`, type it in `types.ts`.
   - Keep it editor/LSP-free (positions = offsets). Add unit tests.
3. **LSP** (`packages/lsp`):
   - Advertise the capability in `onInitialize` (`server.ts`).
   - Add the handler; convert position ↔ offset; map engine output → LSP types.
   - Read `sysrootHeaders` from init options if the feature needs cc65 headers.
   - Add a [protocol-roundtrip test](testing.md).
4. **Verify**: `just check` green. Reproduce CI cleanly if unsure.
5. **Release** so madside can consume it: `just release X.Y.Z` (minor for
   additive). Note the new capability in the changelog. If madside needs to send
   something new (e.g. sysroot headers), say so in the issue / PR so the madside
   side gets wired.

## Learning the lezer tree

```js
import { parser } from '@lezer/cpp'
const tree = parser.parse('struct Foo { int x; };')
const c = tree.cursor()
do {
  console.log(c.name, JSON.stringify(src.slice(c.from, c.to)))
} while (c.next())
```

Known node names already used: `StructSpecifier`, `UnionSpecifier`,
`FieldDeclarationList`, `FieldDeclaration`, `FieldIdentifier`, `TypeDefinition`,
`TypeIdentifier`, `Declaration`, `ParameterDeclaration`, `FunctionDeclarator`,
`PointerDeclarator`, `Identifier`, `PrimitiveType`, `SizedTypeSpecifier`,
`PreprocDirective` (+ child `#define`).

## Anti-patterns

- Putting resolution logic in the LSP server (it belongs in core).
- Inventing a fetch/IO path in the engine (the host supplies sysroot via init
  options).
- A madside-specific RPC instead of a standard LSP method.
- Shipping a capability without a protocol-roundtrip test.
