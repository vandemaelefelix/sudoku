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

Ordered by impact. Hard cap 20. Currently 9.

| ID | Constraint | Impact | Since | Owner | Source |
| --- | --- | --- | --- | --- | --- |
| SUD-01 | The game and the scanner MUST work fully without a network connection. | Systemic | 2026-10-09 | Felix | [ADR-003](adr/adr-003-on-device-inference.md) |
| SUD-02 | Camera frames and photos MUST NOT leave the device. | Systemic | 2026-10-09 | Felix | [ADR-003](adr/adr-003-on-device-inference.md) |
| SUD-07 | `ml/` and the TypeScript side MUST share files only: `contracts/`, `fixtures/` and the promoted model. Neither imports the other. | Systemic | 2026-10-09 | Felix | [ADR-001](adr/adr-001-polyglot-monorepo.md) |
| SUD-06 | A model MUST reach the app only through `just promote-model`, which gates on fixture scores. | Cross-concept | 2026-10-09 | Felix | [ADR-007](adr/adr-007-model-promotion.md) |
| SUD-09 | The app MUST refuse a model whose contract major version it does not implement. | Cross-concept | 2026-10-09 | Felix | [model-contract](00-concepts/model-contract.md) |
| SUD-04 | `@sudoku/core` MUST NOT depend on React Native, Expo or any I/O. | Cross-concept | 2026-10-09 | Felix | [ADR-008](adr/adr-008-package-boundaries.md) |
| SUD-03 | The game MUST NOT depend on the scanner. Scanning is an optional way into a puzzle. | Concept | 2026-10-09 | Felix | [ADR-008](adr/adr-008-package-boundaries.md) |
| SUD-05 | The app MUST reach the scanner only through `src/scanner/index.ts`. | Concept | 2026-10-09 | Felix | [scan-pipeline](00-concepts/scan-pipeline.md) |
| SUD-08 | Training images MUST NOT be committed. `fixtures/scans` is the one exception. | Concept | 2026-10-09 | Felix | [ADR-009](adr/adr-009-training-data-outside-git.md) |

## Decisions

### Platform and repository

| ID | Decision | Impact | Since | Owner | Source |
| --- | --- | --- | --- | --- | --- |
| ADR-001 | One repo, pnpm + Turborepo for TypeScript, uv for Python, a root `justfile`. | Systemic | 2026-10-09 | Felix | [ADR-001](adr/adr-001-polyglot-monorepo.md) |
| ADR-002 | React Native (Expo) + VisionCamera. fast-opencv and fast-tflite by default, a Swift plugin per failing step. **Pending the device spike.** | Systemic | 2026-10-09 | Felix | [ADR-002](adr/adr-002-react-native-and-scanner-engine.md) |
| ADR-008 | `@sudoku/core` is an internal package. The scanner is a module inside the app. | Cross-concept | 2026-10-09 | Felix | [ADR-008](adr/adr-008-package-boundaries.md) |

### Scanning and ML

| ID | Decision | Impact | Since | Owner | Source |
| --- | --- | --- | --- | --- | --- |
| ADR-003 | All inference on the device. | Systemic | 2026-10-09 | Felix | [ADR-003](adr/adr-003-on-device-inference.md) |
| ADR-004 | Two stages: 4 corners live, per-cell flatten from 100 intersections on capture. | Concept | 2026-10-09 | Felix | [ADR-004](adr/adr-004-two-stage-scan-pipeline.md) |
| ADR-005 | PyTorch on MPS, exported to TFLite with ai-edge-torch. **Pending the device spike.** | Cross-concept | 2026-10-09 | Felix | [ADR-005](adr/adr-005-pytorch-to-tflite.md) |
| ADR-006 | One cell classifier, two heads: digit and kind (printed, handwritten, notes). | Concept | 2026-10-09 | Felix | [ADR-006](adr/adr-006-two-head-cell-classifier.md) |
| ADR-007 | Gated `promote` step, model committed with a manifest. | Cross-concept | 2026-10-09 | Felix | [ADR-007](adr/adr-007-model-promotion.md) |
| ADR-009 | Images outside git, a dataset manifest inside. DVC later. | Concept | 2026-10-09 | Felix | [ADR-009](adr/adr-009-training-data-outside-git.md) |
