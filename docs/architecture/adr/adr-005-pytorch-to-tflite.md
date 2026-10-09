---
status: DRAFT
---

# ADR-005: Train in PyTorch, export to TFLite (LiteRT)

| Field   | Value                              |
| ------- | ---------------------------------- |
| Project | Sudoku                             |
| Status  | Proposed, pending the device spike |
| Date    | 2026-10-09                         |
| Contact | Felix                              |

## Context

The models are trained on an Apple Silicon Mac (TC-4) and run in the app through fast-tflite
(ADR-002), so they must end up as `.tflite` files. A Core ML export may be needed for any step
that moves to a Swift plugin. Learning the current ML stack is a goal (OC-2). The earlier v2
project used TensorFlow 2.13 with `tensorflow-metal`, and had to pin `numpy < 1.25` to keep it
working.

## Alternatives Evaluated

| | Keras 3 / TensorFlow | **PyTorch** |
| --- | --- | --- |
| Export to TFLite | Built in, most mature | Through Google's ai-edge-torch (LiteRT). Fine for plain CNNs, younger |
| Export to Core ML | Possible | coremltools, well supported |
| Training on Apple Silicon | `tensorflow-metal`, fragile in the previous project | MPS backend, works without extra packages |
| Skill relevance | Declining | Industry and research default |

### Quantisation

| Option | Size for ~100k parameters | For | Against |
| --- | --- | --- | --- |
| **float32 / float16** | ~400 KB / ~200 KB | No accuracy loss. Nothing extra to validate | Larger, still far under QR-13's 1 MB |
| int8 | ~100 KB | Smallest, fastest on CPU | Accuracy risk, an extra gate check, and GPU or Core ML acceleration often falls back to CPU for int8 |

int8 solves a size problem the project does not have.

## Decision

1. **PyTorch** for training, on the MPS backend.
2. **ai-edge-torch** to export `.tflite` with **float weights** (float16 if the export supports it
   cleanly, otherwise float32). No int8 in v1.
3. **coremltools** only if a step moves to Swift (ADR-002).
4. Training runs as **CLI scripts** with a config file (`just train cell-classifier`). Notebooks
   are for exploration only. Each run writes its model, `metrics.json` and a model card to
   `ml/artifacts/<run>/`.
5. Augmentation with torchvision transforms or albumentations. TensorBoard for curves. No
   experiment-tracking service yet.

## Validation: the device spike

A tiny CNN with both heads, trained for a few epochs, exported with ai-edge-torch, and run
through fast-tflite on the iPhone. Pass:

- The on-device outputs match PyTorch's on the 81 reference cells in `fixtures/preprocess/`:
  same top class on both heads, probabilities within `1e-3` (float32) or `1e-2` (float16).
- The two outputs can be told apart by name or by a stable index (see the
  [model contract](../00-concepts/model-contract.md)).

## Consequences

- Library versions in this space change quickly. The spike pins what works, and the pins are
  recorded in `ml/pyproject.toml` with a comment pointing here.
- If ai-edge-torch fails the spike, the fallback is PyTorch → ONNX → TFLite, then Keras 3 for
  the export only. The fallback is a new ADR, not an edit.

## Reassessment Triggers

- The export path breaks on an operator the model needs.
- A model passes 1 MB, or inference passes its 100 ms budget. Then evaluate int8.
- The app moves off TFLite (for example to ExecuTorch), which would remove the conversion step.
