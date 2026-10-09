---
status: DRAFT
---

# ADR-007: Models reach the app through a gated promote step

| Field   | Value      |
| ------- | ---------- |
| Project | Sudoku     |
| Status  | Proposed   |
| Date    | 2026-10-09 |
| Contact | Felix      |

## Context

Training produces many runs. Only some are good enough for the app, and the app must know
exactly which model it ships. Per-cell accuracy is misleading: at 99 % per cell, only
0.99⁸¹ ≈ 44 % of grids come out fully correct, and one wrong digit breaks the puzzle.

## Alternatives Evaluated

| Option | For | Against |
| --- | --- | --- |
| **Copy the chosen run into the app folder and commit it** | Versioned with the code. Reviewable. Rollback is `git revert`. Works offline | Binary in git. Fine below a few MB |
| GitHub Release asset, downloaded at build time | Keeps binaries out of history | Build depends on the network and a release step. Harder to see which model a commit shipped |
| Git LFS | Large-binary support | Extra tooling for a file under 1 MB |
| Download at runtime | Update without an app release | Needs the backend (TC-3) |

## Decision

1. Runs land in `ml/artifacts/<run>/` (gitignored).
2. `just promote-model <run>` is the only way a model reaches `apps/mobile/assets/models/`
   (SUD-06). It:
   - checks the run against the [model contract](../00-concepts/model-contract.md),
   - evaluates it on `fixtures/scans`, and **refuses** it if grid-exact accuracy or kind accuracy
     is worse than the current model's,
   - refuses it if the int8 model loses more than 0.2 percentage points cell accuracy against its
     float version,
   - copies the `.tflite` with its version in the filename and rewrites `manifest.json`.
3. The promotion is a normal commit: `feat(model): cell-classifier 1.2.0, grid-exact 96 % → 97 %`.

## Consequences

- `git log apps/mobile/assets/models` is the model's release history.
- Fixtures become the most valuable data in the repo. They are never used for training.

## Reassessment Triggers

- A model grows past a few MB. Move to LFS or Release assets.
- The backend exists and over-the-air model updates are wanted.
