import type { SyntaxNode } from '@lezer/common'
import type { CField, CIndex, CSymbol, CType, IndexOptions, SourceFile } from './types'
import { parseC } from './parse'
import { declTypeName, declaredName, deepChild, slice, walk } from './ast'

// Build a project index from source files by walking each file's Lezer tree:
// the type table (struct / union / typedef → fields) and the top-level symbol
// table (functions / macros / globals). cc65 sysroot headers are indexed
// read-only so register structs resolve. The var→type resolution that drives
// member completion is done per-request in completeAt (from the live buffer, so
// locals + unsaved edits resolve), not stored here.

const basename = (path: string): string => path.split('/').pop() ?? path

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

/** The function name from a `FunctionDeclarator`. */
function fnName(declarator: SyntaxNode, text: string): string | null {
  const id = declarator.getChild('Identifier')
  return id ? slice(text, id) : null
}

function collectSymbols(text: string, file: string, into: Map<string, CSymbol>): void {
  const root = parseC(text).topNode
  const add = (s: CSymbol): void => {
    if (!into.has(s.label)) into.set(s.label, s)
  }

  // `#define NAME` anywhere.
  walk(root, (n) => {
    if (n.name !== 'PreprocDirective') return
    if (!n.getChild('#define')) return
    const id = n.getChild('Identifier')
    if (id) add({ label: slice(text, id), kind: 'macro', file })
  })

  // Top-level functions + globals (direct children of the program root only, so
  // locals inside function bodies don't leak into identifier completion).
  for (let n = root.firstChild; n; n = n.nextSibling) {
    if (n.name === 'FunctionDefinition') {
      const decl = n.getChild('FunctionDeclarator')
      const name = decl ? fnName(decl, text) : null
      if (name) add({ label: name, kind: 'function', file })
      continue
    }
    if (n.name !== 'Declaration') continue
    const fnDecl = n.getChild('FunctionDeclarator')
    if (fnDecl) {
      const name = fnName(fnDecl, text)
      if (name) add({ label: name, kind: 'function', file })
      continue
    }
    const name = declaredName(n, text)
    if (name) {
      const type = declTypeName(n, text)
      add({ label: name, kind: 'global', file, ...(type ? { type } : {}) })
    }
  }
}

export function indexC(files: SourceFile[], opts: IndexOptions = {}): CIndex {
  const index: CIndex = { types: new Map(), symbols: new Map() }
  const all = [...(opts.sysrootHeaders ?? []), ...files]
  for (const f of all) {
    const file = basename(f.path)
    collectTypes(f.text, file, index.types)
    collectSymbols(f.text, file, index.symbols)
  }
  return index
}
