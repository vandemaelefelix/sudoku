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
0.99⁸¹ ≈ 44 % of grids come out fully correct, and one wrong digit breaks the puzzle
(see [10 §10.2](../10-quality-requirements.md)).

Fixtures are photos. Scoring a model on photos would need the whole capture stage (corners,
intersections, per-cell flatten) in Python as well, a second implementation of the scanner. So
the gate scores the **classifier** on cell images that the **app's** scanner produced from each
fixture photo. The capture stage is tested separately, on the device ([ADR-010](adr-010-testing-and-ci.md)).

## Alternatives Evaluated

### How the model reaches the app

| Option | For | Against |
| --- | --- | --- |
| **Copy the chosen run into the app folder and commit it** | Versioned with the code. Reviewable. Rollback is `git revert`. Works offline | Binary in git. Fine below a few MB |
| GitHub Release asset, downloaded at build time | Keeps binaries out of history | Build depends on the network and a release step |
| Git LFS | Large-binary support | Extra tooling for a file under 1 MB |
| Download at runtime | Update without an app release | Needs the backend (TC-3) |

### What the gate scores

| Option | For | Against |
| --- | --- | --- |
| Photos, with the capture stage re-implemented in Python | Scores the full pipeline | Two scanners that must stay identical |
| **The app's 81 cell images per fixture, committed** | One scanner. The classifier sees exactly what it sees on the phone | Cell images must be regenerated when the capture stage changes |

## Decision

1. **Fixture layout.** Each fixture is `fixtures/scans/<split>/<id>/` with `photo.jpg`,
   `truth.json` (81 digits and kinds) and `cells/00.png … 80.png`. The scanner wrote these cell
   images on the device, through the fixture runner (ADR-010), and `cells/scanner.json` records the
   scanner version that produced them. `<split>` is `dev` or `holdout`.
2. Training runs land in `ml/artifacts/<run>/` (gitignored).
3. `just promote-model <run>` is the only way a model reaches `apps/mobile/assets/models/`
   (SUD-06). It:
   - checks the run against the [model contract](../00-concepts/model-contract.md) and refuses a
     contract major version the scanner does not implement (SUD-09),
   - scores the model on the **dev** split's cell images,
   - refuses it below the **absolute floor**: the QR-01 / QR-02 / QR-03 targets, once the fixture
     set is big enough (10 §10.2),
   - refuses it if it is **worse than the current model by more than one fixture grid** on
     either split's digit grid-exact score. For the first model only the floor applies,
   - copies the model as `cell-classifier.tflite` and rewrites `manifest.json`.
4. **Holdout.** The holdout split is not looked at while training. It is scored when promote
   runs, recorded in the manifest, and only reviewed when deciding a release. This keeps the
   repeated choice of "the best run on dev" from fitting the gate.
5. The promotion is a normal commit: `feat(model): cell-classifier 1.2.0, dev grid-exact 96 % → 97 %`.

## Amendment: M0 install and private models (2026-10-11)

- Until `just promote-model` exists (M3), `just install-model <run>` copies an exported run into
  `apps/mobile/assets/models/` without the gate. It checks the contract major version (SUD-09).
  It writes a reduced manifest: model, version, contract, file, outputs, run, metrics and
  `installedAt`. Promote adds the fixture scores and the holdout.
- A model trained on data that may not be published stays out of git (ADR-013). The `.tflite`
  file is git-ignored. `manifest.json` and `reference-outputs.json` are in git. A clone without
  the model file does not bundle. Run `just install-model` first. CI bundles with an empty
  placeholder model file.
- Consequence: `git log apps/mobile/assets/models` shows the manifest history, not the model
  bytes. The run name in the manifest points to the run in `ml/artifacts/`.
- SUD-06 has this M0 exception. The exception ends when `just promote-model` exists.

## Consequences

- `git log apps/mobile/assets/models` is the model's release history.
- When the capture stage changes, the fixture runner regenerates all cell images in one commit,
  and the current model is re-scored on them before anything else is promoted.
- Fixtures become the most valuable data in the repo. They are never used for training (SUD-10).

## Reassessment Triggers

- A model grows past a few MB. Move to LFS or Release assets.
- The backend exists and over-the-air model updates are wanted.
