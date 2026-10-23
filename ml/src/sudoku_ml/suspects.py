"""Find cells whose digit or kind label is probably wrong (cross-validated ranking, R-13)."""

import argparse
import csv
import io
import sys
from pathlib import Path

import numpy as np
import torch

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES, kind_index
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.dataset import group_ids, read_real_cells, stack, training_cells
from sudoku_ml.model import CellClassifier
from sudoku_ml.tables import write_atomic
from sudoku_ml.train import Pool, default_device, fit, predict_logits

FIELDS = ["field", "file", "label", "predicted", "p_label", "p_predicted"]
KIND_THRESHOLD = 0.10
BATCH_SIZE = 256
_LABELLED_KINDS = (kind_index("printed"), kind_index("handwritten"))


def rank_suspects(names, labels, probs: np.ndarray, top: int) -> list[dict]:
    p_label = probs[np.arange(len(labels)), labels]
    order = np.argsort(p_label)[:top]
    return [
        {
            "field": "digit",
            "file": names[i],
            "label": DIGIT_CLASSES[labels[i]],
            "predicted": DIGIT_CLASSES[int(probs[i].argmax())],
            "p_label": round(float(p_label[i]), 4),
            "p_predicted": round(float(probs[i].max()), 4),
        }
        for i in order
    ]


def rank_kind_suspects(
    names, kinds: list[int], probs: np.ndarray, threshold: float = KIND_THRESHOLD
) -> list[dict]:
    """Cells labelled printed or handwritten whose held-out probability for that kind is below
    the threshold, lowest first."""
    rows = [
        {
            "field": "kind",
            "file": names[i],
            "label": KIND_CLASSES[k],
            "predicted": KIND_CLASSES[int(probs[i].argmax())],
            "p_label": round(float(probs[i, k]), 4),
            "p_predicted": round(float(probs[i].max()), 4),
        }
        for i, k in enumerate(kinds)
        if k in _LABELLED_KINDS and probs[i, k] < threshold
    ]
    return sorted(rows, key=lambda r: r["p_label"])


def write_suspects(rows: list[dict], path: Path) -> None:
    buffer = io.StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=FIELDS)
    writer.writeheader()
    writer.writerows(rows)
    write_atomic(path, buffer.getvalue())


def find_suspects(data: DataPaths, folds: int = 5, epochs: int = 12, top: int = 150) -> Path:
    """Rank digit and kind suspects with cross-validation. Writes ml/dataset/work/suspects.csv.
    Ranks only the cells that may train (ADR-030)."""
    cells = training_cells(read_real_cells(data))
    paths = [c.path for c in cells]
    samples = [c.sample for c in cells]
    images, digit, kind = stack(samples)
    groups = group_ids(samples)
    unique = np.random.default_rng(0).permutation(np.unique(groups))
    fold_of = {g: i % folds for i, g in enumerate(unique)}
    fold = np.array([fold_of[g] for g in groups])
    device, generator = default_device(), torch.Generator().manual_seed(0)
    digit_probs = np.zeros((len(samples), len(DIGIT_CLASSES)), dtype=np.float32)
    kind_probs = np.zeros((len(samples), len(KIND_CLASSES)), dtype=np.float32)
    for f in range(folds):
        train_idx = torch.from_numpy(np.nonzero(fold != f)[0])
        held = torch.from_numpy(np.nonzero(fold == f)[0])
        model = CellClassifier().to(device)
        pool = Pool(images[train_idx], digit[train_idx], kind[train_idx], BATCH_SIZE)
        fit(model, [pool], epochs, device, generator)
        digit_logits, kind_logits = predict_logits(model, images[held], device)
        digit_probs[held.numpy()] = digit_logits.softmax(1).numpy()
        kind_probs[held.numpy()] = kind_logits.softmax(1).numpy()
    names = [p.stem for p in paths]
    rows = rank_suspects(names, digit.tolist(), digit_probs, top)
    rows += rank_kind_suspects(names, kind.tolist(), kind_probs)
    write_suspects(rows, data.suspects)
    return data.suspects


def main(argv: list[str] | None = None, paths: DataPaths | None = None) -> int:
    argparse.ArgumentParser(prog="just suspects").parse_args(argv)
    try:
        print(find_suspects(paths or DataPaths.under()))
    except ValueError as error:
        print(error, file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
