"""The model's guess for each cell in cells/unlabeled/ and in the digit folders, for the Digits
and Kind steps: the top digit and kind, and the full probabilities (10 digits, 4 kinds). Writes
ml/dataset/work/prelabels.json. A pre-label is a proposal: only a person's confirmation is a
label."""

import json
import sys
from collections.abc import Collection
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.data_paths import ARTIFACTS, ML_ROOT, DataPaths
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import preprocess_cell, to_cell_image
from sudoku_ml.tables import pixel_id, read_derived, stem_of, write_atomic

BATCH = 1024
# empty/ too: an app cell that the player left empty can hide a digit. The Kind step needs a
# pre-label after the Digits step moved a cell out of unlabeled/.
PRELABEL_FOLDERS = ("unlabeled", *DIGIT_CLASSES)
NO_MODEL = (
    "No model run found, so no pre-labels. The Digits and Kind steps have no order. "
    "Install a model with just install-model, or pass a run: just prelabel-cells <run>"
)


def predict_probs(run: Path, paths: list[Path]) -> tuple[np.ndarray, np.ndarray]:
    """The digit probabilities (N, 10) and kind probabilities (N, 4) of the cell images, in the
    order of DIGIT_CLASSES and KIND_CLASSES. The digit head uses the temperature of the run."""
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt", map_location="cpu"))
    model.eval()
    temperature = json.loads((run / "metrics.json").read_text())["temperature"]
    inputs = np.stack(
        [preprocess_cell(to_cell_image(np.asarray(Image.open(p).convert("RGB")))) for p in paths]
    )
    digits, kinds = [], []
    with torch.no_grad():
        for start in range(0, len(inputs), BATCH):
            x = torch.from_numpy(inputs[start : start + BATCH])[:, None]
            digit_logits, kind_logits = model(x)
            digits.append((digit_logits / temperature).softmax(1).numpy())
            kinds.append(kind_logits.softmax(1).numpy())
    return np.concatenate(digits), np.concatenate(kinds)


def _entry(digit: np.ndarray, kind: np.ndarray) -> dict:
    return {
        "digit": DIGIT_CLASSES[int(digit.argmax())],
        "p": round(float(digit.max()), 4),
        "kind": KIND_CLASSES[int(kind.argmax())],
        "kp": round(float(kind.max()), 4),
        "probs": {
            "digit": [round(float(v), 4) for v in digit],
            "kind": [round(float(v), 4) for v in kind],
        },
    }


def _predict(run: Path, paths: list[Path]) -> list[dict]:
    digits, kinds = predict_probs(run, paths)
    return [_entry(d, k) for d, k in zip(digits, kinds, strict=True)]


def write_prelabels(
    cells_dir: Path, run: Path, out: Path, wanted: Collection[str] | None = None
) -> int:
    """Pre-label the cells in unlabeled/ and in the digit folders that have no current pre-label
    of this run. `wanted` (full cell ids) limits it to the cells that wait for a person. Drop the
    pre-labels of other cells. An entry without `probs` is old and is computed again. Returns the
    number of new pre-labels."""
    stored = read_derived(out, warn=True)
    if not isinstance(stored, dict):
        stored = {}
    known = stored.get("cells", {}) if stored.get("run") == run.name else {}
    stems = None if wanted is None else {stem_of(cell) for cell in wanted}
    paths = sorted(
        p
        for f in PRELABEL_FOLDERS
        for p in (cells_dir / f).glob("*.png")
        if stems is None or p.stem in stems
    )
    ids = {p: pixel_id(p) for p in paths}
    cells = {ids[p]: known[ids[p]] for p in paths if "probs" in known.get(ids[p], {})}
    todo = [p for p in paths if ids[p] not in cells]
    if todo:
        for path, entry in zip(todo, _predict(run, todo), strict=True):
            cells[ids[path]] = entry
    write_atomic(out, json.dumps({"run": run.name, "cells": cells}))
    return len(todo)


def default_run(ml_root: Path = ML_ROOT, artifacts: Path = ARTIFACTS) -> Path:
    """The run of the model that the app uses."""
    manifest = ml_root.parent / "mobile" / "assets" / "models" / "manifest.json"
    return artifacts / json.loads(manifest.read_text())["run"]


def main(argv: list[str], paths: DataPaths | None = None, ml_root: Path = ML_ROOT) -> int:
    try:
        run = ml_root / argv[1] if len(argv) > 1 and argv[1] else default_run(ml_root)
    except FileNotFoundError:
        run = None
    if run is None or not (run / "model.pt").exists():
        print(NO_MODEL, file=sys.stderr)
        return 0
    paths = paths or DataPaths.under()
    cells, out = paths.cells, paths.prelabels
    print(f"Pre-labelled {write_prelabels(cells, run, out)} new cells with {run.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
