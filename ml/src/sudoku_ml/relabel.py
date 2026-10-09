"""Move cells to the label a person chose. Validates everything before it moves anything."""

import csv
import sys
from pathlib import Path

from sudoku_ml.contract import DIGIT_CLASSES

LABELS = (*DIGIT_CLASSES, "unlabeled")


def apply_relabels(cells_dir: Path, relabels: Path) -> int:
    current = {p.stem: p for p in cells_dir.glob("*/*.png")}
    moves = []
    with relabels.open(newline="") as handle:
        for row in csv.DictReader(handle):
            name, label = row["file"].strip(), (row["new_label"] or "").strip()
            if not label:
                continue
            if label not in LABELS:
                raise ValueError(f"{name}: unknown label {label!r}")
            if name not in current:
                raise ValueError(f"{name}: no such cell")
            if current[name].parent.name != label:
                moves.append((current[name], cells_dir / label / current[name].name))
    for source, target in moves:
        target.parent.mkdir(exist_ok=True)
        source.rename(target)
    return len(moves)


if __name__ == "__main__":
    print(apply_relabels(Path(sys.argv[1]), Path(sys.argv[2])))
