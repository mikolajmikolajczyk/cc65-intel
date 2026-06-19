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
})
