import { parser } from '@lezer/cpp'
import type { Tree } from '@lezer/common'

// The parse layer. @lezer/cpp is a real C/C++ grammar (the parser behind
// CodeMirror's lang-cpp) — a pure, dependency-light tree producer, NOT an
// editor. cc65 is close enough to C that the declarations we care about
// (structs, typedefs, variable declarations) parse cleanly; dialect-only
// constructs degrade to error nodes locally without breaking the surrounding
// tree. We build the cc65-aware index on top of this tree (no regex).

/** Parse C source into a Lezer syntax tree. */
export function parseC(text: string): Tree {
  return parser.parse(text)
}
