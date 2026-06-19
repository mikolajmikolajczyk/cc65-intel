import type { SyntaxNode } from '@lezer/common'
import { parseC } from './parse'

// Shared Lezer-tree helpers used by the indexer, the completer, and hover.

export const slice = (text: string, n: SyntaxNode): string => text.slice(n.from, n.to)

const WORD_CHAR = /\w/

/** The identifier word spanning `offset` (expanding both ways over `\w`), or
 *  null if the offset isn't inside an identifier. Words starting with a digit
 *  (numeric literals) are rejected. */
export function wordAt(
  text: string,
  offset: number,
): { word: string; from: number; to: number } | null {
  let from = offset
  while (from > 0 && WORD_CHAR.test(text[from - 1] ?? '')) from--
  let to = offset
  while (to < text.length && WORD_CHAR.test(text[to] ?? '')) to++
  if (from === to) return null
  const word = text.slice(from, to)
  if (!/^[A-Za-z_]/.test(word)) return null
  return { word, from, to }
}

/** The type name of the nearest declaration of `name` before `offset`, or null.
 *  Scans every declaration/parameter in the buffer (so locals + params resolve);
 *  the nearest preceding one wins. Shared by completion + hover. */
export function resolveVarType(text: string, name: string, offset: number): string | null {
  const root = parseC(text).topNode
  const candidates: { pos: number; type: string }[] = []
  walk(root, (n) => {
    if (n.name !== 'Declaration' && n.name !== 'ParameterDeclaration') return
    if (n.from >= offset) return
    if (declaredName(n, text) !== name) return
    const type = declTypeName(n, text)
    if (type) candidates.push({ pos: n.from, type })
  })
  candidates.sort((a, b) => b.pos - a.pos) // nearest declaration before the cursor wins
  return candidates[0]?.type ?? null
}

/** Depth-first search for the first descendant of the given node type. */
export function deepChild(node: SyntaxNode, name: string): SyntaxNode | null {
  for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
    if (ch.name === name) return ch
    const found = deepChild(ch, name)
    if (found) return found
  }
  return null
}

/** Visit every descendant of `node` (pre-order). */
export function walk(node: SyntaxNode, fn: (n: SyntaxNode) => void): void {
  for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
    fn(ch)
    walk(ch, fn)
  }
}

/** The resolvable type name of a declaration's type specifier — the struct/union
 *  tag or typedef name (what the type table is keyed on), or '' for a primitive. */
export function declTypeName(decl: SyntaxNode, text: string): string {
  const spec = decl.getChild('StructSpecifier') ?? decl.getChild('UnionSpecifier')
  if (spec) {
    const tag = spec.getChild('TypeIdentifier')
    return tag ? slice(text, tag) : ''
  }
  const id = decl.getChild('TypeIdentifier')
  return id ? slice(text, id) : ''
}

/** The declared name of a non-function declarator (`Identifier`, possibly under a
 *  `PointerDeclarator`). Returns null for function declarators / anonymous decls. */
export function declaredName(decl: SyntaxNode, text: string): string | null {
  const direct = decl.getChild('Identifier')
  if (direct) return slice(text, direct)
  const ptr = decl.getChild('PointerDeclarator')
  const id = ptr ? deepChild(ptr, 'Identifier') : null
  return id ? slice(text, id) : null
}
