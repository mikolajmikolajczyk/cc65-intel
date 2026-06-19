import { afterAll, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readSysrootHeaders } from '../src/sysroot.js'

describe('readSysrootHeaders', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cc65-sysroot-'))
  writeFileSync(join(dir, 'conio.h'), 'void cputs(const char *s);')
  writeFileSync(join(dir, '_vic2.h'), 'struct __vic2 { unsigned char bordercolor; };')
  writeFileSync(join(dir, 'notes.txt'), 'ignore me')
  mkdirSync(join(dir, 'sub.h')) // a directory that looks like a header — skipped

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('reads every *.h as { path, text }', () => {
    const headers = readSysrootHeaders(dir)
    const byPath = Object.fromEntries(headers.map((h) => [h.path, h.text]))
    expect(Object.keys(byPath).sort()).toEqual(['_vic2.h', 'conio.h'])
    expect(byPath['conio.h']).toContain('cputs')
  })

  it('ignores non-.h files', () => {
    expect(readSysrootHeaders(dir).some((h) => h.path === 'notes.txt')).toBe(false)
  })

  it('returns [] for an empty setting', () => {
    expect(readSysrootHeaders('')).toEqual([])
  })

  it('returns [] for a missing directory', () => {
    expect(readSysrootHeaders(join(dir, 'does-not-exist'))).toEqual([])
  })
})
