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
RESTORE = "Restore it from git."
_HASH_ROWS = area_weights(64, 8)
_HASH_COLS = area_weights(64, 9)


def cell_paths(cells_dir: Path) -> list[Path]:
    """The labelled cell files, in the order load_cells returns them. Never `unlabeled/`."""
    return [p for label in DIGIT_CLASSES for p in sorted((cells_dir / label).glob("*.png"))]


def read_ids(manifest: Path) -> dict[str, str]:
    """File stem → full cell id, from cells.csv. Raises ValueError on an id that is not 64 hex
    characters: a stop during a write can cut the last row."""
    found = {}
    try:
        with manifest.open(newline="") as handle:
            for line, row in enumerate(csv.DictReader(handle, strict=True), start=2):
                if not FULL_ID.fullmatch(row.get("cell_id") or ""):
                    cell = row.get("cell_id")
                    raise ValueError(f"{manifest} line {line}: {cell!r} is not a cell id")
                found[row["cell_id"][:16]] = row["cell_id"]
    except csv.Error as error:
        raise ValueError(f"{manifest} cannot be read ({error}). {RESTORE}") from error
    return found


def read_kinds(manifest: Path) -> dict[str, str]:
    """File stem → the kind column of cells.csv. Raises ValueError when it does not parse."""
    try:
        with manifest.open(newline="") as handle:
            return {
                row["cell_id"][:16]: row.get("kind") or ""
                for row in csv.DictReader(handle, strict=True)
            }
    except (csv.Error, KeyError, TypeError) as error:
        raise ValueError(f"{manifest} cannot be read ({error}). {RESTORE}") from error


# The labels that training trusts by default. An empty value is a cell from before the column.
TRUSTED_LABEL_SOURCES = ("", "verified", "app-edited")
APP_SCAN = "app-scan"


def read_label_sources(manifest: Path) -> dict[str, str]:
    """File stem → the label_source column of cells.csv. Raises ValueError if it does not parse."""
    try:
        with manifest.open(newline="") as handle:
            return {
                row["cell_id"][:16]: row.get("label_source") or ""
                for row in csv.DictReader(handle, strict=True)
            }
    except (csv.Error, KeyError, TypeError) as error:
        raise ValueError(f"{manifest} cannot be read ({error}). {RESTORE}") from error


def _scan_photo_of_cells(manifest: Path) -> dict[str, str]:
    """File stem → photo id, for the cells of scan photos only. Other cells keep their old
    grouping, so this change does not move them to another side of the split."""
    photos = manifest.with_name("sudoku-photos.csv")
    if not photos.exists():
        return {}
    with photos.open(newline="") as handle:
        scans = {r["photo_id"] for r in csv.DictReader(handle) if r.get("source") == APP_SCAN}
    with manifest.open(newline="") as handle:
        return {
            r["cell_id"][:16]: r["photo_id"]
            for r in csv.DictReader(handle)
            if r.get("photo_id") in scans
        }


_DIGIT_KIND_TARGETS = {k: kind_index(k) for k in ("printed", "handwritten")}


def load_cells(
    cells_dir: Path, manifest: Path | None = None, include_unedited: bool = False
) -> list[Sample]:
    """The labelled real cells of `cells_dir` (`<images>/cells`). An empty cell gets `none`. A
    digit cell gets its kind from the manifest (`ml/dataset/cells.csv`), or UNKNOWN_KIND for
    `unsure`, blank or no manifest.

    A cell with the label source `app-unedited` is left out unless `include_unedited` is set: the
    player only left the model's own answer."""
    known = manifest is not None and manifest.exists()
    kinds = read_kinds(manifest) if known else {}
    sources = read_label_sources(manifest) if known else {}
    photos = _scan_photo_of_cells(manifest) if known else {}
    samples = []
    for path in cell_paths(cells_dir):
        label = path.parent.name
        if not include_unedited and sources.get(path.stem, "") not in TRUSTED_LABEL_SOURCES:
            continue
        image = to_cell_image(np.asarray(Image.open(path).convert("RGB")))
        if label == "empty":
            kind = kind_index("none")
        else:
            kind = _DIGIT_KIND_TARGETS.get(kinds.get(path.stem, ""), UNKNOWN_KIND)
        samples.append(Sample(image, digit_index(label), kind, photos.get(path.stem, "")))
    return samples


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


def stack(samples: list[Sample]) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Images (N, 64, 64, 3) uint8, digit targets (N,), kind targets (N,)."""
    images = torch.from_numpy(np.stack([s.image for s in samples]))
    digit = torch.tensor([s.digit for s in samples], dtype=torch.long)
    kind = torch.tensor([s.kind for s in samples], dtype=torch.long)
    return images, digit, kind
