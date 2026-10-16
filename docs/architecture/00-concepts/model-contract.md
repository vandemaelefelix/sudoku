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
| 1. Grayscale | Convert the 8-bit values to float32, then `gray = 0.299 R + 0.587 G + 0.114 B` (ITU-R BT.601) in float32. No rounding |
| 2. Crop | None: the model reads the whole 64 × 64 image, rows and columns `[0, 64)`. The grid lines stay in the input (ADR-020). Contract 1 cropped `[6, 58)` |
| 3. Resize | To 32 × 32 with an exact area average, defined below |
| 4. Polarity and range | `x = 1 − gray / 255`, as `float32`. Ink is near `1.0`, paper near `0.0`. Absolute, never normalised per cell |
| 5. Shape | `[81, 32, 32, 1]`. The batch is static: always the 81 cells of one grid |

**Exact area average.** The resize from 64 × 64 to 32 × 32 is a weighted average. Output pixel `i`
covers the source interval `[i × 2, (i + 1) × 2)`. Weight `W[i][j]` is the overlap of
source pixel `j` (the interval `[j, j + 1)`) with that interval, divided by 2. The resized
image is `W · crop · Wᵀ`, with `W` a 32 × 64 matrix. Each output pixel is the mean of a 2 × 2 block. This definition is the normative one. OpenCV's
`INTER_AREA` on float32 computes the same thing within 4 × 10⁻⁵ gray levels (about 1.5 × 10⁻⁷
after step 4), so it serves as a check. Neither side needs OpenCV for this step.

`ml/` and the scanner module each implement these steps. Both are tested against the same
reference pairs in `shared/fixtures/preprocess/`: `<n>.cell.png` (a 64 × 64 cell image) and
`<n>.expected.json` (the 32 × 32 result). Every value must match within `1/255`. The scanner implements them in plain TypeScript on a
`Float32Array`, so the result does not depend on an OpenCV build.

## Model file

| Property | Value |
| --- | --- |
| Format | TFLite (LiteRT) |
| Weights | float32 in v1. No float16 and no int8 ([ADR-005](../adr/adr-005-pytorch-to-tflite.md)) |
| Runtime | TFLite 2.17, the version `react-native-fast-tflite` bundles on iOS. TFLite 2.17 must support every op and op version in the model. Export and promote check this |
| Delegate | CPU. `react-native-fast-tflite` does not support the Metal delegate |
| Input and output dtype | `float32` |
| Softmax | Inside the model. Outputs are probabilities |
| Output identification | By index. The phone runtime returns outputs in tensor order. Their names are not reliable identifiers. `manifest.json` records the index of `digit` and of `kind`, taken from the exported file. The scanner reads that map and checks the shapes `[81, 10]` and `[81, 4]` before it uses the outputs. The tensor names also contain `digit` and `kind`, for tools |
| Reference outputs | `reference-outputs.json`, written by the export next to the model. It holds the 81 reference cells as one input batch (base64, little-endian float32) and the PyTorch probabilities of both heads. The app compares the phone's outputs with it (ADR-005) |

## Outputs

| Head | Shape | Classes, in this order |
| --- | --- | --- |
| `digit` | `[81, 10]` | `empty, 1, 2, 3, 4, 5, 6, 7, 8, 9` |
| `kind` | `[81, 4]` | `none, printed, handwritten, notes` |

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
  row by row. An image keeps its own size in the id: the real cells in the image store are 71 × 71.
- A training dataset manifest MUST reject any entry with `source: fixture` (SUD-10). Fixtures are
  for evaluation only.
- `photo` means a cell cut from a sudoku photo. Its kind is the `kind` column of
  `ml/dataset/cells.csv` (ADR-018), set on the labelling page. Cells in `cells/unlabeled/` get a label
  by hand: `empty`, a digit or `discarded`.

## Manifest

`mobile/assets/models/manifest.json`. `just promote-model` writes it (ADR-007). Until M3,
`just install-model` writes it, with the fields model, version, contract, file, outputs, run,
metrics and installedAt (ADR-007, amendment).

The model file keeps a **stable name**, `cell-classifier.tflite`, because React Native's bundler
needs a static `require()`. The version lives in the manifest only. `metro.config.js` lists
`tflite` in `assetExts`.

```json
{
  "model": "cell-classifier",
  "version": "2.0.0",
  "contract": "2.0",
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
| New input size, crop, preprocessing step, polarity or class list | major | major |

| New optional output the app may ignore | minor | minor |

Contract 2.0 changes the crop (ADR-020). The scanner implements major version 2 only, because a model that
was trained on cropped cells reads a full cell wrongly.

The scanner declares the contract major versions it implements. Promote and a unit test refuse a
model outside that set (SUD-09). At runtime the scanner checks once more as a guard. On a
mismatch it disables scanning with a message instead of returning wrong digits.

## Open questions

| Question | Decided by |
| --- | --- |
| float16 weights: run on the TFLite 2.17 runtime? Not needed in v1 | When model size matters |
| Confidence threshold for "review this cell" | First real fixture set |

## Constraints

| ID | Constraint |
| --- | --- |
| SUD-06 | A model MUST reach the app only through `just promote-model`. Until M3, `just install-model` is the one exception (ADR-007, amendment). |
| SUD-09 | Promote and the test suite MUST refuse a model whose contract major version the scanner does not implement. |
| SUD-10 | Fixture cells MUST NOT appear in any training dataset. |
