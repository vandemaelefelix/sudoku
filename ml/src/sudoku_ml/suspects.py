"""Find cells whose digit or kind label is probably wrong (cross-validated ranking, R-13)."""

import csv
import io
from pathlib import Path

import numpy as np
import torch

from sudoku_ml.augment import augment
from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES, kind_index
from sudoku_ml.dataset import cell_paths, group_ids, load_cells, stack
from sudoku_ml.label_store import Paths
from sudoku_ml.manifest import write_atomic
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import preprocess_batch
from sudoku_ml.train import _device, _logits, loss

FIELDS = ["field", "file", "label", "predicted", "p_label", "p_predicted"]
KIND_THRESHOLD = 0.10
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


def _fit(images, digit, kind, epochs: int, device, generator) -> CellClassifier:
    model = CellClassifier().to(device)
    steps = max(1, len(images) // 256)
    optimiser = torch.optim.AdamW(model.parameters(), lr=0.003, weight_decay=1e-4)
    schedule = torch.optim.lr_scheduler.OneCycleLR(optimiser, 0.003, total_steps=steps * epochs)
    for _ in range(epochs):
        model.train()
        for _ in range(steps):
            i = torch.randint(len(images), (256,), generator=generator)
            x = augment(images[i].to(device).permute(0, 3, 1, 2).float(), generator)
            d, k = model(preprocess_batch(x))
            value = loss(d, k, digit[i].to(device), kind[i].to(device), 0.4, 0.05)
            optimiser.zero_grad()
            value.backward()
            optimiser.step()
            schedule.step()
    return model


def find_suspects(ml_root: Path, folds: int = 5, epochs: int = 12, top: int = 150) -> Path:
    """Rank digit and kind suspects with cross-validation. Writes ml/data/work/suspects.csv."""
    cells_dir = ml_root / "data" / "cells"
    paths = cell_paths(cells_dir)
    samples = load_cells(cells_dir, ml_root / "datasets" / "cells.csv")
    if len(paths) != len(samples):
        raise ValueError(f"{len(paths)} files but {len(samples)} cells")
    images, digit, kind = stack(samples)
    groups = group_ids(samples)
    unique = np.random.default_rng(0).permutation(np.unique(groups))
    fold_of = {g: i % folds for i, g in enumerate(unique)}
    fold = np.array([fold_of[g] for g in groups])
    device, generator = _device(), torch.Generator().manual_seed(0)
    digit_probs = np.zeros((len(samples), len(DIGIT_CLASSES)), dtype=np.float32)
    kind_probs = np.zeros((len(samples), len(KIND_CLASSES)), dtype=np.float32)
    for f in range(folds):
        train_idx = torch.from_numpy(np.nonzero(fold != f)[0])
        held = torch.from_numpy(np.nonzero(fold == f)[0])
        model = _fit(
            images[train_idx], digit[train_idx], kind[train_idx], epochs, device, generator
        )
        digit_logits, kind_logits = _logits(model, images[held], device)
        digit_probs[held.numpy()] = digit_logits.softmax(1).numpy()
        kind_probs[held.numpy()] = kind_logits.softmax(1).numpy()
    names = [p.stem for p in paths]
    rows = rank_suspects(names, digit.tolist(), digit_probs, top)
    rows += rank_kind_suspects(names, kind.tolist(), kind_probs)
    out = Paths.under(ml_root).suspects
    write_suspects(rows, out)
    return out


if __name__ == "__main__":
    print(find_suspects(Path(__file__).parents[2]))
