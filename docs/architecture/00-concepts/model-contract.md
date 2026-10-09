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

The cell classifier takes one cell crop and returns two answers: which digit (or empty), and what
kind of mark it is. The app sends all 81 cells in one batch. Every promoted model ships with a
manifest that states which contract version it implements, and the app refuses a model whose
contract major version it does not know.

## Input

| Property | Value |
| --- | --- |
| Source | One cell from the per-cell flatten, see [scan-pipeline](scan-pipeline.md) |
| Crop | The flattened cell at 64 × 64, minus a 10 % margin on every side to drop grid lines, resized to 32 × 32 |
| Channels | 1 (grayscale) |
| Polarity | Ink is high, paper is low: `1.0` black ink, `0.0` white paper |
| Range | `float32` in `[0, 1]` |
| Shape | `[N, 32, 32, 1]`, N = 81 in the app |

The exact preprocessing is implemented twice, in `ml/` and in the scanner module. Both are tested
against the same reference crops in `fixtures/` so they cannot drift.

## Outputs

| Head | Shape | Classes, in this order |
| --- | --- | --- |
| `digit` | `[N, 10]` probabilities | `empty, 1, 2, 3, 4, 5, 6, 7, 8, 9` |
| `kind` | `[N, 4]` probabilities | `none, printed, handwritten, notes` |

Valid pairs: `empty` goes with `none` or `notes`. A digit goes with `printed` or `handwritten`.
The app treats an invalid pair as low confidence. A cell's confidence is the lower of the two
heads' top probabilities.

## Label format

Training data, the app's export (F-11) and fixtures use one format, so a corrected scan can flow
straight into a dataset.

```json
{
  "id": "sha256 of the crop",
  "source": "synthetic | legacy-v2 | emnist | app-export | fixture",
  "digit": 7,
  "kind": "printed",
  "scan": "optional scan id, groups the 81 cells of one photo"
}
```

The legacy v2 labels map as: `0` → `empty`/`none`, `1–9` → digit with kind to be labelled,
`10` (noise) → `empty`/`notes`.

## Manifest

`apps/mobile/assets/models/manifest.json`, written only by `just promote-model` (ADR-007):

```json
{
  "model": "cell-classifier",
  "version": "1.0.0",
  "contract": "1.0",
  "file": "cell-classifier@1.0.0.tflite",
  "trainedOn": "dataset manifest hash",
  "metrics": { "cellAccuracy": 0.9991, "kindAccuracy": 0.995, "gridExact": 0.96 },
  "promotedAt": "2026-10-09"
}
```

## Versioning

| Change | Contract | Model version |
| --- | --- | --- |
| Retrained, same inputs and outputs | unchanged | minor |
| New input size, polarity, crop or class list | major | major |
| New optional output the app may ignore | minor | minor |

## Constraints

| ID | Constraint |
| --- | --- |
| SUD-06 | A model MUST reach the app only through `just promote-model`. |
| SUD-09 | The app MUST refuse a model whose contract major version it does not implement. |
