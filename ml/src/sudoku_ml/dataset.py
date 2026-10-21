"""Real cells, near-duplicate groups and a split that keeps each group on one side."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, UNKNOWN_KIND, digit_index, kind_index
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.preprocess import BT601, area_weights, to_cell_image
from sudoku_ml.synthetic import Sample
from sudoku_ml.tables import APP_SCAN, TRUSTED_LABEL_SOURCES, read_cells, read_photos, stem_of

_HASH_ROWS = area_weights(64, 8)
_HASH_COLS = area_weights(64, 9)
_DIGIT_KIND_TARGETS = {k: kind_index(k) for k in ("printed", "handwritten")}


@dataclass(frozen=True)
class RealCell:
    path: Path
    sample: Sample
    trusted: bool  # False for a scan cell that the player left as the model answered


def cell_paths(cells_dir: Path) -> list[Path]:
    """The labelled cell files, in the order read_real_cells returns them. Never `unlabeled/`."""
    return [p for label in DIGIT_CLASSES for p in sorted((cells_dir / label).glob("*.png"))]


def read_real_cells(data: DataPaths) -> list[RealCell]:
    """Every labelled real cell of the image store. An empty cell gets `none`. A digit cell gets
    its kind from cells.csv, or UNKNOWN_KIND for `unsure`, blank or no row.

    A cell of a scan photo carries the id of that photo, so that its cells stay on one side of the
    split. Other cells keep their old grouping, so a new scan does not move them."""
    table = {stem_of(c): row for c, row in read_cells(data.cells_csv).items()}
    scans = {p.photo_id for p in read_photos(data.photos_csv) if p.source == APP_SCAN}
    cells = []
    for path in cell_paths(data.cells):
        row = table.get(path.stem)
        label = path.parent.name
        if label == "empty":
            kind = kind_index("none")
        else:
            kind = _DIGIT_KIND_TARGETS.get((row.kind if row else None) or "", UNKNOWN_KIND)
        photo = row.source[0] if row and row.source and row.source[0] in scans else ""
        image = to_cell_image(np.asarray(Image.open(path).convert("RGB")))
        trusted = (row.label_source if row else "") in TRUSTED_LABEL_SOURCES
        cells.append(RealCell(path, Sample(image, digit_index(label), kind, photo), trusted))
    return cells


def training_cells(cells: list[RealCell], include_unedited: bool = False) -> list[RealCell]:
    """The cells that training uses. A cell with the label source `app-unedited` is left out
    unless `include_unedited` is set: the player only left the model's own answer."""
    return [c for c in cells if include_unedited or c.trusted]


def load_cells(data: DataPaths, include_unedited: bool = False) -> list[Sample]:
    return [c.sample for c in training_cells(read_real_cells(data), include_unedited)]


def dhash(image: np.ndarray) -> int:
    """64-bit difference hash. Each bit: a thumbnail pixel is brighter than its left neighbour."""
    gray = image.astype(np.float32) @ np.array(BT601, dtype=np.float32)
    small = _HASH_ROWS @ gray @ _HASH_COLS.T
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return int(np.packbits(bits).view(">u8")[0])


def group_ids(samples: list[Sample], max_distance: int = 4) -> np.ndarray:
    """Group id per sample. Hashes within `max_distance` bits join one group (union-find). The
    cells of one scan photo also join one group, so the split is by photo."""
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
    first_of_photo: dict[str, int] = {}
    for i, sample in enumerate(samples):
        if sample.photo:
            parent[root(i)] = root(first_of_photo.setdefault(sample.photo, i))
    return np.array([root(i) for i in range(len(samples))])


def split_by_group(groups: np.ndarray, fractions: tuple[float, float, float], seed: int):
    """Train, validation and test indices. A group is never split."""
    unique = np.random.default_rng(seed).permutation(np.unique(groups))
    cut1 = round(len(unique) * fractions[0])
    cut2 = cut1 + round(len(unique) * fractions[1])
    sides = [set(unique[:cut1]), set(unique[cut1:cut2]), set(unique[cut2:])]
    return tuple(np.array([i for i, g in enumerate(groups) if g in side]) for side in sides)


def split_cells(
    cells: list[RealCell],
    fractions: tuple[float, float, float],
    seed: int,
    include_unedited: bool = False,
) -> tuple[list[RealCell], list[RealCell], list[RealCell]]:
    """Train, validation and test cells. Training and the Check screen both call this function,
    so that they agree on the test split. The Check screen cannot know the training flag
    and uses the default."""
    chosen = training_cells(cells, include_unedited)
    sides = split_by_group(group_ids([c.sample for c in chosen]), fractions, seed)
    return tuple([chosen[i] for i in side] for side in sides)


def stack(samples: list[Sample]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Images (N, 64, 64, 3) uint8, digit targets (N,), kind targets (N,)."""
    images = torch.from_numpy(np.stack([s.image for s in samples]))
    digit = torch.tensor([s.digit for s in samples], dtype=torch.long)
    kind = torch.tensor([s.kind for s in samples], dtype=torch.long)
    return images, digit, kind
