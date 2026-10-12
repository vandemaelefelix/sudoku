import json
from pathlib import Path

import pytest
from test_data_check import valid_root
from test_label_store import Clock

from sudoku_ml.data_paths import DataPaths
from sudoku_ml.finish import finish
from sudoku_ml.label_store import LabelStore
from sudoku_ml.photo_import import read_photos
from sudoku_ml.status import read_last_finish


def tree(paths: DataPaths) -> dict[str, int]:
    return {
        str(p.relative_to(paths.images)): p.stat().st_size
        for p in paths.images.rglob("*")
        if p.is_file()
    }


def with_derived(tmp_path: Path) -> DataPaths:
    paths = valid_root(tmp_path)
    paths.work.mkdir(parents=True, exist_ok=True)
    paths.prelabels.write_text(json.dumps({"run": "20261012-000755-cell-classifier", "cells": {}}))
    paths.suspects.write_text("field,file,label,predicted,p_label,p_predicted\n")
    paths.groups.write_text(json.dumps({"run": "r", "seed": 0, "k": 1, "folders": {}}))
    return paths


def test_finish_removes_the_journal_and_derived_files_and_keeps_the_pending_data(tmp_path):
    paths = with_derived(tmp_path)
    detections = json.loads(paths.detections.read_text())
    assert len(detections) == 1
    assert paths.journal.exists()
    store = LabelStore(paths, Clock())
    before = tree(paths)

    result = finish(store)

    assert sorted(result["removed"]) == [
        "groups.json",
        "journal.jsonl",
        "prelabels.json",
        "suspects.csv",
    ]
    assert not any(p.exists() for p in (paths.prelabels, paths.groups, paths.suspects))
    assert not paths.journal.exists()
    assert json.loads(paths.detections.read_text()) == detections
    assert tree(paths) == before
    assert result["report"]["problems"] == []
    assert len(paths.cells_csv.read_text().splitlines()) == result["report"]["total_cells"] + 1
    assert result["report"]["linked"] == result["report"]["total_cells"] - 2
    assert result["still_waiting"] == {"cells": result["report"]["waiting_cells"], "photos": 1}
    assert "No problems." in result["text"]


def test_finish_writes_the_status_file(tmp_path: Path):
    paths = with_derived(tmp_path)
    clock = Clock()
    result = finish(LabelStore(paths, clock))
    text = paths.status.read_text()
    assert "Date: 2026-10-12\n" in text
    assert "Last finish: 2026-10-12T09:00:00Z\n" in text
    assert read_last_finish(paths.status) == "2026-10-12T09:00:00Z"
    assert f"| unlabeled | {result['report']['waiting_cells']} |" in text
    assert "| without | 0 |" in text and "| legacy | 0 |" in text
    assert "| pending | 1 |" in text
    assert "- Model run of the pre-labels: 20261012-000755-cell-classifier" in text
    assert f"- Linked cells: {result['report']['linked']} of" in text


def test_a_missing_or_bad_finish_line_means_never_finished(tmp_path: Path):
    path = tmp_path / "STATUS.md"
    assert read_last_finish(path) == ""
    path.write_text("Last finish: yesterday\n")
    assert read_last_finish(path) == ""
    path.write_text("# x\nLast finish: 2026-10-12T20:31:08Z\n")
    assert read_last_finish(path) == "2026-10-12T20:31:08Z"


def test_finish_is_safe_to_press_twice(tmp_path: Path):
    paths = with_derived(tmp_path)
    store = LabelStore(paths, Clock())
    first = finish(store)
    table = paths.cells_csv.read_text()
    second = finish(store)
    assert first["removed"] and second["removed"] == []
    assert second["still_waiting"] == first["still_waiting"]
    assert paths.cells_csv.read_text() == table


def test_after_finish_the_kinds_and_sources_come_from_the_table(tmp_path: Path):
    paths = with_derived(tmp_path)
    store = LabelStore(paths, Clock())
    sources = store.sources()
    cell = next(iter(sources))
    store.assign([{"id": cell, "digit": "4"}], "digits")
    store.save([{"id": cell, "kind": "handwritten"}], "groups")
    finish(store)
    again = LabelStore(paths, Clock())
    assert again.kinds()[cell] == "handwritten" and again.folder[cell] == "4"
    assert again.sources() == sources
    assert again.undo() == 0
    with pytest.raises(ValueError, match="This session is finished. Use git to go back."):
        again.rollback(store.session)


def test_finish_drops_the_detections_of_decided_photos_only(tmp_path: Path):
    paths = with_derived(tmp_path)
    pending = json.loads(paths.detections.read_text())
    decided = next(r["photo_id"] for r in read_photos(paths.photos_csv) if r["status"] != "pending")
    stale = {"corners": [], "lines": [], "reason": "", "width": 1, "height": 1}
    paths.detections.write_text(json.dumps({**pending, decided: stale}))
    result = finish(LabelStore(paths, Clock()))
    assert "detections.json (decided photos only)" in result["removed"]
    assert json.loads(paths.detections.read_text()) == pending


def test_finish_refuses_a_problem_and_deletes_nothing(tmp_path: Path):
    paths = with_derived(tmp_path)
    next(paths.photos.iterdir()).unlink()
    with pytest.raises(ValueError, match="Finish stopped and deleted nothing.*does not exist"):
        finish(LabelStore(paths, Clock()))
    assert paths.prelabels.exists() and paths.suspects.exists() and paths.groups.exists()
    assert paths.detections.exists() and paths.journal.exists()
    assert not paths.status.exists()


def test_finish_refuses_a_table_that_does_not_parse(tmp_path: Path):
    paths = with_derived(tmp_path)
    store = LabelStore(paths, Clock())
    paths.cells_csv.write_text("id,label,kind\n")
    with pytest.raises(ValueError, match="Finish stopped and deleted nothing.*Restore it from git"):
        finish(store)
    assert paths.journal.exists()


def test_finish_deletes_a_detections_file_with_no_pending_photo(tmp_path: Path):
    paths = with_derived(tmp_path)
    paths.detections.write_text("{}")
    result = finish(LabelStore(paths, Clock()))
    assert "detections.json" in result["removed"] and not paths.detections.exists()
