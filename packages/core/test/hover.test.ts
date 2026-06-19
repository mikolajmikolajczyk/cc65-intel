import { describe, expect, it } from 'vitest'
import { hoverAt, indexC } from '../src/index.js'

// Cursor is marked with | in the fixture; we split on it to get text + offset.
function at(fixture: string) {
  const offset = fixture.indexOf('|')
  return { text: fixture.replace('|', ''), offset }
}

describe('hoverAt', () => {
  it('hovers a function: signature + kind + file', () => {
    const { text, offset } = at('int add(int a, int b);\nvoid f(void) { ad|d(1, 2); }')
    const idx = indexC([{ path: 'src/main.c', text }])
    const h = hoverAt(idx, text, offset)
    expect(h).not.toBeNull()
    expect(h!.contents).toContain('int add(int a, int b)')
    expect(h!.contents).toContain('*function*')
    expect(h!.contents).toContain('main.c')
  })

  it('hovers a stdlib symbol showing its header', () => {
    const { text, offset } = at('void f(void) { cput|s("hi"); }')
    const idx = indexC([{ path: 'src/main.c', text }], {
      sysrootHeaders: [{ path: 'include/conio.h', text: 'void cputs(const char* s);' }],
    })
    const h = hoverAt(idx, text, offset)
    expect(h!.contents).toContain('void cputs(const char* s)')
    expect(h!.contents).toContain('<conio.h>')
  })

  it('hovers a struct field after "." showing its type', () => {
    const { text, offset } = at(
      'struct Foo { int x; char *name; };\nstruct Foo g;\nvoid f(void){ g.na|me; }',
    )
    const idx = indexC([{ path: 'main.c', text }])
    const h = hoverAt(idx, text, offset)
    expect(h!.contents).toContain('char * name')
    expect(h!.contents).toContain('*field*')
  })

  it('hovers a typedef/struct name showing its kind + file', () => {
    const { text, offset } = at('typedef struct { int a; } Bar;\nBa|r b;')
    const idx = indexC([{ path: 'lib/types.h', text }])
    const h = hoverAt(idx, text, offset)
    expect(h!.contents).toContain('typedef Bar')
    expect(h!.contents).toContain('*type*')
    expect(h!.contents).toContain('types.h')
  })

  it('hovers a macro', () => {
    const { text, offset } = at('#define MAXVAL 10\nint x = MAX|VAL;')
    const idx = indexC([{ path: 'main.c', text }])
    const h = hoverAt(idx, text, offset)
    expect(h!.contents).toContain('MAXVAL')
    expect(h!.contents).toContain('*macro*')
  })

  it('returns null on a miss (unknown word / whitespace)', () => {
    const { text, offset } = at('int x = 1; // no|pe')
    const idx = indexC([{ path: 'main.c', text }])
    expect(hoverAt(idx, text, offset)).toBeNull()
  })
})
