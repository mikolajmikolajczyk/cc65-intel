# cc65-intel task runner. Run `just` for the list.

# Show available recipes.
default:
    @just --list

# Install dependencies.
install:
    pnpm install

# Run all checks (the CI gate).
check: lint format-check typecheck madge build test

lint:
    pnpm lint

format-check:
    pnpm format:check

# Auto-format.
format:
    pnpm format

typecheck:
    pnpm typecheck

madge:
    pnpm madge:circular

build:
    pnpm build

test:
    pnpm test

# Cut a release end-to-end: gates → bump (root + packages) → changelog →
# signed commit + tag → push → GitHub release. First release works too
# (git-cliff has no prior-tag requirement).
release version:
    #!/usr/bin/env bash
    set -euo pipefail
    ver="{{ version }}"
    tag="v$ver"

    # --- preflight: fail before mutating anything ---
    if ! [[ "$ver" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "✗ version must be X.Y.Z (got '$ver')"; exit 1
    fi
    if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
        echo "✗ tag $tag already exists"; exit 1
    fi
    if [ -f CHANGELOG.md ] && grep -q "^## \[$ver\]" CHANGELOG.md; then
        echo "✗ CHANGELOG.md already has a [$ver] section"; exit 1
    fi
    branch="$(git rev-parse --abbrev-ref HEAD)"
    if [ "$branch" != "main" ]; then echo "✗ not on main (on '$branch')"; exit 1; fi
    if [ -n "$(git status --porcelain)" ]; then echo "✗ working tree dirty"; exit 1; fi

    # --- quality gates ---
    echo "▸ install…"; pnpm install --frozen-lockfile
    echo "▸ lint…";    pnpm lint
    echo "▸ format…";  pnpm format:check
    echo "▸ types…";   pnpm typecheck
    echo "▸ madge…";   pnpm madge:circular
    echo "▸ build…";   pnpm build
    echo "▸ test…";    pnpm test

    # Warm the gpg agent so the signed commit + tag don't hit a first-use timeout.
    echo "▸ warming gpg…"; echo release | gpg --clearsign >/dev/null 2>&1 || true

    # --- mutate: bump every package (lockstep), changelog, commit, tag ---
    echo "▸ bump → $ver"
    npm pkg set version="$ver"
    for pkg in packages/*; do (cd "$pkg" && npm pkg set version="$ver"); done
    echo "▸ changelog…"; npx -y git-cliff@latest --unreleased --tag "$tag" --prepend CHANGELOG.md
    git add package.json packages/*/package.json CHANGELOG.md
    git commit -S -m "chore(release): $tag"
    git tag -s "$tag" -m "$tag"

    # --- publish ---
    echo "▸ push…"; git push origin main; git push origin "$tag"
    notes="$(mktemp)"
    awk -v v="$ver" '$0 ~ "^## \\[" v "\\]" {f=1; next} /^## \[/ {f=0} f' CHANGELOG.md > "$notes"
    gh release create "$tag" --title "$tag" --notes-file "$notes" --verify-tag
    rm -f "$notes"
    echo "✓ released $tag"
