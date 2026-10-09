---
status: DRAFT
---

# 4. Solution Strategy

| Goal or constraint | Approach | Decision |
| --- | --- | --- |
| One project, two toolchains (OC-1) | Polyglot monorepo. pnpm workspaces for TypeScript, uv for Python, one `justfile` at the root for both | [ADR-001](adr/adr-001-polyglot-monorepo.md) |
| Smooth live scanning (QG 2) with known tech (TC-2) | React Native (Expo) with VisionCamera frame processors. Vision work runs natively off the JS thread, through community libraries first, a Swift plugin per step only where those fall short | [ADR-002](adr/adr-002-react-native-and-scanner-engine.md) |
| Offline and private (QG 3, TC-3) | All inference on the device. Nothing leaves the phone without an explicit user action | [ADR-003](adr/adr-003-on-device-inference.md) |
| Curved pages "to some level", without over-engineering | Two stages: a cheap 4-corner lock-on live, then on capture a per-cell flatten from the 100 grid intersections | [ADR-004](adr/adr-004-two-stage-scan-pipeline.md) |
| Learn the current ML stack (OC-2), train on a Mac (TC-4) | PyTorch on MPS, exported to TFLite (LiteRT) | [ADR-005](adr/adr-005-pytorch-to-tflite.md) |
| Resume half-filled book puzzles (F-05) | One small CNN with two heads: digit and kind | [ADR-006](adr/adr-006-two-head-cell-classifier.md) |
| Recognition correctness (QG 1) | Models reach the app only through a gated promote step, scored on whole fixture grids | [ADR-007](adr/adr-007-model-promotion.md) |
| Understandable boundaries (QG 4), backend later (TC-3) | Game logic as a pure TS package. The scanner as a module inside the app with one entry point | [ADR-008](adr/adr-008-package-boundaries.md) |
| Datasets that grow without bloating git | Images outside git, a versioned manifest inside. DVC later | [ADR-009](adr/adr-009-training-data-outside-git.md) |
| Native code that Jest cannot run (OC-1) | Four test layers. The real scanner is tested on the phone by a fixture runner. CI on Linux only | [ADR-010](adr/adr-010-testing-and-ci.md) |
| Puzzles and hints (F-01, F-07, QR-12) | Generate on the device. One technique solver grades and gives hints. A small pool for instant start | [ADR-011](adr/adr-011-puzzle-generation-and-hints.md) |
| Never lose progress (QR-11), sync later | expo-sqlite behind repository interfaces, sync-ready rows | [ADR-012](adr/adr-012-local-persistence.md) |
| A public portfolio repo later | Public-safe fixtures, real-world scans private, licence per data source | [ADR-013](adr/adr-013-fixtures-and-data-licensing.md) |

## Order of work

1. **Device spike** (throwaway). Proves the two Proposed bets on a real iPhone: live 4-corner
   outline at 30 fps or more through VisionCamera and fast-opencv, and a tiny PyTorch model
   exported to TFLite running through fast-tflite. Its result moves ADR-002 and ADR-005 to
   Accepted or replaces them. Pass criteria are in ADR-002 and ADR-005.
2. **Game first.** `@sudoku/core` (generator, solvers, grader, hints), local storage and the
   playable app. Useful on day one without any ML.
3. **Scanner, classical.** Live lock-on, capture, per-cell flatten, a first classifier trained on
   existing and synthetic data, the correction screen.
4. **Data loop.** Fixture set, training-data export, retraining, the promote gate.
5. **Only if needed.** An ML model for grid intersections (F-12), Android (F-13), the backend.
