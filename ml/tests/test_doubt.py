import json
from pathlib import Path

import numpy as np
import pytest
from test_label_store_scans import CORNERS, pulled
from test_prelabel import make_run

from sudoku_ml.contract import DIGIT_CLASSES, KIND_CLASSES
from sudoku_ml.dataset import load_cells
from sudoku_ml.doubt import (
    clashes,
    count_solutions,
    main,
    model_signals,
    read_doubt,
    scan_signals,
    score,
    score_cells,
    write_doubt,
)
from sudoku_ml.finish import finish
from sudoku_ml.journal import read_journal
from sudoku_ml.tables import read_cells

# A classic puzzle with one solution.
UNIQUE = "530070000600195000098000060800060003400803001700020006060000280000419005000080079"


def grid(text: str) -> list[int]:
    return [int(c) for c in text]


def places(text: str, kind: str = "printed") -> list[dict]:
    return [
        {"id": f"c{i}", "digit": "empty" if c == "0" else c, "kind": None if c == "0" else kind}
        for i, c in enumerate(text)
    ]


def test_the_solution_counter():
    assert count_solutions(grid(UNIQUE)) == 1
    assert count_solutions([0] * 81) == 2
    assert count_solutions(grid("55" + "0" * 79)) == 0


def test_a_digit_twice_in_a_row_column_or_box_is_a_clash():
    assert clashes(grid("1" + "0" * 7 + "1" + "0" * 72)) == {0, 8}
    assert clashes(grid("1" + "0" * 8 + "1" + "0" * 71)) == {0, 9}
    assert clashes(grid("1" + "0" * 9 + "1" + "0" * 70)) == {0, 10}
    assert clashes(grid(UNIQUE)) == set()


def test_a_unique_scan_gives_no_sudoku_signal():
    assert scan_signals(places(UNIQUE)) == {}


def test_a_missed_given_flags_the_empty_places():
    missed = "000070000" + UNIQUE[9:]  # the 5 and the 3 of the first row were read as empty
    found = scan_signals(places(missed))
    assert found and all(missed[p] == "0" for p in found)
    assert {r["signal"] for rs in found.values() for r in rs} == {"not-unique"}


def test_a_clash_flags_its_cells_and_the_digit_cells_of_the_scan():
    clash = "5" + "5" + UNIQUE[2:]
    found = scan_signals(places(clash))
    assert {r["signal"] for r in found[0]} == {"rule-break", "no-solution"}
    assert all(clash[p] != "0" for p in found)


def test_handwritten_digits_are_not_givens():
    found = scan_signals(places(UNIQUE, kind="handwritten"))
    assert {r["signal"] for rs in found.values() for r in rs} == {"not-unique"}


def probs(digit: str, p: float, kind: str = "printed") -> tuple[np.ndarray, np.ndarray]:
    digit_p = np.full(len(DIGIT_CLASSES), (1 - p) / 9)
    digit_p[DIGIT_CLASSES.index(digit)] = p
    kind_p = np.full(len(KIND_CLASSES), 0.01)
    kind_p[KIND_CLASSES.index(kind)] = 0.97
    return digit_p, kind_p


def test_the_model_signals():
    assert model_signals("3", "printed", *probs("3", 0.99)) == []
    found = model_signals("3", "printed", *probs("8", 0.8, "handwritten"))
    assert [r["signal"] for r in found] == ["model-digit", "low-confidence", "model-kind"]
    assert found[0]["predicted"] == "8" and found[1]["p"] < 0.1


def test_the_score_adds_the_weights():
    assert score([{"signal": "edited"}, {"signal": "low-confidence", "p": 0.25}]) == 1.75
    assert score([]) == 0.0


def approved(tmp_path: Path, corners=(CORNERS,)):
    store, paths, photos = pulled(tmp_path, corners=corners)
    store.approve_outlines(photos)
    return store, paths, photos


def test_only_cells_of_approved_scans_are_open(tmp_path: Path):
    store, _, photos = pulled(tmp_path, corners=(CORNERS,))
    assert store.open_app_cells() == []
    store.approve_outlines(photos)
    assert len(store.open_app_cells()) == 81


def test_score_cells_records_each_signal(tmp_path: Path):
    store, _, photos = approved(tmp_path)
    cells = store.scan_screen(photos[0])["cells"]
    edited, plain = cells[2]["id"], cells[0]["id"]

    def predict(paths):
        rows = [probs(store.folder[p_id], 0.99) for p_id in ids]
        digit_p = np.stack([r[0] for r in rows])
        kind_p = np.stack([r[1] for r in rows])
        digit_p[ids.index(plain)] = probs("9", 0.95)[0]
        return digit_p, kind_p

    ids = store.open_app_cells()
    value = score_cells(store, predict, "run-x")
    assert value["run"] == "run-x" and set(value["cells"]) == set(ids)
    assert "edited" in {r["signal"] for r in value["cells"][edited]["reasons"]}
    plain_signals = {r["signal"] for r in value["cells"][plain]["reasons"]}
    assert {"model-digit", "low-confidence"} <= plain_signals
    scan_reasons = [r for c in value["cells"].values() for r in c["reasons"] if "scan" in r]
    assert scan_reasons and all(r["scan"] == photos[0] for r in scan_reasons)


def test_the_review_shows_the_highest_doubt_first_and_unscored_cells_last(tmp_path: Path):
    store, paths, _ = approved(tmp_path)
    ones = [c for c in store.open_app_cells() if store.folder[c] == "1"]
    doubt = {c: {"score": float(n), "reasons": []} for n, c in enumerate(ones[1:])}
    paths.doubt.write_text(json.dumps({"run": None, "cells": doubt}))
    screen = store.cell_review("1")
    order = [c["id"] for c in screen["cells"]]
    assert order == [*reversed(ones[1:]), ones[0]]
    assert screen["open"] == len(ones) and screen["unscored"] == 81 - len(ones) + 1
    assert screen["counts"]["1"] == {"open": len(ones), "verified": 0}


def test_verify_is_one_action_with_fixes_and_finish_makes_the_cells_train(tmp_path: Path):
    store, paths, _ = approved(tmp_path)
    page = store.cell_review("1")["cells"]
    fixes = {page[0]["id"]: ("7", "handwritten"), page[1]["id"]: ("discarded", None)}
    sent = [
        {
            "id": c["id"],
            "digit": fixes.get(c["id"], ("1", c["kind"]))[0],
            "kind": fixes.get(c["id"], ("1", c["kind"]))[1],
        }
        for c in page
    ]
    assert store.verify_cells(sent) >= len(page)
    assert len({x.action for x in read_journal(paths.journal)}) == 2
    assert store.folder[page[0]["id"]] == "7" and store.kinds()[page[0]["id"]] == "handwritten"
    assert store.folder[page[1]["id"]] == "discarded"
    assert store.cell_review("1")["open"] == 0
    assert store.cell_review("1")["counts"]["1"]["verified"] == len(page) - 2
    finish(store)
    rows = read_cells(paths.cells_csv)
    assert {rows[c["id"]].label_source for c in page} == {"verified"}
    assert len(load_cells(paths)) == len(page) - 1


def test_verify_refuses_a_cell_that_is_not_open(tmp_path: Path):
    store, paths, photos = pulled(tmp_path, corners=(CORNERS,))
    cell = store.scan_screen(photos[0])["cells"][0]
    with pytest.raises(ValueError, match="not an open app cell"):
        store.verify_cells([{"id": cell["id"], "digit": "1", "kind": "printed"}])
    assert not paths.journal.exists()


def test_a_pixel_identical_cell_is_open_once_and_its_verdict_counts_for_both_scans(tmp_path):
    store, _, photos = approved(tmp_path, corners=(CORNERS, CORNERS))
    shared = [c["id"] for c in store.scan_screen(photos[1])["cells"] if c["shared"]]
    open_cells = store.open_app_cells()
    assert len(open_cells) == len(set(open_cells)) < 162
    entry = [
        {"id": shared[0], "digit": store.folder[shared[0]], "kind": store.kinds().get(shared[0])}
    ]
    store.verify_cells(entry)
    for photo in photos:
        [cell] = [c for c in store.scan_screen(photo)["cells"] if c["id"] == shared[0]]
        assert cell["reviewed"]


def test_write_doubt_without_a_model_keeps_the_other_signals(tmp_path: Path):
    store, paths, _ = approved(tmp_path)
    assert write_doubt(store, None) == 81
    value = read_doubt(paths.doubt)
    assert value["run"] is None
    signals = {r["signal"] for c in value["cells"].values() for r in c["reasons"]}
    assert "edited" in signals and not signals & {"model-digit", "low-confidence", "model-kind"}


def test_write_doubt_with_a_model_run(tmp_path: Path):
    store, paths, _ = approved(tmp_path)
    run = make_run(tmp_path)
    assert write_doubt(store, run) == 81
    assert read_doubt(paths.doubt)["run"] == run.name


def test_main_scores_without_a_model(tmp_path: Path, capsys):
    _, paths, _ = approved(tmp_path)
    assert main(["doubt"], paths, ml_root=tmp_path) == 0
    assert "Scored 81 open app cells (no model)." in capsys.readouterr().out
