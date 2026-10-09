"""Write ml/datasets/cells.csv from the folders in ml/data/cells/ (ADR-009)."""

import csv
import hashlib
from pathlib import Path

from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES

LABELS = (*DIGIT_CLASSES, "unlabeled")


def pixel_id(path: Path) -> str:
    """SHA-256 of `<width>x<height>` followed by the RGB pixel bytes (see ml/README.md)."""
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        digest = hashlib.sha256(f"{rgb.width}x{rgb.height}".encode())
        digest.update(rgb.tobytes())
    return digest.hexdigest()


def write_cells_manifest(cells_dir: Path, manifest: Path) -> int:
    """Rewrite the manifest from the folders. A cell's label is the folder it is in.

    Raises ValueError on an unknown folder, a misnamed file or a duplicate id.
    """
    for folder in cells_dir.iterdir():
        if folder.is_dir() and folder.name not in LABELS:
            raise ValueError(f"{folder} is not a known label")
    rows = []
    seen: set[str] = set()
    for path in sorted(cells_dir.glob("*/*.png")):
        cell_id = pixel_id(path)
        if path.stem != cell_id[:16]:
            raise ValueError(f"{path} is not named after its pixels ({cell_id[:16]})")
        if cell_id in seen:
            raise ValueError(f"{path} has the same pixels as another cell ({cell_id[:16]})")
        seen.add(cell_id)
        rows.append([cell_id, path.parent.name])
    rows.sort(key=lambda row: (row[1], row[0]))
    with manifest.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "label"])
        writer.writerows(rows)
    return len(rows)


if __name__ == "__main__":
    ml_root = Path(__file__).parents[2]
    print(write_cells_manifest(ml_root / "data" / "cells", ml_root / "datasets" / "cells.csv"))
