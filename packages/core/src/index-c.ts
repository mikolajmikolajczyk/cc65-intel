import type { SyntaxNode } from '@lezer/common'
import type { CField, CIndex, CSymbol, CType, IndexOptions, SourceFile } from './types'
import { parseC, stripDecorators } from './parse'
import { declTypeName, declaredName, deepChild, slice, walk } from './ast'

// Build a project index from source files by walking each file's Lezer tree:
// the type table (struct / union / typedef → fields) and the top-level symbol
// table (functions / macros / globals). cc65 sysroot headers are indexed
// read-only so register structs resolve. The var→type resolution that drives
// member completion is done per-request in completeAt (from the live buffer, so
// locals + unsaved edits resolve), not stored here.

const basename = (path: string): string => path.split('/').pop() ?? path

// A cc65 register-macro body's pointer cast: `(struct __vic2*)` / `(union x *)`.
// The captured tag is the struct/union the macro instance has.
const REGISTER_CAST = /\(\s*(?:struct|union)\s+(\w+)\s*\*\s*\)/

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

/** A one-line signature for completion detail. For a prototype (`Declaration`
 *  with a `FunctionDeclarator`) it's the whole declaration minus the trailing
 *  `;`; for a `FunctionDefinition` it's the text up to the body. Whitespace is
 *  collapsed so it reads on one line. */
function signatureOf(decl: SyntaxNode, text: string): string {
  const body = decl.getChild('CompoundStatement')
  const end = body ? body.from : decl.to
  // Blank cc65 calling-convention decorators so the signature reads cleanly
  // (`void __fastcall__ cputs(...)` → `void cputs(...)`).
  return stripDecorators(text.slice(decl.from, end))
    .replace(/\s+/g, ' ')
    .replace(/\s*;\s*$/, '')
    .trim()
}

function collectSymbols(
  text: string,
  file: string,
  into: Map<string, CSymbol>,
  header?: string,
): void {
  const root = parseC(text).topNode
  const hdr = header ? { header } : {}
  const add = (s: CSymbol): void => {
    if (!into.has(s.label)) into.set(s.label, s)
  }

  // `#define NAME …`. cc65 exposes hardware registers as `#define VIC
  // (*(struct __vic2*)0xd000)` — index those as a typed global so `VIC.`
  // resolves to the struct's fields; everything else is a plain macro.
  walk(root, (n) => {
    if (n.name !== 'PreprocDirective') return
    if (!n.getChild('#define')) return
    const id = n.getChild('Identifier')
    if (!id) return
    const label = slice(text, id)
    const arg = n.getChild('PreprocArg')
    const tag = arg ? REGISTER_CAST.exec(slice(text, arg))?.[1] : undefined
    if (tag) add({ label, kind: 'global', type: tag, detail: `struct ${tag}`, file, ...hdr })
    else add({ label, kind: 'macro', file, ...hdr })
  })

  // Top-level functions + globals (direct children of the program root only, so
  // locals inside function bodies don't leak into identifier completion).
  for (let n = root.firstChild; n; n = n.nextSibling) {
    if (n.name === 'FunctionDefinition') {
      const decl = n.getChild('FunctionDeclarator')
      const name = decl ? fnName(decl, text) : null
      if (name) add({ label: name, kind: 'function', file, detail: signatureOf(n, text), ...hdr })
      continue
    }
    if (n.name !== 'Declaration') continue
    const fnDecl = n.getChild('FunctionDeclarator')
    if (fnDecl) {
      const name = fnName(fnDecl, text)
      if (name) add({ label: name, kind: 'function', file, detail: signatureOf(n, text), ...hdr })
      continue
    }
    const name = declaredName(n, text)
    if (name) {
      const type = declTypeName(n, text)
      add({ label: name, kind: 'global', file, ...(type ? { type } : {}), ...hdr })
    }
  }
}

export function indexC(files: SourceFile[], opts: IndexOptions = {}): CIndex {
  const index: CIndex = { types: new Map(), symbols: new Map() }
  // Sysroot headers carry their basename as the declaring header (drives editor
  // auto-`#include`); project `.c`/`.h` symbols don't get one.
  for (const f of opts.sysrootHeaders ?? []) {
    const file = basename(f.path)
    collectTypes(f.text, file, index.types)
    collectSymbols(f.text, file, index.symbols, file)
  }
  for (const f of files) {
    const file = basename(f.path)
    collectTypes(f.text, file, index.types)
    collectSymbols(f.text, file, index.symbols)
  }
  return index
}
