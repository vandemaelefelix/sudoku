import json
from pathlib import Path

from sudoku_ml.journal import Field, Line, Screen
from sudoku_ml.open_cells import (
    OpenWork,
    Prelabels,
    awaiting_kind,
    label_of,
    loose_cells,
    open_cells_of,
    open_digit_cells,
    open_kind_cells,
    suggestion,
    unconfirmed,
)
from sudoku_ml.scan_book import ScanState
from sudoku_ml.tables import PhotoRow

PHOTO = "f" * 64
LOOSE, FRESH, APP, DONE, SEVEN = ("1", "2", "3", "4", "5")
ID = {name: name * 64 for name in (LOOSE, FRESH, APP, DONE, SEVEN)}


def row(photo_id: str = PHOTO) -> PhotoRow:
    return PhotoRow(photo_id, "p.jpg", "app-scan", "own", "", "accepted", "0 0 1 0 1 1 0 1")


def line(cell: str, field: Field, screen: Screen, action: str = "a1") -> Line:
    return Line("2026-10-12T09:00:00Z", "s", action, cell, field, None, "x", screen)


def work(**changes) -> OpenWork:
    """Five cells. LOOSE and FRESH wait in unlabeled/. APP is an unedited cell of the app in
    folder 3. DONE sits in folder 4 and was confirmed. SEVEN belongs to no scan."""
    base = {
        "states": [ScanState(row(), "accepted", "0 0 1 0 1 1 0 1")],
        "model": "run",
        "pre": {ID[FRESH]: {"digit": "5", "kind": "printed", "probs": {"digit": [], "kind": []}}},
        "kinds": {ID[DONE]: "printed"},
        "label_sources": {ID[APP]: "app-unedited", ID[DONE]: "app-edited"},
        "sources": {ID[FRESH]: (PHOTO, 0, 1), ID[APP]: (PHOTO, 0, 2), ID[DONE]: (PHOTO, 1, 0)},
        "scans": {PHOTO: "app"},
        "folder": {
            ID[LOOSE]: "unlabeled",
            ID[FRESH]: "unlabeled",
            ID[APP]: "3",
            ID[DONE]: "4",
            ID[SEVEN]: "7",
        },
        "lines": [line(ID[DONE], Field.DIGIT, Screen.DIGITS)],
    }
    return OpenWork(**{**base, **changes})


def test_a_guess_of_empty_has_no_kind_and_an_unknown_kind_is_dropped():
    pre = {"a": {"digit": "empty", "kind": "printed"}, "b": {"digit": "7", "kind": "notes"}}
    assert suggestion("a", pre) == ("empty", None)
    assert suggestion("b", pre) == ("7", None)
    assert suggestion("c", pre) == (None, None)


def test_a_cell_in_unlabeled_starts_with_the_guess_and_any_other_with_its_label():
    w = work()
    assert label_of(ID[FRESH], w) == ("5", "printed")
    assert label_of(ID[LOOSE], w) == (None, None)
    assert label_of(ID[DONE], w) == ("4", "printed")


def test_a_cell_in_unlabeled_without_an_accepted_scan_is_loose():
    assert loose_cells(work()) == [ID[LOOSE]]
    assert loose_cells(work(states=[])) == [ID[LOOSE], ID[FRESH]]


def test_an_app_cell_that_no_person_labelled_waits_with_the_cells_of_unlabeled():
    assert unconfirmed(work()) == {PHOTO: [ID[FRESH], ID[APP]]}
    confirmed = [line(ID[APP], Field.DIGIT, Screen.DIGITS, "a2")]
    assert unconfirmed(work(lines=[*work().lines, *confirmed])) == {PHOTO: [ID[FRESH]]}


def test_the_open_digit_cells_carry_the_scan_place_and_the_loose_marker():
    items = {c["id"]: c for c in open_digit_cells(work())}
    assert set(items) == {ID[FRESH], ID[APP], ID[LOOSE]}
    assert (items[ID[FRESH]]["source"], items[ID[FRESH]]["row"], items[ID[FRESH]]["col"]) == (
        "app",
        0,
        1,
    )
    assert (items[ID[LOOSE]]["source"], items[ID[LOOSE]]["photo"]) == ("loose", None)
    assert items[ID[APP]]["edited"] is False and items[ID[APP]]["probs"] is None


def test_a_kind_cell_waits_after_its_digit_was_confirmed_and_not_before():
    digits, kinds = open_cells_of(work())
    assert {c["id"] for c in kinds} == {ID[DONE], ID[SEVEN]} - {c["id"] for c in digits}
    done = next(c for c in kinds if c["id"] == ID[DONE])
    assert (done["digit"], done["kind"], done["edited"]) == ("4", "printed", True)
    kind_line = line(ID[DONE], Field.KIND, Screen.KINDS, "a2")
    later = work(lines=[*work().lines, kind_line])
    assert ID[DONE] not in {c["id"] for c in open_kind_cells(later, set())}


def test_a_cell_without_a_kind_starts_with_the_kind_of_the_model():
    pre = {ID[SEVEN]: {"digit": "7", "kind": "handwritten", "probs": None}}
    (cell,) = [c for c in open_kind_cells(work(pre=pre), set()) if c["id"] == ID[SEVEN]]
    assert cell["kind"] == "handwritten"


def test_an_undone_digit_confirmation_does_not_wait_for_a_kind():
    confirm = line("c", Field.DIGIT, Screen.DIGITS, "a1")
    undo = line("c", Field.DIGIT, Screen.UNDO, "undo:a1")
    assert awaiting_kind([confirm]) == {"c"}
    assert awaiting_kind([confirm, undo]) == set()
    assert awaiting_kind([confirm, line("c", Field.KIND, Screen.KINDS, "a2")]) == set()
    assert awaiting_kind([line("c", Field.DIGIT, Screen.OUTLINES)]) == set()


def test_the_prelabels_are_read_once_per_change_of_the_file(tmp_path: Path):
    path = tmp_path / "prelabels.json"
    prelabels = Prelabels(path)
    assert prelabels.read() == (None, {})
    path.write_text(json.dumps({"run": "r1", "cells": {"a": {}}}))
    assert prelabels.read() == ("r1", {"a": {}})
    path.write_text(json.dumps({"run": "r2", "cells": {"a": {}, "b": {}}}))
    assert prelabels.read() == ("r2", {"a": {}, "b": {}})


def test_a_broken_prelabels_file_reads_as_empty_and_warns(tmp_path: Path, capsys):
    path = tmp_path / "prelabels.json"
    path.write_text("{broken")
    assert Prelabels(path).read() == (None, {})
    assert "prelabels.json cannot be read" in capsys.readouterr().err
    path.write_text(json.dumps({"run": "r"}))
    assert Prelabels(path).read() == (None, {})
    assert "prelabels.json cannot be read" in capsys.readouterr().err
