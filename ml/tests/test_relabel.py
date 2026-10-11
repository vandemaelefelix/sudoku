from pathlib import Path

import pytest

from sudoku_ml.relabel import apply_relabels, move_cells


def tree(tmp_path: Path) -> Path:
    cells = tmp_path / "cells"
    for label, name in [
        ("6", "aaaaaaaaaaaaaaaa"),
        ("4", "bbbbbbbbbbbbbbbb"),
        ("7", "cccccccccccccccc"),
    ]:
        (cells / label).mkdir(parents=True)
        (cells / label / f"{name}.png").write_bytes(b"x")
    return cells


def write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "relabels.csv"
    path.write_text("file,new_label\n" + text)
    return path


def test_moves_files_and_skips_empty_rows(tmp_path: Path):
    cells = tree(tmp_path)
    moved = apply_relabels(
        cells,
        write(tmp_path, "aaaaaaaaaaaaaaaa,3\nbbbbbbbbbbbbbbbb,\ncccccccccccccccc,unlabeled\n"),
    )
    assert moved == 2
    assert (cells / "3" / "aaaaaaaaaaaaaaaa.png").exists()
    assert (cells / "4" / "bbbbbbbbbbbbbbbb.png").exists()
    assert (cells / "unlabeled" / "cccccccccccccccc.png").exists()


def test_rejects_an_unknown_label_and_moves_nothing(tmp_path: Path):
    cells = tree(tmp_path)
    with pytest.raises(ValueError):
        apply_relabels(cells, write(tmp_path, "aaaaaaaaaaaaaaaa,3\nbbbbbbbbbbbbbbbb,10\n"))
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()
    assert not (cells / "3" / "aaaaaaaaaaaaaaaa.png").exists()


def test_rejects_a_missing_file(tmp_path: Path):
    cells = tree(tmp_path)
    with pytest.raises(ValueError):
        apply_relabels(cells, write(tmp_path, "aaaaaaaaaaaaaaaa,3\ndddddddddddddddd,3\n"))
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()
    assert (cells / "4" / "bbbbbbbbbbbbbbbb.png").exists()


def test_rejects_two_labels_for_one_file(tmp_path: Path):
    cells = tree(tmp_path)
    with pytest.raises(ValueError, match="aaaaaaaaaaaaaaaa"):
        apply_relabels(cells, write(tmp_path, "aaaaaaaaaaaaaaaa,3\naaaaaaaaaaaaaaaa,4\n"))
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()


def test_rejects_a_file_in_two_folders(tmp_path: Path):
    cells = tree(tmp_path)
    (cells / "3").mkdir()
    (cells / "3" / "aaaaaaaaaaaaaaaa.png").write_bytes(b"y")
    with pytest.raises(ValueError, match="aaaaaaaaaaaaaaaa"):
        apply_relabels(cells, write(tmp_path, "bbbbbbbbbbbbbbbb,3\n"))
    assert (cells / "4" / "bbbbbbbbbbbbbbbb.png").exists()


def test_rejects_a_move_onto_an_existing_file(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    cells = tree(tmp_path)
    (cells / "3").mkdir()
    (cells / "3" / "aaaaaaaaaaaaaaaa.png").write_bytes(b"y")
    # Hide the target from the folder scan, so only the move check can catch it.
    real_glob = Path.glob
    monkeypatch.setattr(
        Path,
        "glob",
        lambda self, pattern: (p for p in real_glob(self, pattern) if p.parent.name != "3"),
    )
    with pytest.raises(ValueError, match="already exists"):
        apply_relabels(cells, write(tmp_path, "aaaaaaaaaaaaaaaa,3\n"))
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()
    assert (cells / "3" / "aaaaaaaaaaaaaaaa.png").read_bytes() == b"y"


def test_rejects_a_csv_without_the_required_header(tmp_path: Path):
    cells = tree(tmp_path)
    path = tmp_path / "relabels.csv"
    path.write_text("file,label\naaaaaaaaaaaaaaaa,3\n")
    with pytest.raises(ValueError, match="file,new_label"):
        apply_relabels(cells, path)
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()


def test_rejects_a_short_row(tmp_path: Path):
    cells = tree(tmp_path)
    with pytest.raises(ValueError, match="short row"):
        apply_relabels(cells, write(tmp_path, "aaaaaaaaaaaaaaaa\n"))
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()


def test_accepts_a_csv_with_an_excel_bom(tmp_path: Path):
    cells = tree(tmp_path)
    path = tmp_path / "relabels.csv"
    path.write_bytes("file,new_label\naaaaaaaaaaaaaaaa,3\n".encode("utf-8-sig"))
    assert apply_relabels(cells, path) == 1


def test_move_cells_moves_one_cell(tmp_path: Path):
    cells = tree(tmp_path)
    assert move_cells(cells, {"aaaaaaaaaaaaaaaa": "empty"}) == 1
    assert (cells / "empty" / "aaaaaaaaaaaaaaaa.png").exists()


def test_move_cells_checks_everything_before_it_moves(tmp_path: Path):
    cells = tree(tmp_path)
    with pytest.raises(ValueError, match="unknown label"):
        move_cells(cells, {"aaaaaaaaaaaaaaaa": "3", "bbbbbbbbbbbbbbbb": "10"})
    assert (cells / "6" / "aaaaaaaaaaaaaaaa.png").exists()
