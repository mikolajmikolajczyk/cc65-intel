{
  description = "cc65-intel — C-language intelligence (engine + LSP) for the cc65 6502 toolchain";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        # Dev shell with the native tools the repo needs. The JS tooling
        # (eslint, prettier, typescript, vitest, madge) is pinned in
        # package.json and provided by `pnpm install` (node_modules/.bin),
        # which the pre-commit hooks call via `pnpm exec`.
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm
            just
            pre-commit # the hook framework
            gnupg # the gpg-uid-guard pre-commit hook needs gpg in PATH
            git
          ];

          shellHook = ''
            # Install the git hooks so commits run the same gate as CI. Without
            # this, commits that fail lint/format/types land and turn CI red.
            pre-commit install --install-hooks >/dev/null 2>&1 || true
            echo "cc65-intel dev shell"
            echo "  node $(node --version) · pnpm $(pnpm --version) · just $(just --version)"
            echo "  pre-commit hooks installed. Run: pnpm install && just check"
          '';
        };
      }
    );
}
