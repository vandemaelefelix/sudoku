"""The model's digit and kind for each cell in cells/unlabeled/ and in the digit folders, for
the Digits and Label kind screens. Writes ml/dataset/work/prelabels.json. A pre-label is a proposal:
only a person's confirmation is a label."""

import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.data_paths import ML_ROOT, DataPaths
from sudoku_ml.grouping import default_run
from sudoku_ml.manifest import warn_unreadable
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import preprocess_cell, to_cell_image
from sudoku_ml.tables import DIGIT_FOLDERS, pixel_id, write_atomic

BATCH = 1024
# The kind needs a pre-label after the digit pass moved a cell out of unlabeled/.
PRELABEL_FOLDERS = ("unlabeled", *DIGIT_FOLDERS)
NO_MODEL = (
    "No model run found, so no pre-labels. The Digits screen stays empty. "
    "Install a model with just install-model, or pass a run: just prelabel-cells <run>"
)


def _predict(run: Path, paths: list[Path]) -> list[dict]:
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt", map_location="cpu"))
    model.eval()
    temperature = json.loads((run / "metrics.json").read_text())["temperature"]
    inputs = np.stack(
        [preprocess_cell(to_cell_image(np.asarray(Image.open(p).convert("RGB")))) for p in paths]
    )
    results = []
    with torch.no_grad():
        for start in range(0, len(inputs), BATCH):
            x = torch.from_numpy(inputs[start : start + BATCH])[:, None]
            digit_logits, kind_logits = model(x)
            digit = (digit_logits / temperature).softmax(1)
            kind = kind_logits.softmax(1)
            for d, k in zip(digit, kind, strict=True):
                results.append(
                    {
                        "digit": DIGIT_CLASSES[int(d.argmax())],
                        "p": round(float(d.max()), 4),
                        "kind": KIND_CLASSES[int(k.argmax())],
                        "kp": round(float(k.max()), 4),
                    }
                )
    return results


def write_prelabels(cells_dir: Path, run: Path, out: Path) -> int:
    """Pre-label the cells in unlabeled/ and in the digit folders that have no current pre-label
    of this run. Drop the pre-labels of cells that left those folders. An entry without `kp`
    is old and is computed again. Returns the number of new pre-labels."""
    stored = {}
    if out.exists():
        try:
            stored = json.loads(out.read_text())
        except (OSError, ValueError) as error:
            warn_unreadable(out, error)
    if not isinstance(stored, dict):
        stored = {}
    known = stored.get("cells", {}) if stored.get("run") == run.name else {}
    paths = sorted(p for f in PRELABEL_FOLDERS for p in (cells_dir / f).glob("*.png"))
    ids = {p: pixel_id(p) for p in paths}
    cells = {ids[p]: known[ids[p]] for p in paths if "kp" in known.get(ids[p], {})}
    todo = [p for p in paths if ids[p] not in cells]
    if todo:
        for path, entry in zip(todo, _predict(run, todo), strict=True):
            cells[ids[path]] = entry
    write_atomic(out, json.dumps({"run": run.name, "cells": cells}))
    return len(todo)


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
