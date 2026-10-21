"""Move cells to the label a person chose. Validates everything before it moves anything."""

import csv
import sys
from pathlib import Path

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.tables import CELL_FOLDERS


def move_cells(cells_dir: Path, wanted: dict[str, str]) -> int:
    """Move each cell (file stem → digit folder). Check every move before any file moves."""
    current: dict[str, Path] = {}
    for path in sorted(cells_dir.glob("*/*.png")):
        if path.stem in current:
            other = current[path.stem].parent.name
            raise ValueError(f"{path.stem} is in two folders: {other} and {path.parent.name}")
        current[path.stem] = path
    moves = []
    for name, label in wanted.items():
        if label not in CELL_FOLDERS:
            raise ValueError(f"{name}: unknown label {label!r}")
        if name not in current:
            raise ValueError(f"{name}: no such cell")
        source = current[name]
        if source.parent.name != label:
            target = cells_dir / label / source.name
            if target.exists():
                raise ValueError(f"{name}: {target} already exists")
            moves.append((source, target))
    for source, target in moves:
        target.parent.mkdir(exist_ok=True)
        source.rename(target)
    return len(moves)


def apply_relabels(cells_dir: Path, relabels: Path) -> int:
    """Move the cells in the relabel CSV. Check every row before any file moves."""
    wanted: dict[str, str] = {}
    with relabels.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if not {"file", "new_label"} <= set(reader.fieldnames or ()):
            raise ValueError("relabel CSV needs the header file,new_label")
        for row in reader:
            line = reader.line_num
            if row["file"] is None or row["new_label"] is None:
                raise ValueError(f"line {line}: short row, needs file,new_label")
            name, label = row["file"].strip(), row["new_label"].strip()
            if not label:
                continue
            if name in wanted and wanted[name] != label:
                raise ValueError(f"{name}: two different labels ({wanted[name]}, {label})")
            wanted[name] = label
    return move_cells(cells_dir, wanted)


if __name__ == "__main__":
    print(apply_relabels(DataPaths.under().cells, Path(sys.argv[1])))
