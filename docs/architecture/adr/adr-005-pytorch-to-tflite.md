---
status: DRAFT
---

# ADR-005: Train in PyTorch, export to TFLite (LiteRT)

| Field   | Value                              |
| ------- | ---------------------------------- |
| Project | Sudoku                             |
| Status  | Proposed, pending the walking skeleton (M0) |
| Date    | 2026-10-09                         |
| Contact | Felix                              |

## Context

The models are trained on an Apple Silicon Mac (TC-4) and run in the app through fast-tflite
(ADR-002), so they must end up as `.tflite` files. A Core ML export may be needed for any step
that moves to a Swift plugin. Learning the current ML stack is a goal (OC-2).

## Alternatives Evaluated

| | Keras 3 / TensorFlow | **PyTorch** |
| --- | --- | --- |
| Export to TFLite | Built in, most mature | Through Google's litert-torch, formerly ai-edge-torch (LiteRT). Fine for plain CNNs, younger |
| Export to Core ML | Possible | coremltools, well supported |
| Training on Apple Silicon | `tensorflow-metal`, pinned to old TensorFlow and NumPy versions | MPS backend, works without extra packages |
| Skill relevance | Declining | Industry and research default |

### Quantisation

| Option | Size for ~100k parameters | For | Against |
| --- | --- | --- | --- |
| **float32 / float16** | ~400 KB / ~200 KB | No accuracy loss. Nothing extra to validate | Larger, still far under QR-13's 1 MB |
| int8 | ~100 KB | Smallest, fastest on CPU | Accuracy risk, an extra gate check, and GPU or Core ML acceleration often falls back to CPU for int8 |

int8 solves a size problem the project does not have.

## Decision

1. **PyTorch** for training, on the MPS backend.
2. **litert-torch** (formerly ai-edge-torch) to export `.tflite` with **float32 weights**. No
   float16 and no int8 in v1: the iOS runtime is TFLite 2.17, and float32 is the safe set.
3. **coremltools** only if a step moves to Swift (ADR-002).
4. Training runs as **CLI scripts** with a config file (`just train cell-classifier`). Notebooks
   are for exploration only. Each run writes its model, `metrics.json` and a model card to
   `ml/artifacts/<run>/`.
5. Augmentation with torchvision transforms or albumentations. TensorBoard for curves. No
   experiment-tracking service yet.

## Validation: the walking skeleton (M0)

Part of milestone M0, as code that stays. A small CNN with both heads, exported with litert-torch,
and run through fast-tflite on the iPhone. Pass:

- The on-device outputs match PyTorch's on the 81 reference cells in `fixtures/preprocess/`:
  same top class on both heads, probabilities within `1e-3`.
- The two outputs are found by index and checked by shape (see the
  [model contract](../00-concepts/model-contract.md)).

**Measured before M0** on the first design (flatten and a dense layer, 90k parameters; Python side, see the [research record](../../research/2026-10-09-cell-classifier-research.md)): the conversion works with the API
`litert_torch.convert(model, (sample,)).export(path)`, on the Mac and on Linux. TFLite and
PyTorch differ by at most 6 × 10⁻⁸, with the same top class everywhere. That model is 369 KB. The file
uses only builtin ops (CONV_2D, DEPTHWISE_CONV_2D for the first layer with one input channel, MAX_POOL_2D, FULLY_CONNECTED
v5, SOFTMAX, RESHAPE, TRANSPOSE), all supported by TFLite 2.17. The global-average-pooling network of ADR-006 adds a pooling or
mean op: the export checks every op version against 2.17 (#4). The phone side is issue #5.

**Measured with the trained model** (run `20261009-210543-cell-classifier`, 72,926 parameters):

- The file is 326,348 bytes, float32.
- The maximum absolute difference to PyTorch is 1.19 × 10⁻⁷ on the 81 reference cells.
- The outputs are `digit` at index 0 and `kind` at index 1.
- The ops are DEPTHWISE_CONV_2D v1, CONV_2D v1, MAX_POOL_2D v1, SUM v1, MUL v1, RESHAPE v1,
  GATHER_ND v1, FULLY_CONNECTED v5 and SOFTMAX v1. All are within TFLite 2.17.
- Global average pooling exports as SUM and MUL, not MEAN.
- The op table `ml/src/sudoku_ml/tflite_2_17_ops.json` holds 168 ops from v2.17.0 `register.cc`.

**Measured on the iPhone** (development build, fast-tflite 3.0.1, CPU delegate, run
`20261009-210543-cell-classifier`):

- The top class of both heads matches PyTorch on all 81 reference cells.
- The largest probability difference is 2.38 × 10⁻⁷.
- One batched call for 81 cells takes 21.1 ms (median of 20 calls, three app starts: 21.1, 21.5 and 21.1 ms).

## Consequences

- Pins: Python 3.12, torch 2.13.0 (litert-torch 0.9.4 requires torch below 2.14), litert-torch
  0.9.4, ai-edge-litert 2.2.0. On Linux CI, torch comes from the PyTorch CPU index. The ML
  environment is about 1.3 GB on the Mac and 1.8 GB on CI, so CI caches uv.
- If litert-torch fails the walking skeleton, the fallback is PyTorch → ONNX → TFLite, then
  Keras 3 for the export only. The fallback is a new ADR, not an edit.

## Reassessment Triggers

- The export path breaks on an operator the model needs.
- A model passes 1 MB, or inference passes its 100 ms budget. Then evaluate float16 weights
  (193 KB, difference 6 × 10⁻⁶, checked against TFLite 2.17 first) before int8.
- The app moves off TFLite (for example to ExecuTorch), which would remove the conversion step.
