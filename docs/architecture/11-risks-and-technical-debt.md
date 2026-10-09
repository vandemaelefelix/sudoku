---
status: DRAFT
---

# 11. Risks and Technical Debt

## Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| R-01 | **fast-opencv is young.** One maintainer. Its iOS build fails on some React Native setups (issue #117, fix #119 not merged). It has no `cornerSubPix`. | High | Medium | The walking skeleton checks the build first (ADR-002). Fallback: patch-package with #119. The scanner interface lets one step move to Swift without touching the app. |
| R-02 | **PyTorch → TFLite export** through litert-torch (formerly ai-edge-torch) fails or drifts numerically. | High | Low | Checked on the Python side before M0 (ADR-005). float32 only. The export compares TFLite with PyTorch on every run. Fallbacks: ONNX → TFLite, or Keras for the export only. |
| R-03 | **Handwriting data is scarce.** EMNIST does not look like pen in a printed cell, and own handwriting arrives slowly. | Medium | High | Heavy augmentation, the given / mine toggle in the correction screen, and the training-data export (F-11). Kind mistakes are cheap to correct (ADR-006). |
| R-04 | **Real training data lives on one laptop** until DVC is adopted. | High | Medium | Back up `ml/data/` (Time Machine plus an off-site copy) as soon as possible. DVC when the trigger in ADR-009 fires. |
| R-05 | **Jittery outline or late lock-on** makes scanning feel broken even when recognition is good. | Medium | Medium | Smoothing and lock-on tuned in the walking skeleton, on purpose, with QR-06 as the target. |
| R-06 | **Strongly curved book pages** defeat per-cell flattening. | Medium | Medium | Measured with book-page fixtures (QR-02). The intersection model (F-12) is the planned answer, not more classical maths. |
| R-07 | **Scope creep on a side project.** Backend, Android and a second model all look tempting. | Medium | High | Order of work in [04](04-solution-strategy.md). The game ships first and is useful without the scanner. |
| R-08 | **Native-module upgrades break together.** Expo SDK, VisionCamera, Skia, fast-opencv and fast-tflite have to move in step. | Medium | Medium | Upgrade on a branch, all at once, with the fixture-based scanner tests as the safety net. |
| R-10 | **Publishing data we may not publish** when the repo goes public: copyrighted newspaper and book photos, font files, datasets with unclear terms. | Medium | Medium | Public-safe fixtures only, real-world scans private, provenance per source ([ADR-013](adr/adr-013-fixtures-and-data-licensing.md)). |
| R-11 | **Stale fixture cell images.** The capture stage changes but the committed cell images still come from the old scanner, so the promote gate scores the wrong thing. | Medium | Medium | `scanner.json` records the scanner version. Promote refuses stale cell images ([ADR-010](adr/adr-010-testing-and-ci.md)). |
| R-12 | **The iOS TFLite runtime is frozen at 2.17.** `react-native-fast-tflite` bundles the last TFLite published for iOS. A newer converter can emit an op version that 2.17 does not know. | High | Low | float32 only. Promote checks every op version against 2.17 (model contract). |
| R-13 | **Wrong labels in the training data**, about 0.6 % of the real cells. They cap the measured accuracy and teach the model mistakes. | Medium | High | The `just suspects` tool exists (#4). It lists the most likely wrong labels for a check by hand. The label check and the retrain are still open. The developer deferred them. |
| R-14 | **Validation leaks.** Cells cut from the same photo look alike, so a random split puts near-twins in training and validation and flatters the numbers. | Medium | High | Split by groups of near-identical cells now (#4). Split by photo once cells carry a scan id. |

## Technical Debt

None yet. Debt taken on deliberately is recorded here with the ADR or ticket that will pay it off.
