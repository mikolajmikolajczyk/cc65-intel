import { configDefaults, defineConfig } from 'vitest/config'

// `.direnv/flake-inputs/` holds a nix-store copy of this repo (from the dev
// flake). Without excluding it, vitest discovers a second, dependency-less copy
// of every test and they fail to import. CI has no `.direnv`, so this only
// matters for local direnv users.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, '**/.direnv/**'],
  },
})
