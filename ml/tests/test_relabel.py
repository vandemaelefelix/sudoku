from pathlib import Path

import pytest

from sudoku_ml.relabel import apply_relabels


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


def test_rejects_a_missing_file(tmp_path: Path):
    with pytest.raises(ValueError):
        apply_relabels(tree(tmp_path), write(tmp_path, "dddddddddddddddd,3\n"))
