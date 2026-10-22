"""Imported sudoku photos in Flow A: the same outline check and scan view as uploaded scans."""

import json
from pathlib import Path

import pytest
from photos import grid_photo, save_photo
from test_label_store import Clock, build, save_kinds

from sudoku_ml.label_store import LabelStore
from sudoku_ml.photo_import import import_folder
from sudoku_ml.tables import read_photos

FULL = [[200, 100], [740, 100], [740, 640], [200, 640]]


def imported(tmp_path: Path, photos: int = 1) -> tuple[LabelStore, list[str]]:
    """One loose cell, and `photos` imported photos that wait for their outline."""
    paths, _ = build(tmp_path, {"unlabeled": 1}, {})
    for n in range(photos):
        save_photo(grid_photo(seed=n), tmp_path / "in" / f"p{n}.png")
    import_folder(tmp_path / "in", paths, source="phone", licence="own")
    store = LabelStore(paths, Clock())
    return store, store.check.pending()


def test_a_pending_photo_shows_in_the_gallery_with_its_detected_outline(tmp_path: Path):
    store, [photo] = imported(tmp_path)
    [tile] = store.outline_screen()["scans"]
    assert (tile["photo"], tile["source"]) == (photo, "photo")
    assert len(tile["corners"]) == 4 and tile["fit"] > 0
    assert store.status()["outlines"] == 1


def test_an_approved_photo_cuts_its_cells_into_flow_a_not_flow_b(tmp_path: Path):
    store, [photo] = imported(tmp_path)
    loose = store.loose_cells()
    assert store.approve_outlines([photo]) == 1
    assert read_photos(store.paths.photos_csv)[0].status == "accepted"
    assert store.loose_cells() == loose
    [waiting] = store.scan_list()["scans"]
    assert (waiting["photo"], waiting["source"]) == (photo, "photo")
    screen = store.scan_screen(photo)
    own = [c for c in screen["cells"] if "id" in c and not c["shared"]]
    assert own and all(c["suggested"] and c["digit"] is None for c in own)
    assert waiting["open"] == len(own)


def test_a_cell_of_a_photo_starts_with_the_pre_label(tmp_path: Path):
    store, [photo] = imported(tmp_path)
    store.fix_outline(photo, FULL)
    cells = [c for c in store.scan_screen(photo)["cells"] if "id" in c]
    guesses = {
        cells[0]["id"]: {"digit": "4", "p": 0.9, "kind": "handwritten", "kp": 0.8},
        cells[1]["id"]: {"digit": "empty", "p": 0.9, "kind": "none", "kp": 0.8},
        cells[2]["id"]: {"digit": "5", "p": 0.9, "kind": "notes", "kp": 0.8},
    }
    store.paths.prelabels.write_text(json.dumps({"run": "r", "cells": guesses}))
    first, second, third = store.scan_screen(photo)["cells"][:3]
    assert (first["digit"], first["kind"]) == ("4", "handwritten")
    assert (second["digit"], second["kind"]) == ("empty", None)
    assert (third["digit"], third["kind"]) == ("5", None)


def test_a_photo_without_a_detected_outline_cannot_be_approved_blind(tmp_path: Path):
    store, [photo] = imported(tmp_path)
    row = read_photos(store.paths.photos_csv)[0]
    store.paths.detections.write_text(
        json.dumps(
            {
                row.photo_id: {
                    "corners": None,
                    "lines": 0,
                    "reason": "none",
                    "width": 1000,
                    "height": 800,
                }
            }
        )
    )
    assert store.outline_screen()["scans"][0]["corners"] is None
    with pytest.raises(ValueError, match="no outline found"):
        store.approve_outlines([photo])
    assert store.fix_outline(photo, FULL)["cells"] > 0


def test_a_rejected_photo_leaves_the_gallery_without_cells(tmp_path: Path):
    store, [photo] = imported(tmp_path)
    store.reject_outline(photo)
    assert store.outline_screen()["open"] == 0 and store.scan_list()["scans"] == []
    assert read_photos(store.paths.photos_csv)[0].status == "rejected"


def test_a_legacy_photo_is_never_offered(tmp_path: Path):
    store, _ = imported(tmp_path)
    text = store.paths.photos_csv.read_text().replace(",pending,", ",legacy,")
    store.paths.photos_csv.write_text(text)
    assert LabelStore(store.paths, Clock()).outline_screen()["open"] == 0


def test_the_doubtful_save_settles_a_page_as_one_action(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    store = LabelStore(paths, Clock())
    a, b = ids["7"]
    entries = [{"id": a, "digit": "1", "kind": "printed"}, {"id": b, "digit": "discarded"}]
    assert store.review_save(entries) == 3
    assert (store.folder[a], store.folder[b]) == ("1", "discarded")
    assert store.kinds()[a] == "printed"
    store.undo()
    assert (store.folder[a], store.folder[b]) == ("7", "7")
    with pytest.raises(ValueError, match="needs a kind"):
        store.review_save([{"id": a, "digit": "1"}])


def test_a_batch_with_a_photo_whose_corners_give_no_grid_writes_nothing(tmp_path: Path):
    store, [photo] = imported(tmp_path)
    row = read_photos(store.paths.photos_csv)[0]
    line = [[200, 100], [400, 100], [600, 100], [740, 100]]
    store.paths.detections.write_text(
        json.dumps(
            {
                row.photo_id: {
                    "corners": line,
                    "lines": 0,
                    "reason": "x",
                    "width": 1000,
                    "height": 800,
                }
            }
        )
    )
    with pytest.raises(ValueError, match="set its corners"):
        store.approve_outlines([photo])
    assert read_photos(store.paths.photos_csv)[0].status == "pending"
    assert not store.paths.journal.exists() or store.paths.journal.read_text() == ""


def test_undo_names_the_step_of_the_action_it_reverses(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    store = LabelStore(paths, Clock())
    assert store.undo_target() is None
    save_kinds(store, [{"id": ids["7"][0], "kind": "printed"}])
    assert store.undo_target() == "groups"
    store.undo()
    assert store.undo_target() is None
