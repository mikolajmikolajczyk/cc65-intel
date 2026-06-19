import type { SyntaxNode } from '@lezer/common'

// Shared Lezer-tree helpers used by the indexer and the completer.

export const slice = (text: string, n: SyntaxNode): string => text.slice(n.from, n.to)

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
