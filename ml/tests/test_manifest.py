import csv
from pathlib import Path

import pytest
from PIL import Image

from sudoku_ml.kind_log import Line, append_records
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
    assert rows(manifest) == [{"id": cell_id, "label": "8", "kind": ""}]


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


def log_kind(log: Path, cell_id: str, kind: str | None) -> None:
    line = Line("2026-10-12T09:00:00Z", "s", "s-1", cell_id, "kind", None, kind, "groups")
    append_records(log, [line])


def test_kind_column_comes_from_the_log(tmp_path: Path):
    cells, manifest, log = tmp_path / "cells", tmp_path / "cells.csv", tmp_path / "log.jsonl"
    seven = add_cell(cells, "7", 10)
    three = add_cell(cells, "3", 20)
    empty = add_cell(cells, "empty", 200)
    other = add_cell(cells, "unlabeled", 90)
    log_kind(log, seven, "handwritten")
    write_cells_manifest(cells, manifest, log)
    kinds = {r["id"]: r["kind"] for r in rows(manifest)}
    assert kinds == {seven: "handwritten", three: "", empty: "none", other: ""}


def test_an_empty_cell_with_a_logged_kind_is_refused(tmp_path: Path):
    cells, manifest, log = tmp_path / "cells", tmp_path / "cells.csv", tmp_path / "log.jsonl"
    empty = add_cell(cells, "empty", 200)
    log_kind(log, empty, "printed")
    with pytest.raises(ValueError, match="empty cell"):
        write_cells_manifest(cells, manifest, log)


def test_a_cell_moved_to_empty_with_a_cleared_kind_is_accepted(tmp_path: Path):
    cells, manifest, log = tmp_path / "cells", tmp_path / "cells.csv", tmp_path / "log.jsonl"
    empty = add_cell(cells, "empty", 200)
    log_kind(log, empty, "printed")
    log_kind(log, empty, None)
    write_cells_manifest(cells, manifest, log)
    assert rows(manifest)[0]["kind"] == "none"


def test_a_discarded_cell_is_listed_without_a_kind(tmp_path: Path):
    cells, manifest = tmp_path / "cells", tmp_path / "cells.csv"
    cell_id = add_cell(cells, "discarded", 40)
    write_cells_manifest(cells, manifest)
    assert rows(manifest) == [{"id": cell_id, "label": "discarded", "kind": ""}]
