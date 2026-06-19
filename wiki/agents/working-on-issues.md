# Working on issues

Issues are the source of truth for the roadmap: `gh issue list`. Milestones
group them (M1 engine completion → M2 browser LSP + madside → M3 ecosystem →
M4 accuracy/registers).

## Picking one up

1. `gh issue view <n>` — each issue is written to be **self-contained**: context,
   scope, implementation steps with file pointers, acceptance criteria + the
   tests to add, madside-compat notes, and dependencies.
2. Read the wiki files it links (always [madside-contract.md](madside-contract.md)
   for anything user-facing).
3. Check **dependencies** — some issues require another first (e.g. auto-include
   needs stdlib completion; registers need sysroot indexing). The issue states them.

## Doing the work

- Follow [adding-features.md](adding-features.md): engine → LSP → roundtrip test.
- Stay in scope. One issue = one capability. Don't refactor unrelated code.
- `just check` must be green before you call it done.
- Commit with Conventional Commits, signed, referencing the issue
  (`Closes #<n>`). Straight to `main`.
- If a release is needed for madside to consume it, say so (or cut one:
  `just release X.Y.Z`).

## Definition of done

- Engine function + LSP handler + capability advertised.
- Protocol-roundtrip test proving the host-visible behaviour.
- Unit tests for the engine logic.
- `just check` green; docs/status updated if behaviour changed.
- The result is a standard LSP shape madside can render (see the contract).

## If you get stuck / pause

Leave a short comment on the issue: what's done, what's next, any blocker. The
next agent reads it.
