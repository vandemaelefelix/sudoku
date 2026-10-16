"""A stop can tear a file. A torn derived file counts as missing. A torn cells.csv stops the
tool: it holds the finished kinds and sources, so git must restore it (ADR-018)."""

import json
from pathlib import Path

import pytest
from test_label_store import Clock, build

from sudoku_ml.dataset import read_ids
from sudoku_ml.label_store import LabelStore
from sudoku_ml.manifest import write_cells_manifest
from sudoku_ml.photo_import import read_detections


def test_the_manifest_is_written_through_a_part_file(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    write_cells_manifest(paths)
    assert not list(paths.cells_csv.parent.glob("*.part"))
    assert len(read_ids(paths.cells_csv)) == 1


@pytest.mark.parametrize("bad", ["a" * 30, "g" * 64, "", "A" * 64])
def test_read_ids_refuses_an_id_that_is_not_64_hex(tmp_path: Path, bad: str):
    manifest = tmp_path / "cells.csv"
    manifest.write_text(
        f"cell_id,digit,kind,photo_id,row,col,label_source\n{'a' * 64},7,,,,,\n{bad},7,,,,,\n"
    )
    with pytest.raises(ValueError, match=r"cells.csv line 3"):
        read_ids(manifest)


def test_a_cut_off_manifest_stops_the_store_and_the_rewrite(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 2}, {"7": [[0, 1]]})
    cell = ids["7"][1]
    rows = paths.cells_csv.read_text().splitlines()
    torn = "\n".join(rows[:-1]) + f"\n{cell[:30]},7,"
    paths.cells_csv.write_text(torn)
    with pytest.raises(ValueError, match="Restore it from git."):
        LabelStore(paths, Clock())
    with pytest.raises(ValueError, match="Restore it from git."):
        write_cells_manifest(paths)
    assert paths.cells_csv.read_text() == torn


def test_a_missing_manifest_is_treated_like_a_cut_off_one(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    paths.cells_csv.unlink()
    assert LabelStore(paths, Clock()).folder == {ids["7"][0]: "7"}


def test_a_torn_prelabels_file_counts_as_missing(tmp_path: Path):
    paths, _ = build(tmp_path, {"unlabeled": 1}, {})
    paths.prelabels.write_text('{"run": "r", "cel')
    store = LabelStore(paths, Clock())
    assert store.digit_screen("1")["cells"] == []
    assert store.status()["not_prelabelled"] == 1


def test_a_torn_prelabels_file_is_recomputed_by_write_prelabels(tmp_path: Path, monkeypatch):
    from sudoku_ml import prelabel

    paths, ids = build(tmp_path, {"unlabeled": 1}, {})
    out = paths.work / "prelabels.json"
    out.write_text("{")
    entry = {"digit": "1", "p": 0.9, "kind": "printed", "kp": 0.9}
    monkeypatch.setattr(prelabel, "_predict", lambda run, files: [entry for _ in files])
    run = tmp_path / "run-1"
    assert prelabel.write_prelabels(paths.cells, run, out) == 1
    assert json.loads(out.read_text())["cells"] == {ids["unlabeled"][0]: entry}
    assert not list(paths.work.glob("*.part"))


def test_a_torn_groups_file_counts_as_missing(tmp_path: Path):
    paths, _ = build(tmp_path, {"7": 1}, {"7": [[0]]})
    paths.groups.write_text('{"folders": {"7": [')
    store = LabelStore(paths, Clock())
    assert store.groups == {} and store.progress()["folders"]["7"]["cells"] == 1


def test_a_torn_suspects_file_counts_as_missing(tmp_path: Path):
    paths, ids = build(tmp_path, {"7": 1}, {"7": [[0]]})
    store = LabelStore(paths, Clock())
    store.save([{"id": ids["7"][0], "kind": "printed"}], "groups")
    row = f"kind,{ids['7'][0][:16]},printed,handwritten,0.0"
    paths.suspects.write_text("field,file,label,predicted,p_label,p_predicted\n" + row)
    screen = store.review_screen()
    assert screen["items"] == [] and screen["suspects"] is False


def test_a_torn_detections_file_counts_as_missing(tmp_path: Path):
    path = tmp_path / "detections.json"
    path.write_text('{"abc": {"corn')
    assert read_detections(path) == {}
