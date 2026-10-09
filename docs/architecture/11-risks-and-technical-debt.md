---
status: DRAFT
---

# 11. Risks and Technical Debt

## Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| R-01 | **fast-opencv is young.** Its API covers a subset of OpenCV, buffers are released by hand, and it depends on a small group of maintainers. | High | Medium | The device spike checks coverage and memory (ADR-002). The scanner interface lets one step move to Swift without touching the app. |
| R-02 | **PyTorch → TFLite export** through ai-edge-torch fails or drifts numerically. | High | Low | Verified in the spike on the real device (ADR-005). Float weights only, no int8. Fallbacks: ONNX → TFLite, or Keras for the export only. |
| R-03 | **Handwriting data is scarce.** EMNIST does not look like pen in a printed cell, and own handwriting arrives slowly. | Medium | High | Heavy augmentation, the given / mine toggle in the correction screen, and the training-data export (F-11). Kind mistakes are cheap to correct (ADR-006). |
| R-04 | **Real training data lives on one laptop** until DVC is adopted. | High | Medium | Back up `ml/data/` (Time Machine plus an off-site copy) from the day the legacy cells are copied in. DVC when the trigger in ADR-009 fires. |
| R-05 | **Jittery outline or late lock-on** makes scanning feel broken even when recognition is good. | Medium | Medium | Smoothing and lock-on tuned in the spike, on purpose, with QR-06 as the target. |
| R-06 | **Strongly curved book pages** defeat per-cell flattening. | Medium | Medium | Measured with book-page fixtures (QR-02). The intersection model (F-12) is the planned answer, not more classical maths. |
| R-07 | **Scope creep on a side project.** Backend, Android and a second model all look tempting. | Medium | High | Order of work in [04](04-solution-strategy.md). The game ships first and is useful without the scanner. |
| R-08 | **Native-module upgrades break together.** Expo SDK, VisionCamera, Skia, fast-opencv and fast-tflite have to move in step. | Medium | Medium | Upgrade on a branch, all at once, with the fixture-based scanner tests as the safety net. |
| R-09 | **The only copy of the legacy labelled cells is an unversioned local folder** of the v2 project, together with unpushed work. | High | Low | Copy the cells into `ml/data/` and back them up before archiving or deleting anything. |
| R-10 | **Publishing data we may not publish** when the repo goes public: copyrighted newspaper and book photos, font files, datasets with unclear terms. | Medium | Medium | Public-safe fixtures only, real-world scans private, provenance per source ([ADR-013](adr/adr-013-fixtures-and-data-licensing.md)). |
| R-11 | **Stale fixture cell images.** The capture stage changes but the committed cell images still come from the old scanner, so the promote gate scores the wrong thing. | Medium | Medium | `scanner.json` records the scanner version. Promote refuses stale cell images ([ADR-010](adr/adr-010-testing-and-ci.md)). |

## Technical Debt

None yet. Debt taken on deliberately is recorded here with the ADR or ticket that will pay it off.
