import type { SyntaxNode } from '@lezer/common'
import type { CField, CIndex, CType, IndexOptions, SourceFile } from './types'
import { parseC } from './parse'

// Build a project index from source files by walking each file's Lezer tree.
// Step 1 extracts the type table (struct / union / typedef → fields, with each
// field's own type for nested resolution). Top-level symbols + the var→type
// table that drives member completion land alongside completeAt (next step).
// cc65 sysroot headers are indexed read-only so register structs resolve.

const basename = (path: string): string => path.split('/').pop() ?? path

function deepChild(node: SyntaxNode, name: string): SyntaxNode | null {
  for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
    if (ch.name === name) return ch
    const found = deepChild(ch, name)
    if (found) return found
  }
  return null
}

const slice = (text: string, n: SyntaxNode): string => text.slice(n.from, n.to)

/** A FieldDeclaration's type, as written: the type specifier text plus a `*`
 *  per pointer level. Used both as the completion detail and to resolve nested
 *  `a.b.c` member chains. */
function fieldType(decl: SyntaxNode, text: string): string {
  const typeNode =
    decl.getChild('PrimitiveType') ??
    decl.getChild('SizedTypeSpecifier') ??
    decl.getChild('TypeIdentifier') ??
    decl.getChild('StructSpecifier') ??
    decl.getChild('UnionSpecifier')
  let type = typeNode ? slice(text, typeNode).replace(/\s+/g, ' ').trim() : ''
  if (deepChild(decl, 'PointerDeclarator')) type += ' *'
  return type
}

function fieldsOf(list: SyntaxNode, text: string): CField[] {
  const out: CField[] = []
  for (let decl = list.firstChild; decl; decl = decl.nextSibling) {
    if (decl.name !== 'FieldDeclaration') continue
    const id = deepChild(decl, 'FieldIdentifier')
    if (!id) continue
    out.push({ name: slice(text, id), type: fieldType(decl, text) })
  }
  return out
}

function walk(node: SyntaxNode, fn: (n: SyntaxNode) => void): void {
  for (let ch = node.firstChild; ch; ch = ch.nextSibling) {
    fn(ch)
    walk(ch, fn)
  }
}

function collectTypes(text: string, file: string, into: Map<string, CType>): void {
  const root = parseC(text).topNode
  walk(root, (n) => {
    // Named definition: `struct Foo { … }` / `union U { … }`.
    if (n.name === 'StructSpecifier' || n.name === 'UnionSpecifier') {
      const list = n.getChild('FieldDeclarationList')
      const tag = n.getChild('TypeIdentifier')
      if (list && tag) {
        const name = slice(text, tag)
        if (!into.has(name)) {
          into.set(name, {
            name,
            kind: n.name === 'UnionSpecifier' ? 'union' : 'struct',
            fields: fieldsOf(list, text),
            file,
          })
        }
      }
      return
    }
    // `typedef struct { … } Bar;` — the alias is the trailing TypeIdentifier
    // directly under the TypeDefinition (the inner tag, if any, is handled above).
    if (n.name === 'TypeDefinition') {
      const list = deepChild(n, 'FieldDeclarationList')
      const ids = n.getChildren('TypeIdentifier')
      const alias = ids[ids.length - 1]
      if (list && alias) {
        const name = slice(text, alias)
        if (!into.has(name)) {
          into.set(name, { name, kind: 'typedef', fields: fieldsOf(list, text), file })
        }
      }
    }
  })
}

export function indexC(files: SourceFile[], opts: IndexOptions = {}): CIndex {
  const index: CIndex = { types: new Map(), symbols: new Map() }
  const all = [...(opts.sysrootHeaders ?? []), ...files]
  for (const f of all) collectTypes(f.text, basename(f.path), index.types)
  return index
}
