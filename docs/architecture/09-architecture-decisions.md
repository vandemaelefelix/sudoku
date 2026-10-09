---
status: DRAFT
---

# 9. Architecture Decisions

## Active ADRs

| ID | Decision | Status | Date | Link |
|----|----------|--------|------|------|
| ADR-001 | Polyglot monorepo: pnpm + Turborepo (TypeScript), uv (Python), root `justfile` | Proposed | 2026-10-09 | [ADR-001](./adr/adr-001-polyglot-monorepo.md) |
| ADR-002 | React Native (Expo) + VisionCamera. Scanner on fast-opencv and fast-tflite, a Swift plugin per step only where those fail | Proposed, pending the device spike | 2026-10-09 | [ADR-002](./adr/adr-002-react-native-and-scanner-engine.md) |
| ADR-003 | All inference on the device. No cloud inference, no photo leaves the phone | Proposed | 2026-10-09 | [ADR-003](./adr/adr-003-on-device-inference.md) |
| ADR-004 | Two-stage scan pipeline: live 4-corner lock-on, per-cell flatten from 100 intersections on capture | Proposed | 2026-10-09 | [ADR-004](./adr/adr-004-two-stage-scan-pipeline.md) |
| ADR-005 | PyTorch on MPS, exported to TFLite with ai-edge-torch, int8 quantised | Proposed, pending the device spike | 2026-10-09 | [ADR-005](./adr/adr-005-pytorch-to-tflite.md) |
| ADR-006 | One cell classifier with two heads: digit (`empty`, 1–9) and kind (`none`, `printed`, `handwritten`, `notes`) | Proposed | 2026-10-09 | [ADR-006](./adr/adr-006-two-head-cell-classifier.md) |
| ADR-007 | Models reach the app only through `just promote-model`, gated on whole-grid fixture accuracy, committed with a manifest | Proposed | 2026-10-09 | [ADR-007](./adr/adr-007-model-promotion.md) |
| ADR-008 | `@sudoku/core` as an internal workspace package. The scanner as a module inside the app with one entry point | Proposed | 2026-10-09 | [ADR-008](./adr/adr-008-package-boundaries.md) |
| ADR-009 | Training images outside git, a versioned dataset manifest inside. DVC as the next step | Proposed | 2026-10-09 | [ADR-009](./adr/adr-009-training-data-outside-git.md) |
