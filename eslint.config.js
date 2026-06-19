import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import boundaries from 'eslint-plugin-boundaries'
import importPlugin from 'eslint-plugin-import'

// Flat config. Two-package architecture (ADR-0001): `core` is the pure engine,
// `lsp` is a thin server over it. The boundary is machine-enforced here:
//   - core may import only core (never lsp),
//   - core must stay editor/LSP/DOM-free (no codemirror / vscode-languageserver),
// so the engine stays extraction-ready and reusable by any host.

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', '**/*.tsbuildinfo'] },

  // Config + plain-JS files: lint without type information.
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [js.configs.recommended, tseslint.configs.disableTypeChecked],
  },

  // TypeScript sources + tests: full type-aware linting.
  {
    files: ['**/*.ts'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { boundaries, import: importPlugin },
    settings: {
      'boundaries/include': ['packages/**/*'],
      'boundaries/elements': [
        { type: 'core', pattern: 'packages/core/*', mode: 'folder' },
        { type: 'lsp', pattern: 'packages/lsp/*', mode: 'folder' },
        { type: 'vscode-ext', pattern: 'packages/vscode/*', mode: 'folder' },
      ],
      'import/resolver': {
        typescript: { project: ['packages/*/tsconfig.json'] },
      },
    },
    rules: {
      // Dependency direction: core ↛ lsp; lsp → core is allowed.
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            { from: ['core'], allow: ['core'] },
            { from: ['lsp'], allow: ['core', 'lsp'] },
            { from: ['vscode-ext'], allow: ['core', 'lsp', 'vscode-ext'] },
          ],
        },
      ],
      // Consistent type-only imports keep the boundary + tree-shaking honest.
      '@typescript-eslint/consistent-type-imports': 'error',
      // `_`-prefixed args/vars are intentionally unused (stub params kept for
      // the public signature, ignored bindings).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },

  // Core purity: no editor / LSP / DOM dependencies may leak into the engine.
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@codemirror/*',
                'codemirror',
                'vscode',
                'vscode-languageserver',
                'vscode-languageserver-*',
                '@cc65-intel/lsp',
              ],
              message: 'core must stay editor/LSP/DOM-free (ADR-0001) — keep it pure data in/out.',
            },
          ],
        },
      ],
    },
  },

  // Tests: allow non-null assertions + the looser shapes fixtures need.
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
)
