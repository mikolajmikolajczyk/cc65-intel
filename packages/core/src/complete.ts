import type { CIndex, CompletionItem } from './types'

// Answer a completion request at `offset` in `text`, given a built `index`.
//   - after `.` / `->`  → resolve the left-hand expression's type, list its fields
//   - otherwise          → matching identifiers (functions / macros / globals / types)
//
// SCAFFOLD: member + identifier resolution lands in the next steps. Returns [].
export function completeAt(_index: CIndex, _text: string, _offset: number): CompletionItem[] {
  return []
}
