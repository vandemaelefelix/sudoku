from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from sudoku_ml.tables import (
    CELL_FIELDS,
    CellRow,
    PhotoRow,
    audit_cells,
    photo_row_problems,
    pixel_id,
    pixel_id_of,
    read_cells,
    read_photos,
    write_cells,
    write_photos,
)

A, B, C = "a" * 64, "b" * 64, "c" * 64
PHOTO = "f" * 64
HEADER = ",".join(CELL_FIELDS) + "\n"


def test_cells_round_trip_sorted_by_digit_then_id(tmp_path: Path):
    path = tmp_path / "cells.csv"
    rows = [
        CellRow(B, "7", "printed", (PHOTO, 4, 8), "app-edited"),
        CellRow(A, "7", None, None),
        CellRow(C, "empty", None, None, "verified"),
    ]
    write_cells(path, rows)
    assert list(read_cells(path)) == [A, B, C]
    assert read_cells(path)[B] == rows[0]
    text = path.read_bytes()
    assert b"\r" not in text and text.startswith(HEADER.encode())
    assert not list(tmp_path.glob("*.part"))


def test_the_columns_stay_as_on_disk(tmp_path: Path):
    path = tmp_path / "cells.csv"
    write_cells(path, [CellRow(A, "7", "printed", (PHOTO, 1, 2), "verified")])
    assert path.read_text() == HEADER + f"{A},7,printed,{PHOTO},1,2,verified\n"


def test_a_missing_table_is_empty(tmp_path: Path):
    assert read_cells(tmp_path / "cells.csv") == {}
    assert read_photos(tmp_path / "sudoku-photos.csv") == []


@pytest.mark.parametrize(
    "row",
    [
        CellRow("abc", "7", None, None),
        CellRow(A, "7", "typed", None),
        CellRow(A, "7", None, (PHOTO, 9, 0)),
        CellRow(A, "7", None, ("abc", 0, 0)),
        CellRow(A, "7", None, None, "guess"),
    ],
)
def test_the_writer_refuses_a_row_that_the_reader_refuses(tmp_path: Path, row: CellRow):
    path = tmp_path / "cells.csv"
    path.write_text("old")
    with pytest.raises(ValueError):
        write_cells(path, [row])
    assert path.read_text() == "old"


def test_the_reader_names_the_line_of_a_bad_row(tmp_path: Path):
    path = tmp_path / "cells.csv"
    path.write_text(HEADER + f"{A},7,,,,,\n{B},7,typed,,,,\n")
    with pytest.raises(ValueError, match=r"line 3: unknown kind 'typed'.*Restore it from git."):
        read_cells(path)


def test_the_reader_refuses_a_header_in_another_order(tmp_path: Path):
    path = tmp_path / "cells.csv"
    path.write_text("digit,cell_id,kind,photo_id,row,col,label_source\n")
    with pytest.raises(ValueError, match="the header is not cell_id,digit"):
        read_cells(path)


def test_the_audit_sorts_the_bad_rows_without_stopping(tmp_path: Path):
    path = tmp_path / "cells.csv"
    path.write_text(
        HEADER
        + f"{A},7,,,,,\n"
        + f"{A},7,,,,,\n"  # twice
        + "abc,7,,,,,\n"  # not an id
        + f"{B},empty,printed,,,,\n"  # a kind on an empty cell
        + f"{C},7,,{PHOTO},1,,\n"  # half a source
        + f"{'d' * 64},7,,,,,guess\n"
    )
    audit = audit_cells(path)
    assert (audit.bad_id, audit.twice) == (["abc"], [A])
    assert (audit.bad_kind, audit.bad_source) == ([B], [C])
    assert audit.bad_label_source == ["d" * 64]
    assert list(audit.rows) == [A, B, C, "d" * 64]
    assert audit.unreadable is None


def test_the_audit_says_when_the_file_does_not_parse(tmp_path: Path):
    path = tmp_path / "cells.csv"
    path.write_text("id,label\n")
    assert "the header is not" in (audit_cells(path).unreadable or "")


def test_photos_round_trip_in_file_order(tmp_path: Path):
    path = tmp_path / "sudoku-photos.csv"
    rows = [PhotoRow(PHOTO, "f.jpg", "phone", "own", "", "pending", ""), PhotoRow(*"abcdefg")]
    write_photos(path, rows)
    assert read_photos(path) == rows


def test_the_photo_rules_are_one_list_per_row():
    sound = PhotoRow(
        PHOTO, "f.jpg", "app-scan", "player-contributed", "", "accepted", "1 2 3 4 5 6 7 8"
    )
    assert photo_row_problems(sound) == []
    broken = PhotoRow(PHOTO, "f.jpg", "reddit", "none", "", "rejected", "1 2")
    assert photo_row_problems(broken) == ["unknown source 'reddit'", "corners on a rejected photo"]


def test_one_pixel_id_for_a_file_and_for_an_array(tmp_path: Path):
    pixels = np.random.default_rng(0).integers(0, 256, (9, 7, 3), dtype=np.uint8)
    Image.fromarray(pixels).save(tmp_path / "cell.png")
    assert pixel_id(tmp_path / "cell.png") == pixel_id_of(pixels)
