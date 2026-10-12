import csv
from pathlib import Path

import pytest
from PIL import Image

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.journal import Line, append_records, read_journal
from sudoku_ml.manifest import (
    CELL_FIELDS,
    pixel_id,
    read_cells_table,
    repair_and_write,
    write_cells_manifest,
)

PHOTO = "f" * 64


def add_cell(cells: Path, digit: str, colour: int) -> str:
    tmp = cells / "tmp.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    Image.new("RGB", (71, 71), (colour,) * 3).save(tmp)
    cell_id = pixel_id(tmp)
    (cells / digit).mkdir(exist_ok=True)
    tmp.rename(cells / digit / f"{cell_id[:16]}.png")
    return cell_id


def rows(manifest: Path) -> list[dict[str, str]]:
    with manifest.open(newline="") as f:
        return list(csv.DictReader(f))


def row(cell_id: str, digit: str, kind: str = "", photo: str = "", r="", c="") -> dict:
    return dict(zip(CELL_FIELDS, [cell_id, digit, kind, photo, str(r), str(c)], strict=True))


@pytest.fixture
def paths(tmp_path: Path) -> DataPaths:
    return DataPaths.under(tmp_path / "data")


def journal_line(paths: DataPaths, cell_id: str, field: str, new, old=None) -> None:
    line = Line("2026-10-12T09:00:00Z", "s", "s-1", cell_id, field, old, new, "groups")
    append_records(paths.journal, [line])


def test_one_row_per_cell_sorted_by_digit(paths: DataPaths):
    add_cell(paths.cells, "7", 10)
    add_cell(paths.cells, "empty", 200)
    assert write_cells_manifest(paths) == 2
    assert [r["digit"] for r in rows(paths.cells_csv)] == ["7", "empty"]


def test_the_file_has_unix_line_ends(paths: DataPaths):
    add_cell(paths.cells, "7", 10)
    write_cells_manifest(paths)
    assert b"\r" not in paths.cells_csv.read_bytes()
    assert paths.cells_csv.read_text().startswith("cell_id,digit,kind,photo_id,row,col\n")


def test_moved_cell_gets_its_new_digit(paths: DataPaths):
    cell_id = add_cell(paths.cells, "unlabeled", 30)
    (paths.cells / "8").mkdir()
    (paths.cells / "unlabeled" / f"{cell_id[:16]}.png").rename(
        paths.cells / "8" / f"{cell_id[:16]}.png"
    )
    write_cells_manifest(paths)
    assert rows(paths.cells_csv) == [row(cell_id, "8")]


def test_rejects_a_misnamed_file(paths: DataPaths):
    cell_id = add_cell(paths.cells, "3", 50)
    (paths.cells / "3" / f"{cell_id[:16]}.png").rename(paths.cells / "3" / "0000000000000000.png")
    with pytest.raises(ValueError):
        write_cells_manifest(paths)


def test_rejects_an_unknown_folder(paths: DataPaths):
    add_cell(paths.cells, "3", 50)
    add_cell(paths.cells, "bogus", 60)
    with pytest.raises(ValueError, match="bogus"):
        write_cells_manifest(paths)


def test_rejects_a_duplicate_id(paths: DataPaths):
    add_cell(paths.cells, "3", 50)
    add_cell(paths.cells, "4", 50)
    with pytest.raises(ValueError, match="same pixels"):
        write_cells_manifest(paths)


def test_the_journal_folds_into_the_kind_and_source_columns(paths: DataPaths):
    seven = add_cell(paths.cells, "7", 10)
    three = add_cell(paths.cells, "3", 20)
    empty = add_cell(paths.cells, "empty", 200)
    other = add_cell(paths.cells, "unlabeled", 90)
    journal_line(paths, seven, "kind", "handwritten")
    journal_line(paths, other, "source", f"{PHOTO} 4 8")
    write_cells_manifest(paths)
    assert rows(paths.cells_csv) == [
        row(three, "3"),
        row(seven, "7", "handwritten"),
        row(empty, "empty"),
        row(other, "unlabeled", "", PHOTO, 4, 8),
    ]


def test_the_table_is_the_base_after_the_journal_is_gone(paths: DataPaths):
    seven = add_cell(paths.cells, "7", 10)
    journal_line(paths, seven, "kind", "printed")
    journal_line(paths, seven, "source", f"{PHOTO} 0 1")
    write_cells_manifest(paths)
    paths.journal.unlink()
    write_cells_manifest(paths)
    assert rows(paths.cells_csv) == [row(seven, "7", "printed", PHOTO, 0, 1)]
    table = read_cells_table(paths.cells_csv)
    assert table[seven].kind == "printed" and table[seven].source == (PHOTO, 0, 1)


def test_a_fold_twice_gives_the_same_table(paths: DataPaths):
    seven = add_cell(paths.cells, "7", 10)
    journal_line(paths, seven, "kind", "printed")
    write_cells_manifest(paths)
    first = paths.cells_csv.read_text()
    write_cells_manifest(paths)
    assert paths.cells_csv.read_text() == first


def test_an_empty_cell_with_a_kind_is_refused(paths: DataPaths):
    empty = add_cell(paths.cells, "empty", 200)
    journal_line(paths, empty, "kind", "printed")
    with pytest.raises(ValueError, match="empty cell"):
        write_cells_manifest(paths)


def test_a_cell_moved_to_empty_with_a_cleared_kind_is_accepted(paths: DataPaths):
    empty = add_cell(paths.cells, "empty", 200)
    journal_line(paths, empty, "kind", "printed")
    journal_line(paths, empty, "kind", None, "printed")
    write_cells_manifest(paths)
    assert rows(paths.cells_csv)[0]["kind"] == ""


def test_a_discarded_cell_is_listed_without_a_kind(paths: DataPaths):
    cell_id = add_cell(paths.cells, "discarded", 40)
    write_cells_manifest(paths)
    assert rows(paths.cells_csv) == [row(cell_id, "discarded")]


def test_a_table_that_does_not_parse_is_never_rebuilt(paths: DataPaths):
    add_cell(paths.cells, "7", 10)
    paths.cells_csv.write_text("id,label,kind\n")
    with pytest.raises(ValueError, match="Restore it from git."):
        write_cells_manifest(paths)
    assert paths.cells_csv.read_text() == "id,label,kind\n"


@pytest.mark.parametrize(
    "source", [f"{PHOTO},1,", f"{PHOTO},9,0", "abc,1,1", ",1,1", f"{PHOTO},x,1"]
)
def test_a_bad_source_does_not_parse(paths: DataPaths, source: str):
    paths.root.mkdir(parents=True)
    paths.cells_csv.write_text(f"cell_id,digit,kind,photo_id,row,col\n{'a' * 64},7,,{source}\n")
    with pytest.raises(ValueError, match="line 2"):
        read_cells_table(paths.cells_csv)


def test_repair_drops_the_kind_of_a_cell_that_left_the_digit_folders(paths: DataPaths):
    seven = add_cell(paths.cells, "7", 10)
    journal_line(paths, seven, "kind", "printed")
    write_cells_manifest(paths)
    paths.journal.unlink()
    (paths.cells / "empty").mkdir()
    (paths.cells / "7" / f"{seven[:16]}.png").rename(paths.cells / "empty" / f"{seven[:16]}.png")
    with pytest.raises(ValueError, match="empty cell"):
        write_cells_manifest(paths)
    assert repair_and_write(paths) == 1
    assert rows(paths.cells_csv) == [row(seven, "empty")]
    assert [x.screen for x in read_journal(paths.journal)] == ["repair"]
