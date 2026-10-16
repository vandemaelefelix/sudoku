from pathlib import Path

import numpy as np

from sudoku_ml.contract import UNKNOWN_KIND, kind_index
from sudoku_ml.suspects import FIELDS, rank_kind_suspects, rank_suspects, write_suspects

P, H = kind_index("printed"), kind_index("handwritten")


def test_lowest_probability_for_the_label_comes_first():
    probs = np.array([[0.1, 0.9], [0.95, 0.05], [0.5, 0.5]])
    rows = rank_suspects(["a", "b", "c"], [1, 1, 0], probs, top=2)
    assert [r["file"] for r in rows] == ["b", "c"]
    assert rows[0]["field"] == "digit"
    assert rows[0]["predicted"] == "empty" and rows[0]["label"] == "1"
    assert rows[0]["p_label"] == 0.05


def test_top_limits_the_rows():
    probs = np.full((10, 10), 0.1)
    assert len(rank_suspects([str(i) for i in range(10)], [0] * 10, probs, top=3)) == 3


def test_kind_suspects_are_labelled_cells_below_the_threshold():
    probs = np.array(
        [[0, 0.95, 0.05, 0], [0, 0.02, 0.98, 0], [0.9, 0.05, 0.05, 0], [0, 0.5, 0.5, 0]]
    )
    rows = rank_kind_suspects(["a", "b", "c", "d"], [P, P, UNKNOWN_KIND, H], probs, threshold=0.10)
    assert rows == [
        {
            "field": "kind",
            "file": "b",
            "label": "printed",
            "predicted": "handwritten",
            "p_label": 0.02,
            "p_predicted": 0.98,
        }
    ]


def test_the_none_kind_of_empty_cells_is_never_a_suspect():
    probs = np.array([[0.01, 0.99, 0, 0]])
    assert rank_kind_suspects(["a"], [kind_index("none")], probs) == []


def test_write_suspects_writes_the_header_without_rows(tmp_path: Path):
    path = tmp_path / "suspects.csv"
    write_suspects([], path)
    assert path.read_text().splitlines() == [",".join(FIELDS)]
