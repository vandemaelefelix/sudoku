---
status: DRAFT
---

# 11. Risks and Technical Debt

## Risks

| ID | Risk | Impact | Probability | Mitigation |
|----|------|--------|-------------|------------|
| R-01 | **fast-opencv is young.** One maintainer. It has no `cornerSubPix`. In 1.0.1, `getPerspectiveTransform` does not work, because `Point2fVector.create` ignores its points (ADR-002). | High | Low | Checked 2026-10-22: fast-opencv 1.0.1 builds on iOS, and its issue #117 does not apply to React Native 0.86.3 (ADR-002). No patch is needed. Our own TypeScript computes the homography (`mobile/src/utils/homography.utils.ts`). The scanner interface lets one step move to Swift without touching the app. |
| R-02 | **PyTorch → TFLite export** through litert-torch (formerly ai-edge-torch) fails or drifts numerically. | High | Low | Checked on the Python side before M0 (ADR-005). float32 only. The export compares TFLite with PyTorch on every run. Fallbacks: ONNX → TFLite, or Keras for the export only. |
| R-03 | **Handwriting data is scarce.** EMNIST does not look like pen in a printed cell, and own handwriting arrives slowly. | Medium | High | Heavy augmentation, the given / mine toggle in the correction screen, and the training-data export (F-11). Kind mistakes are cheap to correct (ADR-006). |
| R-04 | **Real training data lives on one laptop** until DVC is adopted. | High | Medium | Back up the image store, `ml/dataset/images/` or the folder that `SUDOKU_IMAGES` names (Time Machine plus an off-site copy) as soon as possible. DVC when the trigger in ADR-009 fires. Checked 2026-10-22: no backup is on record. Time Machine has no destination on the development Mac. `ml/dataset/README.md` still calls the image store the only copy. |
| R-05 | **Jittery outline or late lock-on** makes scanning feel broken even when recognition is good. | Medium | Medium | Smoothing and lock-on tuned in the walking skeleton, on purpose, with QR-06 as the target. |
| R-06 | **Strongly curved book pages** defeat per-cell flattening. | Medium | Medium | Measured with book-page fixtures (QR-02). The intersection model (F-12) is the planned answer, not more classical maths. |
| R-07 | **Scope creep on a side project.** Backend, Android and a second model all look tempting. | Medium | High | Order of work in [04](04-solution-strategy.md). The game ships first and is useful without the scanner. |
| R-08 | **Native-module upgrades break together.** Expo SDK, VisionCamera, Skia, fast-opencv and fast-tflite have to move in step. | Medium | Medium | Upgrade on a branch, all at once, with the fixture-based scanner tests as the safety net. The `ios-simulator` workflow builds the native app in CI when a native input changes ([ADR-010](adr/adr-010-testing-and-ci.md), amendment 2026-10-22). |
| R-10 | **Publishing data we may not publish** when the repo goes public: copyrighted newspaper and book photos, font files, datasets with unclear terms. | Medium | Medium | Public-safe fixtures only, real-world scans private, provenance per source ([ADR-013](adr/adr-013-fixtures-and-data-licensing.md)). |
| R-11 | **Stale fixture cell images.** The capture stage changes but the committed cell images still come from the old scanner, so the promote gate scores the wrong thing. | Medium | Medium | `scanner.json` records the scanner version. Promote refuses stale cell images ([ADR-010](adr/adr-010-testing-and-ci.md)). |
| R-12 | **The iOS TFLite runtime is frozen at 2.17.** `react-native-fast-tflite` bundles the last TFLite published for iOS. A newer converter can emit an op version that 2.17 does not know. | High | Low | float32 only. Promote checks every op version against 2.17 (model contract). |
| R-13 | **Wrong labels in the training data**, about 0.6 % of the real cells. They cap the measured accuracy and teach the model mistakes. | Medium | High | The `just suspects` tool ranks the likely wrong digit and kind labels. The Review screen of the labelling page (`just label-cells`) is the label check. Checked 2026-10-22: the relabel and the retrain are still open (#14). |
| R-14 | **Validation leaks.** Cells cut from the same photo look alike, so a random split puts near-twins in training and validation and flatters the numbers. | Medium | High | Split by groups of near-identical cells now (#4). Split by photo once cells carry a scan id. |
| R-15 | **A misuse of the API runs up the AWS bill.** A script with a valid account or many fake accounts. | Medium | Low | SUD-11: a stage throttle, a daily write count per player, Clerk bot protection and email check, budget alerts and a kill switch ([ADR-027](adr/adr-027-backend-platform.md)). |
| R-16 | **Clerk changes or ends its free plan.** The accounts live at Clerk. | Medium | Low | Our own user ID behind identity rows. A move needs a user import and new identity rows, the game data stays ([ADR-027](adr/adr-027-backend-platform.md)). |

## Technical Debt

Debt taken on deliberately is recorded here with the ADR or issue that will pay it off. "No issue
yet" means that the work needs an issue first. "Not planned" means that the developer chose not to pay
it off. The debt stays known.

| ID | Debt | Paid off by |
|----|------|-------------|
| TD-01 | The cell classifier trains on labels with known errors, about 0.6 % of the real cells. See R-13. | #14: review the suspects, relabel and retrain |
| TD-02 | The play grid is heavy to render: many native views, an animation on every cell, a selection on release. | Not planned. Known debt with no issue |
| TD-03 | The capture flattens the whole grid from its 4 corners, not each cell from its own corners. On a curved page, grid lines can enter the cells. See [ADR-004](adr/adr-004-two-stage-scan-pipeline.md). | #74 |
| TD-04 | No promote gate. `just install-model` copies a model without fixture scores. This is the exception of SUD-06. See [ADR-007](adr/adr-007-model-promotion.md). | No issue yet: `just promote-model` |
| TD-05 | No fixture runner and no public fixture set. No test runs the real scanner on fixture photos. See [ADR-010](adr/adr-010-testing-and-ci.md), [ADR-013](adr/adr-013-fixtures-and-data-licensing.md). | No issue yet |
| TD-06 | Training does not filter by licence. So every model trained on real cells stays private. See [`ml/DATA_SOURCES.md`](../../ml/DATA_SOURCES.md). | No issue yet |
| TD-07 | No pool of ready puzzles. On the iPhone, the slowest expert puzzles can take more than 1 s to generate. See [ADR-011](adr/adr-011-puzzle-generation-and-hints.md). | The iPhone check of #204 |
| TD-08 | No Sign in with Apple. App Store guideline 4.8 can require it before a submission. See [ADR-027](adr/adr-027-backend-platform.md), amendment "the production release". | #111 |
| TD-09 | After a switch of sign-in provider, the app does not adopt the history entries of the old owner. See [ADR-028](adr/adr-028-history-sync.md), amendment "delete the account". | No issue yet |
