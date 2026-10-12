"""Real cells, near-duplicate groups and a split that keeps each group on one side."""

import csv
import re
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, UNKNOWN_KIND, digit_index, kind_index
from sudoku_ml.preprocess import BT601, area_weights, to_cell_image
from sudoku_ml.synthetic import Sample

FULL_ID = re.compile(r"[0-9a-f]{64}")
_HASH_ROWS = area_weights(64, 8)
_HASH_COLS = area_weights(64, 9)


def cell_paths(cells_dir: Path) -> list[Path]:
    """The labelled cell files, in the order load_cells returns them. Never `unlabeled/`."""
    return [p for label in DIGIT_CLASSES for p in sorted((cells_dir / label).glob("*.png"))]


def read_ids(manifest: Path) -> dict[str, str]:
    """File stem → full cell id, from cells.csv. Raises ValueError on an id that is not 64 hex
    characters: a stop during a write can cut the last row."""
    found = {}
    with manifest.open(newline="") as handle:
        for line, row in enumerate(csv.DictReader(handle), start=2):
            if not FULL_ID.fullmatch(row.get("id") or ""):
                raise ValueError(f"{manifest} line {line}: {row.get('id')!r} is not a cell id")
            found[row["id"][:16]] = row["id"]
    return found


def read_kinds(manifest: Path) -> dict[str, str]:
    """File stem → the kind column of cells.csv."""
    with manifest.open(newline="") as handle:
        return {row["id"][:16]: row.get("kind") or "" for row in csv.DictReader(handle)}


_DIGIT_KIND_TARGETS = {k: kind_index(k) for k in ("printed", "handwritten")}


def load_cells(cells_dir: Path, manifest: Path | None = None) -> list[Sample]:
    """The labelled real cells. An empty cell gets `none`. A digit cell gets its kind from the
    manifest, or UNKNOWN_KIND for `unsure`, blank or no manifest."""
    kinds = read_kinds(manifest) if manifest is not None and manifest.exists() else {}
    samples = []
    for path in cell_paths(cells_dir):
        label = path.parent.name
        image = to_cell_image(np.asarray(Image.open(path).convert("RGB")))
        if label == "empty":
            kind = kind_index("none")
        else:
            kind = _DIGIT_KIND_TARGETS.get(kinds.get(path.stem, ""), UNKNOWN_KIND)
        samples.append(Sample(image, digit_index(label), kind))
    return samples


def dhash(image: np.ndarray) -> int:
    """64-bit difference hash. Each bit: a thumbnail pixel is brighter than its left neighbour."""
    gray = image.astype(np.float32) @ np.array(BT601, dtype=np.float32)
    small = _HASH_ROWS @ gray @ _HASH_COLS.T
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return int(np.packbits(bits).view(">u8")[0])


def group_ids(samples: list[Sample], max_distance: int = 4) -> np.ndarray:
    """Group id per sample. Hashes within `max_distance` bits join one group (union-find)."""
    hashes = np.array([dhash(s.image) for s in samples], dtype=np.uint64)
    parent = np.arange(len(samples))

    def root(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(samples) - 1):
        close = np.nonzero(np.bitwise_count(hashes[i + 1 :] ^ hashes[i]) <= max_distance)[0] + i + 1
        for j in close:
            parent[root(int(j))] = root(i)
    return np.array([root(i) for i in range(len(samples))])


def split_by_group(groups: np.ndarray, fractions: tuple[float, float, float], seed: int):
    """Train, validation and test indices. A group is never split."""
    unique = np.random.default_rng(seed).permutation(np.unique(groups))
    cut1 = round(len(unique) * fractions[0])
    cut2 = cut1 + round(len(unique) * fractions[1])
    sides = [set(unique[:cut1]), set(unique[cut1:cut2]), set(unique[cut2:])]
    return tuple(np.array([i for i, g in enumerate(groups) if g in side]) for side in sides)


def stack(samples: list[Sample]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Images (N, 64, 64, 3) uint8, digit targets (N,), kind targets (N,)."""
    images = torch.from_numpy(np.stack([s.image for s in samples]))
    digit = torch.tensor([s.digit for s in samples], dtype=torch.long)
    kind = torch.tensor([s.kind for s in samples], dtype=torch.long)
    return images, digit, kind
