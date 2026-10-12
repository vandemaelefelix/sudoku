"""Groups of similar cells per digit folder, for the labelling page.
Writes ml/data/work/groups.json."""

import json
import sys
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.dataset import read_ids
from sudoku_ml.label_store import Paths
from sudoku_ml.manifest import write_atomic
from sudoku_ml.model import CellClassifier
from sudoku_ml.preprocess import BT601, preprocess_cell, to_cell_image

DIGIT_FOLDERS = tuple(str(d) for d in range(1, 10))
# The model sees grayscale. Pen colour separates handwriting from print in most real cells.
COLOUR_WEIGHT = 0.5
_LUMA = np.array(BT601, dtype=np.float32)


def ink_colour(image: np.ndarray) -> np.ndarray:
    """(64, 64, 3) uint8 → (2,): blue minus luma and red minus luma of the darkest 10 % of the
    inner pixels, divided by 64."""
    inner = image[8:56, 8:56].reshape(-1, 3).astype(np.float32)
    luma = inner @ _LUMA
    ink = inner[luma <= np.quantile(luma, 0.1)]
    ink_luma = ink @ _LUMA
    blue, red = (ink[:, 2] - ink_luma).mean(), (ink[:, 0] - ink_luma).mean()
    return np.array([blue, red], dtype=np.float32) / 64.0


def features(model: CellClassifier, images: np.ndarray) -> np.ndarray:
    """(N, 64, 64, 3) uint8 → (N, 66): the model's features at unit length, then the weighted
    ink colour."""
    inputs = torch.from_numpy(np.stack([preprocess_cell(im) for im in images]))[:, None]
    model.eval()
    with torch.no_grad():
        parts = [model.features(inputs[s : s + 1024]) for s in range(0, len(inputs), 1024)]
    feats = torch.cat(parts).numpy()
    feats /= np.linalg.norm(feats, axis=1, keepdims=True) + 1e-8
    colour = np.stack([ink_colour(im) for im in images]) * COLOUR_WEIGHT
    return np.hstack([feats, colour]).astype(np.float32)


def _distances(x: np.ndarray, centres: np.ndarray) -> np.ndarray:
    return ((x[:, None, :] - centres[None]) ** 2).sum(2)


def kmeans(x: np.ndarray, k: int, seed: int, iters: int = 100) -> tuple[np.ndarray, np.ndarray]:
    """Labels (N,) and centres (at most k, D). k-means++ start. Same input and seed, same result."""
    rng = np.random.default_rng(seed)
    centres = [x[rng.integers(len(x))]]
    for _ in range(min(k, len(x)) - 1):
        d = _distances(x, np.stack(centres)).min(1)
        if d.sum() == 0:
            break
        centres.append(x[rng.choice(len(x), p=d / d.sum())])
    c = np.stack(centres)
    for _ in range(iters):
        labels = _distances(x, c).argmin(1)
        new = np.stack(
            [x[labels == j].mean(0) if (labels == j).any() else c[j] for j in range(len(c))]
        )
        if np.allclose(new, c):
            break
        c = new
    return _distances(x, c).argmin(1), c


def sureness(x: np.ndarray, centres: np.ndarray, labels: np.ndarray) -> np.ndarray:
    """Distance to the next centre minus distance to the own centre. Small: not sure."""
    if len(centres) < 2:
        return np.zeros(len(x), dtype=np.float32)
    d = np.sqrt(_distances(x, centres))
    own = d[np.arange(len(x)), labels]
    other = np.where(np.arange(len(centres))[None] == labels[:, None], np.inf, d).min(1)
    return other - own


def group_folder(ids: list[str], x: np.ndarray, k: int, seed: int) -> list[dict]:
    labels, centres = kmeans(x, k, seed)
    sure = sureness(x, centres, labels)
    groups = []
    for j in range(len(centres)):
        members = np.flatnonzero(labels == j)
        if len(members) == 0:
            continue
        order = members[np.argsort(sure[members], kind="stable")]
        groups.append(
            {
                "cells": [ids[i] for i in order],
                "sureness": [round(float(sure[i]), 4) for i in order],
            }
        )
    groups.sort(key=lambda g: -len(g["cells"]))
    return groups


def write_groups(ml_root: Path, run: Path, out: Path, k: int = 30, seed: int = 0) -> int:
    """Group every digit folder with the model of `run`. Returns the number of grouped cells."""
    model = CellClassifier()
    model.load_state_dict(torch.load(run / "model.pt", map_location="cpu"))
    ids = read_ids(ml_root / "datasets" / "cells.csv")
    cells_dir = ml_root / "data" / "cells"
    folders: dict[str, list[dict]] = {}
    for folder in DIGIT_FOLDERS:
        paths = sorted((cells_dir / folder).glob("*.png"))
        if not paths:
            continue
        missing = [p.stem for p in paths if p.stem not in ids]
        if missing:
            raise ValueError(
                f"{len(missing)} cells are not in cells.csv, e.g. {missing[0]}. "
                "Run: just dataset-manifest"
            )
        images = np.stack([to_cell_image(np.asarray(Image.open(p).convert("RGB"))) for p in paths])
        x = features(model, images)
        folders[folder] = group_folder([ids[p.stem] for p in paths], x, k, seed)
    write_atomic(out, json.dumps({"run": run.name, "seed": seed, "k": k, "folders": folders}))
    return sum(len(g["cells"]) for groups in folders.values() for g in groups)


def default_run(ml_root: Path) -> Path:
    """The run of the model that the app uses."""
    manifest = ml_root.parent / "apps" / "mobile" / "assets" / "models" / "manifest.json"
    return ml_root / "artifacts" / json.loads(manifest.read_text())["run"]


if __name__ == "__main__":
    root = Path(__file__).parents[2]
    chosen = root / sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] else default_run(root)
    print(write_groups(root, chosen, Paths.under(root).groups))
