---
status: DRAFT
---

# 9. Architecture Decisions

## Active ADRs

| ID | Decision | Status | Date | Link |
|----|----------|--------|------|------|
| ADR-001 | Polyglot monorepo: pnpm workspaces (TypeScript), uv (Python), root `justfile`. Turborepo deferred | Proposed | 2026-10-09 | [ADR-001](./adr/adr-001-polyglot-monorepo.md) |
| ADR-002 | React Native (Expo, Continuous Native Generation) + VisionCamera. Scanner on fast-opencv and fast-tflite, a Swift plugin per step only where those fail | Proposed, pending the device spike | 2026-10-09 | [ADR-002](./adr/adr-002-react-native-and-scanner-engine.md) |
| ADR-003 | All inference on the device. Nothing leaves the phone without an explicit user action | Proposed | 2026-10-09 | [ADR-003](./adr/adr-003-on-device-inference.md) |
| ADR-004 | Two-stage scan pipeline: live 4-corner lock-on, per-cell flatten from 100 intersections on capture | Proposed | 2026-10-09 | [ADR-004](./adr/adr-004-two-stage-scan-pipeline.md) |
| ADR-005 | PyTorch on MPS, exported to TFLite with ai-edge-torch, float weights (no int8 in v1) | Proposed, pending the device spike | 2026-10-09 | [ADR-005](./adr/adr-005-pytorch-to-tflite.md) |
| ADR-006 | One cell classifier with two heads: digit (`empty`, 1–9) and kind (`none`, `printed`, `handwritten`, `notes`) | Proposed | 2026-10-09 | [ADR-006](./adr/adr-006-two-head-cell-classifier.md) |
| ADR-007 | Models reach the app only through `just promote-model`: scored on the app's cell images per fixture, absolute floor plus tolerance, holdout split, stable filename with version in the manifest | Proposed | 2026-10-09 | [ADR-007](./adr/adr-007-model-promotion.md) |
| ADR-008 | `@sudoku/core` as an internal workspace package. The scanner as a module inside the app with one entry point. Boundaries enforced by lint | Proposed | 2026-10-09 | [ADR-008](./adr/adr-008-package-boundaries.md) |
| ADR-009 | Training images outside git, a versioned dataset manifest inside. DVC as the next step | Proposed | 2026-10-09 | [ADR-009](./adr/adr-009-training-data-outside-git.md) |
| ADR-010 | Testing in four layers (Vitest, Jest, on-device fixture runner, pytest). CI on Linux, path-filtered, no iOS build | Proposed | 2026-10-09 | [ADR-010](./adr/adr-010-testing-and-ci.md) |
| ADR-011 | On-device generation. A technique solver grades difficulty and gives hints, with reveal-a-cell as fallback. A pool of 3 per level | Proposed | 2026-10-09 | [ADR-011](./adr/adr-011-puzzle-generation-and-hints.md) |
| ADR-012 | expo-sqlite behind repository interfaces, sync-ready rows, progress saved on every move | Proposed | 2026-10-09 | [ADR-012](./adr/adr-012-local-persistence.md) |
| ADR-013 | Public-safe fixtures in git, real-world scans private, provenance and licence per data source, App Store privacy items | Proposed | 2026-10-09 | [ADR-013](./adr/adr-013-fixtures-and-data-licensing.md) |
