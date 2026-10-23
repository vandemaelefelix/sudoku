"""Real cells, near-duplicate groups and a split that keeps each group on one side (ADR-035)."""

import hashlib
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES, UNKNOWN_KIND, digit_index, kind_index
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.preprocess import BT601, area_weights, to_cell_image
from sudoku_ml.synthetic import Sample
from sudoku_ml.tables import (
    APP_SCAN,
    TRUSTED_LABEL_SOURCES,
    CellRow,
    read_cells,
    read_photos,
    stem_of,
)

_HASH_ROWS = area_weights(64, 8)
_HASH_COLS = area_weights(64, 9)
_DIGIT_KIND_TARGETS = {k: kind_index(k) for k in ("printed", "handwritten")}
SAME_PAGE_MIN_DIGITS = 10  # digit cells that two photos must share at the same position
SAME_PAGE_AGREEMENT = 0.9  # share of those cells that must hold the same digit


@dataclass(frozen=True)
class RealCell:
    path: Path
    sample: Sample
    trusted: bool  # False for a scan cell that no person has verified


def cell_paths(cells_dir: Path) -> list[Path]:
    """The labelled cell files, in the order read_real_cells returns them. Never `unlabeled/`."""
    return [p for label in DIGIT_CLASSES for p in sorted((cells_dir / label).glob("*.png"))]


def page_keys(rows: list[CellRow]) -> dict[str, str]:
    """Photo id → the key of its page: the smallest photo id of the photos that show the same
    sudoku page. Two photos show the same page when they share at least SAME_PAGE_MIN_DIGITS digit
    cells at the same position, and SAME_PAGE_AGREEMENT of them hold the same digit."""
    photos = sorted({r.source[0] for r in rows if r.source})
    index = {p: i for i, p in enumerate(photos)}
    # One-hot (photo, position, digit), so a matrix product counts the shared and the equal cells.
    onehot = np.zeros((len(photos), 81, 9), dtype=np.float32)
    for r in rows:
        if r.source and r.digit in DIGIT_CLASSES[1:]:
            cell = onehot[index[r.source[0]], r.source[1] * 9 + r.source[2]]
            # Two rows at one position keep one digit, so `equal` never exceeds `shared`.
            cell[:] = 0
            cell[int(r.digit) - 1] = 1
    flat = onehot.reshape(len(photos), 81 * 9)
    filled = onehot.max(axis=2)
    shared, equal = filled @ filled.T, flat @ flat.T
    same = (shared >= SAME_PAGE_MIN_DIGITS) & (equal >= SAME_PAGE_AGREEMENT * shared)
    parent = list(range(len(photos)))

    def root(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for a, b in zip(*np.nonzero(np.triu(same, k=1)), strict=True):
        ra, rb = root(int(a)), root(int(b))
        parent[max(ra, rb)] = min(ra, rb)
    return {p: photos[root(i)] for i, p in enumerate(photos)}


def read_real_cells(data: DataPaths) -> list[RealCell]:
    """Every labelled real cell of the image store. An empty cell gets `none`. A digit cell gets
    its kind from cells.csv, or UNKNOWN_KIND for `unsure`, blank or no row.

    A cell with a source photo carries the key of its page, so that the cells of one page stay on
    one side of the split (ADR-035). A cell of a scan whose first source photo has an outline that
    is not `accepted` is left out, unless a person verified the cell: an unchecked outline can cut
    every cell wrong."""
    cells_table = read_cells(data.cells_csv)
    table = {stem_of(c): row for c, row in cells_table.items()}
    pages = page_keys(list(cells_table.values()))
    photos = [p for p in read_photos(data.photos_csv) if p.source == APP_SCAN]
    unchecked = {p.photo_id for p in photos if p.status != "accepted"}
    cells = []
    for path in cell_paths(data.cells):
        row = table.get(path.stem)
        # The code reads only the first source photo of the row. It keeps a verified cell: a person
        # checked its pixels, so a later unchecked outline of the same pixels does not drop it.
        if row and row.source and row.source[0] in unchecked and row.label_source != "verified":
            continue
        label = path.parent.name
        if label == "empty":
            kind = kind_index("none")
        else:
            kind = _DIGIT_KIND_TARGETS.get((row.kind if row else None) or "", UNKNOWN_KIND)
        photo = pages[row.source[0]] if row and row.source else ""
        image = to_cell_image(np.asarray(Image.open(path).convert("RGB")))
        trusted = (row.label_source if row else "") in TRUSTED_LABEL_SOURCES
        cells.append(RealCell(path, Sample(image, digit_index(label), kind, photo), trusted))
    return cells


def training_cells(cells: list[RealCell]) -> list[RealCell]:
    """The cells that training uses. A scan cell with the label source `app-edited` or
    `app-unedited` is left out until a person verifies it (ADR-030, amendment 2026-10-22)."""
    return [c for c in cells if c.trusted]


def load_cells(data: DataPaths) -> list[Sample]:
    return [c.sample for c in training_cells(read_real_cells(data))]


def dhash(image: np.ndarray) -> int:
    """64-bit difference hash. Each bit: a thumbnail pixel is brighter than its left neighbour."""
    gray = image.astype(np.float32) @ np.array(BT601, dtype=np.float32)
    small = _HASH_ROWS @ gray @ _HASH_COLS.T
    bits = (small[:, 1:] > small[:, :-1]).flatten()
    return int(np.packbits(bits).view(">u8")[0])


def group_ids(samples: list[Sample], max_distance: int = 4) -> np.ndarray:
    """Group id per sample. Hashes within `max_distance` bits join one group (union-find). The
    cells of one page also join one group, so the split is by page."""
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


def side_of(key: str, fractions: tuple[float, float, float], seed: int) -> int:
    """0 (train), 1 (validation) or 2 (test). Depends only on the key and the seed, so new cells
    never move an existing group to another side."""
    digest = hashlib.sha256(f"{seed}:{key}".encode()).digest()
    u = int.from_bytes(digest[:8], "big") / 2**64
    return 0 if u < fractions[0] else 1 if u < fractions[0] + fractions[1] else 2


def split_by_group(
    groups: np.ndarray, keys: list[str], fractions: tuple[float, float, float], seed: int
):
    """Train, validation and test indices. A group is never split. The side of a group comes from
    the smallest key of its members."""
    group_key: dict[int, str] = {}
    for g, key in zip(groups.tolist(), keys, strict=True):
        group_key[g] = min(group_key.get(g, key), key)
    sides = np.array([side_of(group_key[g], fractions, seed) for g in groups.tolist()])
    return tuple(np.nonzero(sides == side)[0] for side in range(3))


def split_cells(
    cells: list[RealCell],
    fractions: tuple[float, float, float],
    seed: int,
) -> tuple[list[RealCell], list[RealCell], list[RealCell]]:
    """Train, validation and test cells. Training and the Check screen both call this function,
    so that they agree on the test split. The key of a cell is its page, or else its file name."""
    chosen = training_cells(cells)
    groups = group_ids([c.sample for c in chosen])
    keys = [c.sample.photo or c.path.stem for c in chosen]
    sides = split_by_group(groups, keys, fractions, seed)
    return tuple([chosen[i] for i in side] for side in sides)


def stack(samples: list[Sample]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Images (N, 64, 64, 3) uint8, digit targets (N,), kind targets (N,)."""
    images = torch.from_numpy(np.stack([s.image for s in samples]))
    digit = torch.tensor([s.digit for s in samples], dtype=torch.long)
    kind = torch.tensor([s.kind for s in samples], dtype=torch.long)
    return images, digit, kind
