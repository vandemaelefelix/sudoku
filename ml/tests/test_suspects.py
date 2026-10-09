from pathlib import Path

import numpy as np
import pytest

from sudoku_ml.relabel import apply_relabels
from sudoku_ml.suspects import rank_suspects, write_relabels


def test_lowest_probability_for_the_label_comes_first():
    probs = np.array([[0.1, 0.9], [0.95, 0.05], [0.5, 0.5]])
    rows = rank_suspects(["a", "b", "c"], [1, 1, 0], probs, top=2)
    assert [r["file"] for r in rows] == ["b", "c"]
    assert rows[0]["predicted"] == "empty" and rows[0]["label"] == "1"
    assert rows[0]["p_label"] == 0.05


def test_top_limits_the_rows():
    probs = np.full((10, 10), 0.1)
    assert len(rank_suspects([str(i) for i in range(10)], [0] * 10, probs, top=3)) == 3


def test_relabels_csv_has_the_review_columns(tmp_path: Path):
    rows = rank_suspects(["a", "b"], [1, 0], np.array([[0.1, 0.9], [0.2, 0.8]]), top=2)
    path = tmp_path / "relabels.csv"
    write_relabels(rows, path)
    lines = path.read_text().splitlines()
    assert lines[0] == "file,label,predicted,new_label"
    assert all(line.endswith(",") for line in lines[1:])


def test_write_refuses_to_overwrite_reviewed_labels(tmp_path: Path):
    path = tmp_path / "relabels.csv"
    path.write_text("file,label,predicted,new_label\na,1,empty,3\n")
    with pytest.raises(ValueError, match="Move the file first"):
        write_relabels([{"file": "a", "label": "1", "predicted": "2"}], path)
    assert path.read_text().endswith("a,1,empty,3\n")


def test_write_overwrites_an_untouched_file(tmp_path: Path):
    path = tmp_path / "relabels.csv"
    path.write_text("file,label,predicted,new_label\na,1,empty,\n")
    write_relabels([{"file": "b", "label": "1", "predicted": "2"}], path)
    assert "b,1,2," in path.read_text()


def test_apply_relabels_accepts_the_new_columns(tmp_path: Path):
    cells = tmp_path / "cells"
    (cells / "6").mkdir(parents=True)
    (cells / "6" / "aaaaaaaaaaaaaaaa.png").write_bytes(b"x")
    path = tmp_path / "relabels.csv"
    write_relabels([{"file": "aaaaaaaaaaaaaaaa", "label": "6", "predicted": "5"}], path)
    assert apply_relabels(cells, path) == 0
