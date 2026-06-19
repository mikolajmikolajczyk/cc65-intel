import type { CIndex, CompletionItem } from './types'
import { parseC } from './parse'
import { declTypeName, declaredName, walk } from './ast'

// Answer a completion request at `offset` in `text`, given a built `index`.
//   - after `.` / `->`  → resolve the left-hand variable's type, list its fields
//   - otherwise          → matching identifiers (functions / macros / globals / types)
//
// Member resolution reads the *live* buffer (not the index) so locals, params,
// and unsaved edits resolve: we find the nearest declaration of the LHS name
// before the cursor, take its type name, and look that type up in the index.

// `<var> . ` or `<var> -> ` immediately before the cursor, with an optional
// partial member word being typed.
const MEMBER_RE = /([A-Za-z_]\w*)\s*(?:\.|->)\s*(\w*)$/
// A bare identifier prefix under the cursor.
const IDENT_RE = /([A-Za-z_]\w*)$/

const startsWith = (label: string, prefix: string): boolean =>
  label.toLowerCase().startsWith(prefix.toLowerCase())

/** The type name of the nearest declaration of `name` before `offset`, or null.
 *  Scans every declaration/parameter in the buffer (so locals + params resolve);
 *  the nearest preceding one wins. */
function resolveVarType(text: string, name: string, offset: number): string | null {
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

function memberCompletions(index: CIndex, type: string, prefix: string): CompletionItem[] {
  const t = index.types.get(type)
  if (!t) return []
  return t.fields
    .filter((f) => startsWith(f.name, prefix))
    .map((f) => ({ label: f.name, kind: 'field', detail: f.type }))
}

function identifierCompletions(index: CIndex, prefix: string): CompletionItem[] {
  const out: CompletionItem[] = []
  for (const s of index.symbols.values()) {
    if (startsWith(s.label, prefix)) {
      out.push({
        label: s.label,
        kind: s.kind,
        ...(s.detail ? { detail: s.detail } : {}),
        ...(s.header ? { header: s.header } : {}),
      })
    }
  }
  for (const t of index.types.values()) {
    if (startsWith(t.name, prefix)) out.push({ label: t.name, kind: 'type' })
  }
  return out
}

export function completeAt(index: CIndex, text: string, offset: number): CompletionItem[] {
  const before = text.slice(0, offset)

  const member = MEMBER_RE.exec(before)
  if (member) {
    const lhs = member[1] ?? ''
    const partial = member[2] ?? ''
    const type = resolveVarType(text, lhs, offset)
    return type ? memberCompletions(index, type, partial) : []
  }

  const ident = IDENT_RE.exec(before)
  return identifierCompletions(index, ident ? (ident[1] ?? '') : '')
}
