import json
from pathlib import Path

from PIL import Image
from test_label_store import Clock, add_cell, build, pattern

from sudoku_ml.label_store import LabelStore


def test_a_registered_cell_is_served_without_a_manifest_rewrite(tmp_path: Path):
    paths, _ = build(tmp_path, {"unlabeled": 4, "3": 1})
    store = LabelStore(paths, Clock())
    new_id = add_cell(paths.cells, "unlabeled", pattern(99))
    store.register([new_id])
    assert store.cell_file(new_id[:16]).exists()
    assert Image.open(store.cell_file(new_id[:16])).size == (64, 64)


def test_the_review_screen_tells_a_missing_suspects_file_from_nothing_flagged(tmp_path: Path):
    paths, _ = build(tmp_path, {"4": 2})
    store = LabelStore(paths, Clock())
    assert store.review_screen()["suspects"] is False
    store.paths.suspects.parent.mkdir(parents=True, exist_ok=True)
    store.paths.suspects.write_text("file,field,label,predicted,p_label,p_predicted\n")
    assert store.review_screen()["suspects"] is True


def test_the_store_reads_the_run_of_the_pre_labels(tmp_path: Path):
    paths, ids = build(tmp_path, {"unlabeled": 1})
    store = LabelStore(paths, Clock())
    assert store.status()["model"] is None
    paths.prelabels.write_text(json.dumps({"run": "r1", "cells": {}}))
    assert store.status()["model"] == "r1"
