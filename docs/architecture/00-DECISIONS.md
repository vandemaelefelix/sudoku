---
status: DRAFT
---

# Decisions and constraints, Sudoku

Constraints bind: a change that violates one stops the solution from being sound. Decisions
inform: they record what was chosen and hold until re-decided. This file is an index. The
reasoning lives on the source named in each row. Accepted constraints from outside are in
[02-architecture-constraints](02-architecture-constraints.md), quality targets in
[10-quality-requirements](10-quality-requirements.md).

## Constraints

Ordered by impact. Hard cap 20. Currently 10.

| ID | Constraint | Impact | Since | Owner | Source |
| --- | --- | --- | --- | --- | --- |
| SUD-01 | The game and the scanner MUST work fully without a network connection. | Systemic | 2026-10-09 | Felix | [ADR-003](adr/adr-003-on-device-inference.md) |
| SUD-02 | Camera frames, photos and cell images MUST NOT leave the device without an explicit user action for each export. | Systemic | 2026-10-09 | Felix | [ADR-003](adr/adr-003-on-device-inference.md) |
| SUD-07 | `ml/` and the TypeScript side MUST share files only: `contracts/`, `fixtures/` and the promoted model. Neither imports the other. | Systemic | 2026-10-09 | Felix | [ADR-001](adr/adr-001-polyglot-monorepo.md) |
| SUD-06 | A model MUST reach the app only through `just promote-model`, which gates on fixture scores. | Cross-concept | 2026-10-09 | Felix | [ADR-007](adr/adr-007-model-promotion.md) |
| SUD-09 | Promote and the test suite MUST refuse a model whose contract major version the scanner does not implement. | Cross-concept | 2026-10-09 | Felix | [model-contract](00-concepts/model-contract.md) |
| SUD-10 | Fixture cells MUST NOT appear in any training dataset. | Cross-concept | 2026-10-09 | Felix | [model-contract](00-concepts/model-contract.md) |
| SUD-04 | `@sudoku/core` MUST NOT depend on React Native, Expo or any I/O. | Cross-concept | 2026-10-09 | Felix | [ADR-008](adr/adr-008-package-boundaries.md) |
| SUD-03 | The game MUST NOT depend on the scanner. Scanning is an optional way into a puzzle. | Concept | 2026-10-09 | Felix | [ADR-008](adr/adr-008-package-boundaries.md) |
| SUD-05 | The app MUST reach the scanner only through `src/scanner/index.ts`. | Concept | 2026-10-09 | Felix | [scan-pipeline](00-concepts/scan-pipeline.md) |
| SUD-08 | Training images and private fixtures MUST NOT be committed. The public `fixtures/scans` set is the one exception. | Concept | 2026-10-09 | Felix | [ADR-009](adr/adr-009-training-data-outside-git.md), [ADR-013](adr/adr-013-fixtures-and-data-licensing.md) |

SUD-03, SUD-04 and SUD-05 are checked in CI by lint rules ([ADR-010](adr/adr-010-testing-and-ci.md)).

## Decisions

### Platform and repository

| ID | Decision | Impact | Since | Owner | Source |
| --- | --- | --- | --- | --- | --- |
| ADR-001 | One repo, pnpm workspaces for TypeScript, uv for Python, a root `justfile`. Turborepo only when it pays. | Systemic | 2026-10-09 | Felix | [ADR-001](adr/adr-001-polyglot-monorepo.md) |
| ADR-002 | React Native (Expo, CNG) + VisionCamera 5. fast-opencv and fast-tflite by default, a Swift plugin per failing step. **Pending the walking skeleton (M0).** | Systemic | 2026-10-09 | Felix | [ADR-002](adr/adr-002-react-native-and-scanner-engine.md) |
| ADR-008 | `@sudoku/core` is an internal package. The scanner is a module inside the app. Boundaries enforced by lint. | Cross-concept | 2026-10-09 | Felix | [ADR-008](adr/adr-008-package-boundaries.md) |
| ADR-010 | Four test layers. The real scanner is tested on the phone by a fixture runner. CI on Linux, no iOS build. | Cross-concept | 2026-10-09 | Felix | [ADR-010](adr/adr-010-testing-and-ci.md) |

### Game

| ID | Decision | Impact | Since | Owner | Source |
| --- | --- | --- | --- | --- | --- |
| ADR-011 | Generate on the device. A technique solver grades difficulty and gives hints. A pool of 3 per level for instant start. | Concept | 2026-10-09 | Felix | [ADR-011](adr/adr-011-puzzle-generation-and-hints.md) |
| ADR-012 | expo-sqlite behind repository interfaces. UUIDs, timestamps and soft delete, so sync can come later. | Concept | 2026-10-09 | Felix | [ADR-012](adr/adr-012-local-persistence.md) |

### Scanning and ML

| ID | Decision | Impact | Since | Owner | Source |
| --- | --- | --- | --- | --- | --- |
| ADR-003 | All inference on the device. | Systemic | 2026-10-09 | Felix | [ADR-003](adr/adr-003-on-device-inference.md) |
| ADR-004 | Two stages: 4 corners live, per-cell flatten from 100 intersections on capture. | Concept | 2026-10-09 | Felix | [ADR-004](adr/adr-004-two-stage-scan-pipeline.md) |
| ADR-005 | PyTorch on MPS, exported to TFLite with litert-torch, float32 weights only. **Pending the walking skeleton (M0).** | Cross-concept | 2026-10-09 | Felix | [ADR-005](adr/adr-005-pytorch-to-tflite.md) |
| ADR-006 | One cell classifier, two heads: digit and kind (printed, handwritten, notes). A global-average-pooling CNN of about 73k parameters. | Concept | 2026-10-09 | Felix | [ADR-006](adr/adr-006-two-head-cell-classifier.md) |
| ADR-007 | Gated promote step, scored on the app's own cell images per fixture, with a floor, a tolerance and a holdout split. Until M3, `just install-model` copies a run without the gate. A model trained on unpublishable data stays out of git. | Cross-concept | 2026-10-09 | Felix | [ADR-007](adr/adr-007-model-promotion.md) |
| ADR-009 | Images outside git, a dataset manifest inside. DVC later. | Concept | 2026-10-09 | Felix | [ADR-009](adr/adr-009-training-data-outside-git.md) |
| ADR-013 | Public-safe fixtures in git, real-world scans private, a licence on record for every data source. | Concept | 2026-10-09 | Felix | [ADR-013](adr/adr-013-fixtures-and-data-licensing.md) |
| ADR-014 | Live overlay effects are modules on one engine and one scene. Development builds have an effect lab with a dev pill. Release builds run the default effect only. | Concept | 2026-10-11 | Felix | [ADR-014](adr/adr-014-overlay-effects.md) |
