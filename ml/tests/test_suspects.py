import csv
from pathlib import Path

import numpy as np
from PIL import Image

from sudoku_ml.contract import UNKNOWN_KIND, kind_index
from sudoku_ml.data_paths import DataPaths
from sudoku_ml.suspects import (
    FIELDS,
    find_suspects,
    rank_kind_suspects,
    rank_suspects,
    write_suspects,
)
from sudoku_ml.tables import CellRow, PhotoRow, write_cells, write_photos

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


def test_a_cell_that_may_not_train_is_left_out_and_the_rest_keep_their_files(tmp_path: Path):
    data = DataPaths.under(tmp_path / "data", tmp_path)
    scan = "a" * 64
    rows = []
    for n, folder in enumerate(["empty", "1", "2", "3", "4", "5", "6", "7"]):
        stem = f"{n + 1:016x}"
        (data.cells / folder).mkdir(parents=True)
        rng = np.random.default_rng(n)
        pixels = np.kron(rng.integers(0, 256, (8, 8, 3)), np.ones((8, 8, 1))).astype(np.uint8)
        Image.fromarray(pixels).save(data.cells / folder / f"{stem}.png")
        kind = None if folder == "empty" else "printed"
        # Only the untrusted cell comes from the scan. Cells of one scan form one group.
        if folder == "4":
            rows.append(CellRow(stem + "0" * 48, folder, kind, (scan, 0, n), "app-unedited"))
        else:
            rows.append(CellRow(stem + "0" * 48, folder, kind, None))
    write_cells(data.cells_csv, rows)
    corners = "1 2 3 4 5 6 7 8"
    write_photos(
        data.photos_csv,
        [PhotoRow(scan, "a.jpg", "app-scan", "player-contributed", "", "accepted", corners)],
    )

    with find_suspects(data, folds=2, epochs=1).open() as file:
        suspects = list(csv.DictReader(file))

    folder_of = {r.cell_id[:16]: r.digit for r in rows}
    assert f"{5:016x}" not in {s["file"] for s in suspects}
    digit_rows = [s for s in suspects if s["field"] == "digit"]
    assert digit_rows
    assert all(folder_of[s["file"]] == s["label"] for s in digit_rows)
