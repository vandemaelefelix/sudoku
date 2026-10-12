import json
from pathlib import Path

import pytest
from test_data_check import valid_root
from test_label_store import Clock

from sudoku_ml.finish import finish
from sudoku_ml.label_store import LabelStore, Paths
from sudoku_ml.photo_import import PhotoPaths


def tree(root: Path) -> dict[str, int]:
    return {
        str(p.relative_to(root)): p.stat().st_size
        for sub in ("data/cells", "data/photos")
        for p in (root / sub).rglob("*")
        if p.is_file()
    }


def with_derived(root: Path) -> tuple[Paths, PhotoPaths]:
    paths, photo_paths = Paths.under(root), PhotoPaths.under(root)
    paths.work.mkdir(parents=True, exist_ok=True)
    paths.prelabels.write_text(json.dumps({"run": "r", "cells": {}}))
    paths.suspects.write_text("field,file,label,predicted,p_label,p_predicted\n")
    paths.groups.write_text(json.dumps({"run": "r", "seed": 0, "k": 1, "folders": {}}))
    return paths, photo_paths


def test_finish_removes_derived_files_and_keeps_the_pending_data(tmp_path: Path):
    root = valid_root(tmp_path)
    paths, photo_paths = with_derived(root)
    detections = json.loads(photo_paths.detections.read_text())
    assert len(detections) == 1
    store = LabelStore(paths, Clock())
    before = tree(root)
    paths.manifest.write_text("id,label,kind\n")

    result = finish(store, photo_paths)

    assert sorted(result["removed"]) == ["groups.json", "prelabels.json", "suspects.csv"]
    assert (
        not paths.prelabels.exists() and not paths.groups.exists() and not paths.suspects.exists()
    )
    assert json.loads(photo_paths.detections.read_text()) == detections
    assert tree(root) == before
    assert result["report"]["problems"] == []
    assert len(paths.manifest.read_text().splitlines()) == result["report"]["total_cells"] + 1
    assert result["still_waiting"] == {
        "cells": result["report"]["waiting_cells"],
        "photos": 1,
    }
    assert "No problems." in result["text"]


def test_finish_is_safe_to_press_twice(tmp_path: Path):
    root = valid_root(tmp_path)
    paths, photo_paths = with_derived(root)
    store = LabelStore(paths, Clock())
    first = finish(store, photo_paths)
    second = finish(store, photo_paths)
    assert first["removed"] and second["removed"] == []
    assert second["still_waiting"] == first["still_waiting"]


def test_finish_drops_the_detections_of_decided_photos_only(tmp_path: Path):
    root = valid_root(tmp_path)
    paths, photo_paths = with_derived(root)
    pending = json.loads(photo_paths.detections.read_text())
    first_decision = json.loads(photo_paths.checks.read_text().splitlines()[0])["photo"]
    stale = {"corners": [], "lines": [], "reason": "", "width": 1, "height": 1}
    photo_paths.detections.write_text(json.dumps({**pending, first_decision: stale}))
    result = finish(LabelStore(paths, Clock()), photo_paths)
    assert "detections.json (decided photos only)" in result["removed"]
    assert json.loads(photo_paths.detections.read_text()) == pending


def test_finish_refuses_a_problem_and_deletes_nothing(tmp_path: Path):
    root = valid_root(tmp_path)
    paths, photo_paths = with_derived(root)
    next((root / "data" / "photos").iterdir()).unlink()
    with pytest.raises(ValueError, match="Finish stopped and deleted nothing.*does not exist"):
        finish(LabelStore(paths, Clock()), photo_paths)
    assert paths.prelabels.exists() and paths.suspects.exists() and paths.groups.exists()
    assert photo_paths.detections.exists()


def test_finish_deletes_a_detections_file_with_no_pending_photo(tmp_path: Path):
    root = valid_root(tmp_path)
    paths, photo_paths = with_derived(root)
    photo_paths.detections.write_text("{}")
    result = finish(LabelStore(paths, Clock()), photo_paths)
    assert "detections.json" in result["removed"] and not photo_paths.detections.exists()
