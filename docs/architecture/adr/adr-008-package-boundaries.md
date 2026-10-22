---
status: ACCEPTED
---

# ADR-008: `@sudoku/core` as an internal package, the scanner as a module inside the app

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Accepted   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

Two pieces of code have a clear boundary: the game logic (board, rules, generator, solver, hints)
and the scanner. A boundary can be a folder by convention, or a workspace package with its own
`package.json` that makes the boundary enforceable.

## Alternatives Evaluated

| | Folder inside the app | Internal workspace package |
| --- | --- | --- |
| Boundary | By convention only | Declared in its `package.json`. With pnpm's isolated linker that is enforced too. An Expo monorepo may need a hoisted `node_modules`, which removes that enforcement |
| Tests | Inside the app's setup | Plain Node with Vitest, in milliseconds |
| Reuse by the backend | Copy or move later | `"@sudoku/core": "workspace:*"` |
| Native modules | Installed once, in the app | Must also be installed in the app, since Expo autolinks from the app only |
| Setup | None | A `package.json`, a `tsconfig`, Metro configured for the monorepo once |

## Decision

1. **`packages/sudoku-core` (`@sudoku/core`) is a package from day one.** It has no dependencies
   on React Native, Expo or any I/O (SUD-04). It is an internal package: the app imports its
   TypeScript source directly, with no build step and no publishing.
2. **The scanner stays in `apps/mobile/src/scanner/`.** Its only user is the app, and its
   dependencies are native modules. `src/scanner/index.ts` is its only entry point (SUD-05).
3. The game never imports the scanner (SUD-03). The Scan UI imports both.
4. **Enforcement does not rely on the linker.** dependency-cruiser checks SUD-03, SUD-04 and
   SUD-05 in CI ([ADR-010](adr-010-testing-and-ci.md)).

## Consequences

- The backend, when it comes, validates leaderboard results with the same solver.
- Moving the scanner into a package later is mechanical, because its interface is already the
  only entry point.
- Expo SDK 57 bundles `@sudoku/core` with pnpm's isolated linker. No hoisting is needed (#1).

## Reassessment Triggers

- A second consumer of the scanner appears (a web demo, an Android-only app). Make it a package.

## Amendment 2026-10-22: accepted

The code on `develop` proves this decision. The status moves from Proposed to Accepted. The decision does not change.

- `@sudoku/core` is the internal package in `shared/core/`. [ADR-029](adr-029-repository-layout.md) moved it from
  `packages/sudoku-core/`.
- The scanner is `mobile/src/scanner/`. `mobile/src/scanner/index.ts` is its only entry point.
- `.dependency-cruiser.cjs` checks SUD-03, SUD-04 and SUD-05. `just boundaries` runs it as part of `just lint`, in CI
  on every push (#8, #31).
