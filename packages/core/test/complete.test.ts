import { describe, expect, it } from 'vitest'
import { completeAt, indexC } from '../src/index.js'

const labels = (items: { label: string }[]) => items.map((i) => i.label).sort()

// Cursor is marked with | in the fixture; we split on it to get text + offset.
function at(fixture: string) {
  const offset = fixture.indexOf('|')
  return { text: fixture.replace('|', ''), offset }
}

describe('completeAt — member completion', () => {
  const src = `struct Foo { int x; char *name; };
struct Foo g;
void main(void) {
  struct Foo local;
  g.|
}`

  it('completes fields of a global struct var after "."', () => {
    const { text, offset } = at(src)
    const idx = indexC([{ path: 'main.c', text }])
    const items = completeAt(idx, text, offset)
    expect(labels(items)).toEqual(['name', 'x'])
    expect(items.every((i) => i.kind === 'field')).toBe(true)
  })

  it('resolves a local declared above the cursor', () => {
    const fixture = `struct P { int a; int b; };
void f(void) {
  struct P local;
  local.|
}`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }])
    expect(labels(completeAt(idx, text, offset))).toEqual(['a', 'b'])
  })

  it('completes after "->" the same way', () => {
    const fixture = `struct Q { int v; };
void f(struct Q *p) { p->| }`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }])
    expect(labels(completeAt(idx, text, offset))).toEqual(['v'])
  })

  it('filters fields by the partial member prefix', () => {
    const fixture = `struct R { int alpha; int beta; };
struct R r;
void f(void) { r.al| }`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }])
    expect(labels(completeAt(idx, text, offset))).toEqual(['alpha'])
  })
})

describe('completeAt — identifier completion', () => {
  it('completes functions / macros / globals / types by prefix', () => {
    const fixture = `#define MAXVAL 1
int addNums(int a, int b);
struct Thing { int z; };
void f(void) { ad| }`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }])
    expect(labels(completeAt(idx, text, offset))).toEqual(['addNums'])
  })

  it('resolves a cc65 register macro var to its struct fields (VIC.)', () => {
    const vic2 = `struct __vic2 {
  unsigned char ctrl1;
  unsigned char bordercolor;
  unsigned char bgcolor0;
};
#define VIC (*(struct __vic2*)0xD000)`
    const fixture = `void main(void) { VIC.| }`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }], {
      sysrootHeaders: [{ path: 'include/_vic2.h', text: vic2 }],
    })
    expect(labels(completeAt(idx, text, offset))).toEqual(['bgcolor0', 'bordercolor', 'ctrl1'])
  })

  it('filters register fields by the partial member prefix (VIC.bor)', () => {
    const vic2 = `struct __vic2 { unsigned char bordercolor; unsigned char bgcolor0; };
#define VIC (*(struct __vic2*)0xD000)`
    const fixture = `void main(void) { VIC.bor| }`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }], {
      sysrootHeaders: [{ path: 'include/_vic2.h', text: vic2 }],
    })
    expect(labels(completeAt(idx, text, offset))).toEqual(['bordercolor'])
  })

  it('resolves SID. and CIA1. register macros the same way', () => {
    const sid = `struct __sid { unsigned char v1_freq_lo; unsigned char v1_freq_hi; };
#define SID (*(struct __sid*)0xD400)`
    const cia = `struct __6526 { unsigned char pra; unsigned char prb; };
#define CIA1 (*(struct __6526*)0xDC00)`
    const sysrootHeaders = [
      { path: 'include/_sid.h', text: sid },
      { path: 'include/_6526.h', text: cia },
    ]
    {
      const { text, offset } = at(`void main(void) { SID.| }`)
      const idx = indexC([{ path: 'main.c', text }], { sysrootHeaders })
      expect(labels(completeAt(idx, text, offset))).toEqual(['v1_freq_hi', 'v1_freq_lo'])
    }
    {
      const { text, offset } = at(`void main(void) { CIA1.| }`)
      const idx = indexC([{ path: 'main.c', text }], { sysrootHeaders })
      expect(labels(completeAt(idx, text, offset))).toEqual(['pra', 'prb'])
    }
  })

  it('offers types + symbols when the prefix matches several', () => {
    const fixture = `struct Tank { int hp; };
int tankCount;
void f(void) { Ta| }`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }])
    // 'Tank' (type) matches 'Ta'; 'tankCount' matches case-insensitively too
    expect(labels(completeAt(idx, text, offset))).toContain('Tank')
  })

  it('completes cc65 stdlib functions decorated with __fastcall__', () => {
    const fixture = `void f(void) { cput| }`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }], {
      sysrootHeaders: [
        {
          path: 'include/conio.h',
          text: 'void __fastcall__ cputs (const char* s);\nvoid __fastcall__ cputc (char c);\nvoid __fastcall__ cputcxy (unsigned char x, unsigned char y, char c);',
        },
      ],
    })
    expect(labels(completeAt(idx, text, offset))).toEqual(['cputc', 'cputcxy', 'cputs'])
  })

  it('carries the header + detail of a stdlib symbol through to the completion', () => {
    const fixture = `void f(void) { cput| }`
    const { text, offset } = at(fixture)
    const idx = indexC([{ path: 'main.c', text }], {
      sysrootHeaders: [{ path: 'include/conio.h', text: 'void cputs(const char* s);' }],
    })
    const cputs = completeAt(idx, text, offset).find((i) => i.label === 'cputs')
    expect(cputs?.header).toBe('conio.h')
    expect(cputs?.detail).toBe('void cputs(const char* s)')
  })
})
