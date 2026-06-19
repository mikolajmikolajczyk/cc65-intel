import { describe, expect, it } from 'vitest'
import { indexC } from '../src/index.js'

// Top-level symbol extraction: functions (definitions + prototypes), #define
// macros, and global variables (with their resolvable type name). Locals inside
// function bodies must NOT leak into the symbol table.

describe('indexC — symbol extraction', () => {
  it('collects functions, macros, and globals; skips locals', () => {
    const idx = indexC([
      {
        path: 'src/main.c',
        text: `#define MAX 10
int add(int a, int b);
void main(void) { int local; }
struct Foo g;
unsigned char *p;`,
      },
    ])
    const kinds = (label: string) => idx.symbols.get(label)?.kind
    expect(kinds('MAX')).toBe('macro')
    expect(kinds('add')).toBe('function')
    expect(kinds('main')).toBe('function')
    expect(kinds('g')).toBe('global')
    expect(kinds('p')).toBe('global')
    // a local declared inside main() is not a top-level symbol
    expect(idx.symbols.has('local')).toBe(false)
  })

  it('records the resolvable type name of a global (struct tag / typedef)', () => {
    const idx = indexC([
      {
        path: 'src/main.c',
        text: 'struct Foo { int x; }; typedef struct { int a; } Bar; struct Foo g; Bar b;',
      },
    ])
    expect(idx.symbols.get('g')?.type).toBe('Foo')
    expect(idx.symbols.get('b')?.type).toBe('Bar')
  })

  it('tags sysroot-header symbols with their declaring header; project symbols carry none', () => {
    const idx = indexC([{ path: 'src/main.c', text: 'void main(void) {}' }], {
      sysrootHeaders: [
        { path: 'include/conio.h', text: 'void cputs(const char* s);\n#define CH_DEL 20' },
      ],
    })
    expect(idx.symbols.get('cputs')?.header).toBe('conio.h')
    expect(idx.symbols.get('CH_DEL')?.header).toBe('conio.h')
    // a project .c symbol gets no header
    expect(idx.symbols.get('main')?.header).toBeUndefined()
  })

  it('records a one-line signature as detail for functions (prototype + definition)', () => {
    const idx = indexC([
      {
        path: 'src/main.c',
        text: 'int add(int a, int b);\nvoid run(void) { int x; }',
      },
    ])
    expect(idx.symbols.get('add')?.detail).toBe('int add(int a, int b)')
    expect(idx.symbols.get('run')?.detail).toBe('void run(void)')
  })
})
