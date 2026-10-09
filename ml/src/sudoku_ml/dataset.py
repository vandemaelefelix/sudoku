"""Real cells, near-duplicate groups and a split that keeps each group on one side."""

from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, UNKNOWN_KIND, digit_index, kind_index
from sudoku_ml.preprocess import BT601, area_weights, to_cell_image
from sudoku_ml.synthetic import Sample

_HASH_ROWS = area_weights(64, 8)
_HASH_COLS = area_weights(64, 9)


def load_cells(cells_dir: Path) -> list[Sample]:
    """The labelled real cells. Never reads `unlabeled/`."""
    samples = []
    for label in DIGIT_CLASSES:
        for path in sorted((cells_dir / label).glob("*.png")):
            image = to_cell_image(np.asarray(Image.open(path).convert("RGB")))
            kind = kind_index("none") if label == "empty" else UNKNOWN_KIND
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
