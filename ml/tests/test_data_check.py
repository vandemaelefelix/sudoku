import json
import shutil
from pathlib import Path

import pytest
from photos import grid_photo, save_photo, valid_root

from sudoku_ml.data_check import check_data, format_report, main
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.manifest import write_cells_manifest


def test_a_valid_root_has_no_problems_and_a_report(tmp_path: Path):
    report = check_data(valid_root(tmp_path))
    assert report["problems"] == []
    assert report["photos"] == {"pending": 1, "accepted": 1, "rejected": 1}
    assert report["waiting_cells"] > 0 and report["pending_photos"] == 1
    assert report["linked"] == report["total_cells"] - 2
    assert report["cells"]["discarded"] == 1
    assert report["kinds"] == {"printed": 0, "handwritten": 0, "unsure": 0, "without": 0}
    text = format_report(report)
    assert f"Linked {report['linked']} of {report['total_cells']} cells. Cells without" in text
    assert "Waiting:" in text and "Sudoku photos: pending 1" in text


def test_the_kinds_count_the_digit_cells(tmp_path: Path):
    paths = valid_root(tmp_path)
    cell = next((paths.cells / "unlabeled").glob("*.png"))
    (paths.cells / "4").mkdir()
    cell.rename(paths.cells / "4" / cell.name)
    write_cells_manifest(paths)
    assert check_data(paths)["kinds"]["without"] == 1


def test_main_exits_with_1_on_a_problem(tmp_path: Path, capsys: pytest.CaptureFixture):
    paths = valid_root(tmp_path)
    assert main([], paths) == 0
    next(paths.photos.iterdir()).unlink()
    assert main([], paths) == 1
    assert "does not exist" in capsys.readouterr().out


def corrupt_name(paths: DataPaths):
    path = next((paths.cells / "unlabeled").glob("*.png"))
    path.rename(path.with_name("0" * 16 + ".png"))


def duplicate_cell(paths: DataPaths):
    path = next((paths.cells / "unlabeled").glob("*.png"))
    other = paths.cells / "1"
    other.mkdir()
    shutil.copy(path, other / path.name)


def edit_rows(path: Path, change) -> None:
    lines = path.read_text().splitlines()
    path.write_text("\n".join(change(lines)) + "\n")


def stale_manifest(paths: DataPaths):
    edit_rows(paths.cells_csv, lambda rows: rows[:-1])


def first_cell_row(paths: DataPaths, change) -> None:
    def apply(rows: list[str]) -> list[str]:
        index = next(i for i, r in enumerate(rows) if ",unlabeled," in r)
        rows[index] = ",".join(change(rows[index].split(",")))
        return rows

    edit_rows(paths.cells_csv, apply)


def two_rows_for_one_cell(paths: DataPaths):
    edit_rows(paths.cells_csv, lambda rows: [*rows, rows[-1]])


def digit_other_than_folder(paths: DataPaths):
    first_cell_row(paths, lambda r: [r[0], "5", *r[2:]])


def kind_on_a_waiting_cell(paths: DataPaths):
    first_cell_row(paths, lambda r: [r[0], r[1], "printed", *r[3:]])


def unknown_kind(paths: DataPaths):
    first_cell_row(paths, lambda r: [r[0], r[1], "typed", *r[3:]])


def source_of_an_unknown_photo(paths: DataPaths):
    first_cell_row(paths, lambda r: [*r[:3], "b" * 64, *r[4:]])


def half_a_source(paths: DataPaths):
    first_cell_row(paths, lambda r: [*r[:4], "", r[5]])


def row_out_of_range(paths: DataPaths):
    first_cell_row(paths, lambda r: [*r[:4], "9", r[5]])


def duplicate_photo_row(paths: DataPaths):
    edit_rows(paths.photos_csv, lambda rows: [*rows, rows[1]])


def photo_column(paths: DataPaths, status: str, change) -> None:
    def apply(rows: list[str]) -> list[str]:
        index = next(i for i, r in enumerate(rows) if f",{status}," in r)
        rows[index] = ",".join(change(rows[index].split(",")))
        return rows

    edit_rows(paths.photos_csv, apply)


def unknown_status(paths: DataPaths):
    photo_column(paths, "pending", lambda r: [*r[:5], "maybe", r[6]])


def accepted_without_corners(paths: DataPaths):
    photo_column(paths, "accepted", lambda r: [*r[:6], "1 2 3"])


def corners_on_a_rejected_photo(paths: DataPaths):
    photo_column(paths, "rejected", lambda r: [*r[:6], "1 2 3 4 5 6 7 8"])


def unknown_source(paths: DataPaths):
    photo_column(paths, "pending", lambda r: [r[0], r[1], "reddit", *r[3:]])


def wrong_photo_file(paths: DataPaths):
    save_photo(grid_photo(seed=99), next(paths.photos.iterdir()))


def unlisted_photo_file(paths: DataPaths):
    save_photo(grid_photo(seed=42), paths.photos / "0123456789abcdef.png")


def unknown_folder(paths: DataPaths):
    (paths.cells / "extra").mkdir()


def journal_line(cell: str) -> str:
    fields = ["t", "session", "action", "cell", "field", "old", "new", "screen"]
    values = ["2026-10-12T09:00:00Z", "s", "s-1", cell, "kind", None, "printed", "groups"]
    return json.dumps(dict(zip(fields, values, strict=True))) + "\n"


def journal_with_short_id(paths: DataPaths):
    with paths.journal.open("a") as handle:
        handle.write(journal_line("a" * 30))


def journal_with_missing_cell(paths: DataPaths):
    with paths.journal.open("a") as handle:
        handle.write(journal_line("a" * 64))


@pytest.mark.parametrize(
    ("corrupt", "message"),
    [
        (corrupt_name, "not named after its pixels"),
        (duplicate_cell, "has the same pixels"),
        (stale_manifest, "just dataset-manifest"),
        (two_rows_for_one_cell, "cells are twice in cells.csv"),
        (digit_other_than_folder, "another digit than the folder"),
        (kind_on_a_waiting_cell, "kind that is not allowed"),
        (unknown_kind, "kind that is not allowed"),
        (source_of_an_unknown_photo, "photo_id that sudoku-photos.csv does not list"),
        (half_a_source, "bad source"),
        (row_out_of_range, "bad source"),
        (duplicate_photo_row, "is twice in"),
        (unknown_status, "unknown status"),
        (accepted_without_corners, "accepted without 4 corners"),
        (corners_on_a_rejected_photo, "corners on a rejected photo"),
        (unknown_source, "unknown source"),
        (wrong_photo_file, "has the id"),
        (unknown_folder, "not a known cell folder"),
        (unlisted_photo_file, "sudoku photo files that sudoku-photos.csv does not list"),
        (journal_with_short_id, "are not full ids"),
        (journal_with_missing_cell, "match no cell"),
    ],
)
def test_one_corrupt_thing_is_one_reported_problem(tmp_path: Path, corrupt, message):
    paths = valid_root(tmp_path)
    corrupt(paths)
    problems = check_data(paths)["problems"]
    assert any(message in p for p in problems), problems
    if corrupt is duplicate_cell:
        assert any("another digit than the folder" in p for p in problems), problems
