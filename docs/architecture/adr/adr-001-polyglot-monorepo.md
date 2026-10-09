---
status: DRAFT
---

# ADR-001: Polyglot monorepo with pnpm, uv and one justfile

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

The project has a TypeScript side (the app and the game logic) and a Python side (training).
They change together: a new model contract touches the training code, the export and the app's
loader in one go. One developer maintains both (OC-1). Four earlier sudoku repositories already
split this work across repos, and nothing tied them together.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| **One monorepo, two toolchains side by side** | One PR changes contract, training and app together. Shared fixtures. One history | Two package managers in one repo |
| Two repos (app, ml) | Each toolchain stays pure | The contract and fixtures have no single home. The model handoff crosses repos. This is the pattern that left four orphaned repos |
| One toolchain for everything (Nx or Bazel managing Python too) | One command surface | Heavy tooling for a solo side project. Fights uv instead of using it |

## Decision

One repository, `sudoku`, with:

1. **pnpm workspaces** for `apps/*` and `packages/*`. Turborepo is not added yet: with one app
   and one package, plain `pnpm -r` scripts are enough.
2. **uv** for `ml/`, as a standalone Python project with its own `pyproject.toml` and lockfile.
   It is not part of the pnpm workspace.
3. A **`justfile`** at the root as the single command list for both sides: `just app`,
   `just test`, `just train`, `just eval`, `just promote-model`.
4. The two sides share **files only**: `contracts/`, `fixtures/` and the promoted model in
   `apps/mobile/assets/models/` (SUD-07).

## Consequences

- A newcomer runs `just --list` and sees every task, whichever language it is in.
- CI needs both Node and Python setups. Path filters keep a docs or ml-only change from building
  the app.
- The repo structure itself shows the boundary, which suits the portfolio goal.

## Reassessment Triggers

- The backend arrives in a third language. Re-check whether `just` still holds it together.
- A second app or package makes CI or local runs slow enough that caching pays. Add Turborepo.
