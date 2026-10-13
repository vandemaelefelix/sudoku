import json
from pathlib import Path

import pytest
from PIL import Image
from test_label_store import Clock, add_cell, build, pattern

from sudoku_ml.journal import read_journal
from sudoku_ml.label_store import LabelStore


def with_prelabels(tmp_path: Path, entries: dict[int, tuple[str, float, str]]):
    """Four unlabelled cells. entries: cell index → (digit, p, kind)."""
    paths, ids = build(tmp_path, {"unlabeled": 4, "3": 1}, {})
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
    lines = read_journal(paths.journal)
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
    assert read_journal(paths.journal) == []


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


def with_kind_guesses(tmp_path: Path, guesses: dict[int, tuple[str, float] | None]):
    """Five cells in folder 4, none in a stored group. guesses: index → (kind, kp) or None."""
    paths, ids = build(tmp_path, {"4": 5, "unlabeled": 1}, {})
    paths.groups.unlink()
    cells = {
        ids["4"][i]: {"digit": "4", "p": 0.9, "kind": g[0], "kp": g[1]}
        for i, g in guesses.items()
        if g
    }
    paths.prelabels.write_text(json.dumps({"run": "test", "cells": cells}))
    return LabelStore(paths, Clock()), ids["4"], ids["unlabeled"][0]


GUESSES = {
    0: ("printed", 0.9),
    1: ("handwritten", 0.8),
    2: ("printed", 0.6),
    3: ("notes", 0.5),
    4: None,
}


def test_ungrouped_cells_split_by_the_predicted_kind_least_sure_first(tmp_path: Path):
    store, c, _ = with_kind_guesses(tmp_path, GUESSES)
    printed, handwritten, other, plain = (store.screen("4", g, 0) for g in range(4))
    assert store.screen("4", 0, 0)["groups"] == 4
    assert printed["predicted"] == "printed" and printed["ungrouped"] is True
    assert [x["id"] for x in printed["cells"]] == [c[2], c[0]]
    assert [x["kp"] for x in printed["cells"]] == [0.6, 0.9]
    assert [x["start"] for x in printed["cells"]] == ["printed", "printed"]
    assert [x["id"] for x in handwritten["cells"]] == [c[1]]
    assert handwritten["cells"][0]["start"] == "handwritten"
    assert other["predicted"] == "other" and [x["id"] for x in other["cells"]] == [c[3]]
    assert other["cells"][0]["start"] is None
    assert plain["predicted"] is None and [x["id"] for x in plain["cells"]] == [c[4]]
    assert plain["cells"][0]["start"] is None and "kp" not in plain["cells"][0]


def test_saving_a_guessed_screen_writes_the_predicted_kind_for_unclicked_cells(tmp_path: Path):
    store, c, _ = with_kind_guesses(tmp_path, GUESSES)
    screen = store.screen("4", 0, 0)
    entries = [{"id": x["id"], "kind": x["start"]} for x in screen["cells"]]
    entries[0]["kind"] = "handwritten"
    assert store.save(entries, "groups") == 2
    assert store.kinds()[c[2]] == "handwritten" and store.kinds()[c[0]] == "printed"
    assert store.next_screen(("4", 0, 0))["group"] == 1
    assert store.screen("4", 0, 0)["cells"][0]["start"] == "handwritten"


def test_next_screen_moves_through_the_guessed_groups_without_looping(tmp_path: Path):
    store, c, _ = with_kind_guesses(tmp_path, GUESSES)
    seen = []
    after = None
    for _ in range(4):
        screen = store.next_screen(after)
        seen.append(screen["group"])
        store.save([{"id": x["id"], "kind": "printed"} for x in screen["cells"]], "groups")
        after = ("4", screen["group"], screen["page"])
    assert seen == [0, 1, 2, 3] and store.next_screen(after) is None


def test_the_digit_screen_and_status_ignore_pre_labels_of_digit_folder_cells(tmp_path: Path):
    store, c, waiting = with_kind_guesses(tmp_path, GUESSES)
    assert store.digit_screen("4", "all")["counts"]["4"] == 0
    assert store.digit_screen("4", "all")["not_prelabelled"] == 1
    status = store.status()
    assert status["digits"] == 0 and status["not_prelabelled"] == 1
    assert status["kind_not_prelabelled"] == 1 and status["kind"] == 5
    store.save([{"id": c[4], "kind": "printed"}], "groups")
    assert store.status()["kind_not_prelabelled"] == 0


def test_a_guessed_cell_keeps_the_model_kind_apart_from_the_logged_kind(tmp_path: Path):
    store, c, _ = with_kind_guesses(tmp_path, GUESSES)
    store.save([{"id": c[2], "kind": "handwritten"}], "groups")
    printed = store.screen("4", 0, 0)["cells"]
    assert [(x["model_kind"], x["start"]) for x in printed] == [("printed", "printed")]
    assert store.kinds()[c[2]] == "handwritten"
    assert store.screen("4", 2, 0)["cells"][0]["model_kind"] == "notes"


def test_the_review_screen_tells_a_missing_suspects_file_from_nothing_flagged(tmp_path: Path):
    store, _, _ = with_kind_guesses(tmp_path, GUESSES)
    assert store.review_screen()["suspects"] is False
    store.paths.suspects.parent.mkdir(parents=True, exist_ok=True)
    store.paths.suspects.write_text("file,field,label,predicted,p_label,p_predicted\n")
    assert store.review_screen()["suspects"] is True
