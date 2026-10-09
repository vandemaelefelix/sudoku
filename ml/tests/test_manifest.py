import csv
from pathlib import Path

import pytest
from PIL import Image

from sudoku_ml.manifest import pixel_id, write_cells_manifest


def add_cell(cells: Path, label: str, colour: int) -> str:
    tmp = cells / "tmp.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (71, 71), (colour,) * 3).save(tmp)
    cell_id = pixel_id(tmp)
    (cells / label).mkdir(exist_ok=True)
    tmp.rename(cells / label / f"{cell_id[:16]}.png")
    return cell_id


def rows(manifest: Path) -> list[dict[str, str]]:
    with manifest.open(newline="") as f:
        return list(csv.DictReader(f))


def test_one_row_per_cell_sorted_by_label(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    add_cell(cells, "7", 10)
    add_cell(cells, "empty", 200)
    assert write_cells_manifest(cells, manifest) == 2
    assert [r["label"] for r in rows(manifest)] == ["7", "empty"]


def test_moved_cell_gets_its_new_label(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    cell_id = add_cell(cells, "unlabeled", 30)
    (cells / "8").mkdir()
    (cells / "unlabeled" / f"{cell_id[:16]}.png").rename(cells / "8" / f"{cell_id[:16]}.png")
    write_cells_manifest(cells, manifest)
    assert rows(manifest) == [{"id": cell_id, "label": "8"}]


def test_rejects_a_misnamed_file(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    cell_id = add_cell(cells, "3", 50)
    (cells / "3" / f"{cell_id[:16]}.png").rename(cells / "3" / "0000000000000000.png")
    with pytest.raises(ValueError):
        write_cells_manifest(cells, manifest)


def test_rejects_an_unknown_label_folder(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    add_cell(cells, "3", 50)
    add_cell(cells, "bogus", 60)
    with pytest.raises(ValueError, match="bogus"):
        write_cells_manifest(cells, manifest)


def test_rejects_a_duplicate_id(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    add_cell(cells, "3", 50)
    add_cell(cells, "4", 50)
    with pytest.raises(ValueError, match="same pixels"):
        write_cells_manifest(cells, manifest)
