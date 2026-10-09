---
status: DRAFT
concept: model-contract
---

# Model contract

## Why

The model is trained in Python and run in the app. The two sides never import each other, so
the only thing that keeps them in agreement is this contract. A mismatch, such as inverted
colours, a different crop or a reordered class list, does not crash anything. It silently makes
every scan wrong. The contract makes those details explicit, versioned and checked.

## What

The cell classifier takes one cell image and returns two answers: which digit (or empty), and
what kind of mark it is. The app sends all 81 cells in one batch. Every promoted model ships with
a manifest that states which contract version it implements. Promote and the test suite refuse a
model whose contract the app does not implement, so a mismatch never reaches a build.

## Input

The scanner's per-cell flatten ([scan-pipeline](scan-pipeline.md)) produces one **cell image**:
64 × 64 px, RGB, upright. This contract starts from that image.

| Step | Exact rule |
| --- | --- |
| 1. Grayscale | `gray = 0.299 R + 0.587 G + 0.114 B` (ITU-R BT.601), on 8-bit values |
| 2. Crop | Rows and columns `[6, 58)` of the 64 × 64 image, giving 52 × 52. This drops the grid lines |
| 3. Resize | To 32 × 32 with area interpolation (OpenCV `INTER_AREA`) |
| 4. Polarity and range | `x = 1 − gray / 255`, as `float32`. Ink is near `1.0`, paper near `0.0`. Absolute, never normalised per cell |
| 5. Shape | `[N, 32, 32, 1]`, N = 81 in the app |

`ml/` and the scanner module each implement these steps. Both are tested against the same
reference pairs in `fixtures/preprocess/`: `<n>.cell.png` (a 64 × 64 cell image) and
`<n>.expected.json` (the 32 × 32 result). Every value must match within `1/255`.

## Model file

| Property | Value |
| --- | --- |
| Format | TFLite (LiteRT) |
| Weights | float32, or float16 if the export supports it cleanly. **No int8 in v1** ([ADR-005](../adr/adr-005-pytorch-to-tflite.md)) |
| Input and output dtype | `float32` |
| Softmax | Inside the model. Outputs are probabilities |
| Output identification | By signature output name, `digit` and `kind`. If the runtime exposes only tensor indices, `manifest.json` maps names to indices and the scanner reads that map. Tensor order is never assumed |

## Outputs

| Head | Shape | Classes, in this order |
| --- | --- | --- |
| `digit` | `[N, 10]` | `empty, 1, 2, 3, 4, 5, 6, 7, 8, 9` |
| `kind` | `[N, 4]` | `none, printed, handwritten, notes` |

Valid pairs: `empty` goes with `none` or `notes`. A digit goes with `printed` or `handwritten`.
The app treats an invalid pair as low confidence. A cell's confidence is the lower of the two
heads' top probabilities.

## Label format

Training data, the app's export (F-11) and fixtures use one format, so a corrected scan can flow
straight into a dataset.

```json
{
  "id": "sha256 of the image, see below",
  "source": "synthetic | photo | emnist | app-export | fixture",
  "digit": 7,
  "kind": "printed",
  "scan": "optional scan id, groups the 81 cells of one photo"
}
```

- The `id` is the SHA-256 of the text `<width>x<height>` followed by the image's RGB pixel bytes,
  row by row. An image keeps its own size in the id: the cells in `ml/data/cells/` are 71 × 71.
- A training dataset manifest MUST reject any entry with `source: fixture` (SUD-10). Fixtures are
  for evaluation only.
- `photo` means a cell cut from a sudoku photo in `ml/data/`. Its kind is not labelled yet.
  Cells in `ml/data/cells/unlabeled/` get a label by hand: `notes`, `empty` or a digit.

## Manifest

`apps/mobile/assets/models/manifest.json`, written only by `just promote-model` (ADR-007). The
model file keeps a **stable name**, `cell-classifier.tflite`, because React Native's bundler
needs a static `require()`. The version lives in the manifest only. `metro.config.js` lists
`tflite` in `assetExts`.

```json
{
  "model": "cell-classifier",
  "version": "1.0.0",
  "contract": "1.0",
  "file": "cell-classifier.tflite",
  "outputs": { "digit": 0, "kind": 1 },
  "trainedOn": "dataset manifest hash",
  "metrics": { "devDigitGridExact": 0.96, "devCellDigit": 0.9995, "devCellKind": 0.993 },
  "holdout": { "evaluatedAt": "2026-10-09", "digitGridExact": 0.95 },
  "promotedAt": "2026-10-09"
}
```

## Versioning

| Change | Contract | Model version |
| --- | --- | --- |
| Retrained, same inputs and outputs | unchanged | minor |
| New input size, preprocessing step, polarity or class list | major | major |
| New optional output the app may ignore | minor | minor |

The scanner declares the contract major versions it implements. Promote and a unit test refuse a
model outside that set (SUD-09). At runtime the scanner checks once more as a guard. On a
mismatch it disables scanning with a message instead of returning wrong digits.

## Open questions

| Question | Decided by |
| --- | --- |
| float16 weights: supported cleanly by the ai-edge-torch export and fast-tflite? | Walking skeleton (M0) |
| Signature output names: exposed by fast-tflite, or only indices? | Walking skeleton (M0) |
| Confidence threshold for "review this cell" | First real fixture set |

## Constraints

| ID | Constraint |
| --- | --- |
| SUD-06 | A model MUST reach the app only through `just promote-model`. |
| SUD-09 | Promote and the test suite MUST refuse a model whose contract major version the scanner does not implement. |
| SUD-10 | Fixture cells MUST NOT appear in any training dataset. |
