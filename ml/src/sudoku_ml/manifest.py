"""Write ml/datasets/cells.csv from the folders in ml/data/cells/ and the kind log (ADR-009)."""

import csv
import hashlib
from pathlib import Path

from PIL import Image

from sudoku_ml.contract import DIGIT_CLASSES
from sudoku_ml.kind_log import current_kinds, read_log

# Training reads only DIGIT_CLASSES. `unlabeled` waits for a label. `discarded` holds cells that
# a person rejected in the digit pass: bad cuts, unreadable marks.
LABELS = (*DIGIT_CLASSES, "unlabeled", "discarded")


def pixel_id(path: Path) -> str:
    """SHA-256 of `<width>x<height>` followed by the RGB pixel bytes (see ml/README.md)."""
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        digest = hashlib.sha256(f"{rgb.width}x{rgb.height}".encode())
        digest.update(rgb.tobytes())
    return digest.hexdigest()


def _kind_column(cell_id: str, label: str, logged: str | None) -> str:
    if label == "empty":
        if logged is not None:
            raise ValueError(f"{cell_id[:16]}: an empty cell has the logged kind {logged}")
        return "none"
    if label in ("unlabeled", "discarded"):
        return ""
    return logged or ""


def write_cells_manifest(cells_dir: Path, manifest: Path, log: Path | None = None) -> int:
    """Rewrite the manifest from the folders and the kind log. The folder is the digit label.

    Raises ValueError on an unknown folder, a misnamed file, a duplicate id, or a logged kind
    on an empty cell.
    """
    kinds = current_kinds(read_log(log)) if log else {}
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
        label = path.parent.name
        rows.append([cell_id, label, _kind_column(cell_id, label, kinds.get(cell_id))])
    rows.sort(key=lambda row: (row[1], row[0]))
    with manifest.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["id", "label", "kind"])
        writer.writerows(rows)
    return len(rows)


if __name__ == "__main__":
    ml_root = Path(__file__).parents[2]
    datasets = ml_root / "datasets"
    print(
        write_cells_manifest(
            ml_root / "data" / "cells", datasets / "cells.csv", datasets / "kind-log.jsonl"
        )
    )
