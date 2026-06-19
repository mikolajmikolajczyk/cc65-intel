import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Pure config → init-options mapping for the extension. Kept out of extension.ts
// (which needs the vscode API) so it's unit-testable without an editor host.

export interface SysrootHeader {
  path: string
  text: string
}

/** Read every `*.h` under `dir` as a sysroot header (`{ path, text }`), the shape
 *  `initializationOptions.sysrootHeaders` expects. A missing/unreadable dir (or
 *  an empty setting) yields `[]` — the engine simply won't resolve stdlib /
 *  register types, completion still works for project symbols. */
export function readSysrootHeaders(dir: string): SysrootHeader[] {
  if (!dir) return []
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }
  const headers: SysrootHeader[] = []
  for (const name of entries) {
    if (!name.endsWith('.h')) continue
    try {
      headers.push({ path: name, text: readFileSync(join(dir, name), 'utf8') })
    } catch {
      // skip unreadable entries (e.g. a subdir named `*.h`)
    }
  }
  return headers
}
