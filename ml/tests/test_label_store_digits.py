import json
from dataclasses import replace
from pathlib import Path

import pytest
from PIL import Image
from test_label_store import Clock, add_cell, build, pattern

from sudoku_ml.kind_log import read_log
from sudoku_ml.label_store import LabelStore


def with_prelabels(tmp_path: Path, entries: dict[int, tuple[str, float, str]]):
    """Four unlabelled cells. entries: cell index → (digit, p, kind)."""
    paths, ids = build(tmp_path, {"unlabeled": 4, "3": 1}, {})
    paths = replace(paths, prelabels=tmp_path / "data" / "prelabels.json")
    cells = {
        ids["unlabeled"][i]: {"digit": d, "p": p, "kind": k} for i, (d, p, k) in entries.items()
    }
    paths.prelabels.write_text(json.dumps({"run": "test", "cells": cells}))
    return LabelStore(paths, Clock()), paths, ids["unlabeled"], ids["3"][0]


ENTRIES = {
    0: ("2", 0.9, "handwritten"),
    1: ("2", 0.5, "handwritten"),
    2: ("2", 0.7, "printed"),
    3: ("9", 0.8, "handwritten"),
}


def test_a_digit_screen_shows_handwritten_cells_least_sure_first(tmp_path: Path):
    store, _, u, _ = with_prelabels(tmp_path, ENTRIES)
    screen = store.digit_screen("2")
    assert [c["id"] for c in screen["cells"]] == [u[1], u[0]]
    assert screen["left"] == 2 and screen["counts"]["2"] == 2 and screen["counts"]["9"] == 1
    assert screen["cells"][0] == {"id": u[1], "stem": u[1][:16], "p": 0.5}


def test_all_kinds_also_shows_the_printed_cells(tmp_path: Path):
    store, _, u, _ = with_prelabels(tmp_path, ENTRIES)
    assert [c["id"] for c in store.digit_screen("2", "all")["cells"]] == [u[1], u[2], u[0]]


def test_a_cell_without_a_prelabel_is_counted_not_shown(tmp_path: Path):
    store, _, _, _ = with_prelabels(tmp_path, {0: ("2", 0.9, "handwritten")})
    screen = store.digit_screen("2")
    assert len(screen["cells"]) == 1 and screen["not_prelabelled"] == 3


def test_assign_moves_the_cells_and_logs_digit_lines(tmp_path: Path):
    store, paths, u, _ = with_prelabels(tmp_path, ENTRIES)
    entries = [
        {"id": u[0], "digit": "2"},
        {"id": u[1], "digit": "9"},
        {"id": u[3], "digit": "discarded"},
    ]
    assert store.assign(entries, "digits") == 3
    assert (paths.cells / "2" / f"{u[0][:16]}.png").exists()
    assert (paths.cells / "9" / f"{u[1][:16]}.png").exists()
    assert (paths.cells / "discarded" / f"{u[3][:16]}.png").exists()
    lines = read_log(paths.log)
    assert {(x.old, x.new, x.screen, x.field) for x in lines} == {
        ("unlabeled", "2", "digits", "digit"),
        ("unlabeled", "9", "digits", "digit"),
        ("unlabeled", "discarded", "digits", "digit"),
    }
    assert len({x.action for x in lines}) == 1
    assert store.digit_screen("2")["left"] == 0


def test_undo_puts_a_digit_screen_back(tmp_path: Path):
    store, paths, u, _ = with_prelabels(tmp_path, ENTRIES)
    store.assign([{"id": u[0], "digit": "2"}, {"id": u[1], "digit": "2"}], "digits")
    assert store.undo() == 2
    assert {p.stem for p in (paths.cells / "unlabeled").glob("*.png")} == {c[:16] for c in u}
    assert [c["id"] for c in store.digit_screen("2")["cells"]] == [u[1], u[0]]


@pytest.mark.parametrize("label", ["notes", "unlabeled", ""])
def test_an_unknown_label_moves_nothing(tmp_path: Path, label: str):
    store, paths, u, _ = with_prelabels(tmp_path, ENTRIES)
    with pytest.raises(ValueError):
        store.assign([{"id": u[0], "digit": "2"}, {"id": u[1], "digit": label}], "digits")
    assert len(list((paths.cells / "unlabeled").glob("*.png"))) == 4
    assert read_log(paths.log) == []


def test_a_cell_outside_unlabeled_cannot_be_assigned(tmp_path: Path):
    store, _, _, labelled = with_prelabels(tmp_path, ENTRIES)
    with pytest.raises(ValueError, match="not in unlabeled"):
        store.assign([{"id": labelled, "digit": "5"}], "digits")


def test_a_registered_cell_is_served_without_a_manifest_rewrite(tmp_path: Path):
    store, paths, _, _ = with_prelabels(tmp_path, ENTRIES)
    new_id = add_cell(paths.cells, "unlabeled", pattern(99))
    store.register([new_id])
    assert store.cell_file(new_id[:16]).exists()
    assert Image.open(store.cell_file(new_id[:16])).size == (64, 64)
